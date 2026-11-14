import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { VnpayService } from './vnpay.service';

const SECRET = 'TESTSECRET';

function makeService(secret = SECRET) {
  const values: Record<string, string> = {
    VNPAY_TMN_CODE: 'TMN01',
    VNPAY_HASH_SECRET: secret,
    VNPAY_URL: 'https://sandbox.example/pay',
    VNPAY_RETURN_URL: 'https://shop.example/return',
  };
  const config = { get: (k: string, d?: string) => values[k] ?? d } as unknown as ConfigService;
  return new VnpayService(config);
}

// Turns the generated payment URL back into the params VNPay would echo.
function paramsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URL(url).searchParams.forEach((v, k) => (out[k] = v));
  return out;
}

// Signs a param set the way VNPay does when it calls our return/IPN URLs.
function vnpaySign(params: Record<string, string>, secret = SECRET) {
  const keys = Object.keys(params).map(encodeURIComponent).sort();
  const data = keys
    .map((k) => `${k}=${encodeURIComponent(params[decodeURIComponent(k)]).replace(/%20/g, '+')}`)
    .join('&');
  return crypto.createHmac('sha512', secret).update(Buffer.from(data, 'utf-8')).digest('hex');
}

describe('VnpayService', () => {
  const svc = makeService();

  describe('createPaymentUrl', () => {
    it('signs the request so it verifies with the same secret', () => {
      const url = svc.createPaymentUrl({ orderId: 'VTX1', amount: 150000, orderInfo: 'Thanh toan 2 ve', ipAddr: '1.2.3.4' });
      const p = paramsFromUrl(url);
      expect(url.startsWith('https://sandbox.example/pay?')).toBe(true);
      expect(svc.verifyReturnUrl(p).isValid).toBe(true);
    });

    it('sends the amount in VNPay units (x100) and the configured terminal', () => {
      const p = paramsFromUrl(svc.createPaymentUrl({ orderId: 'VTX2', amount: 150000, orderInfo: 'x', ipAddr: '1.2.3.4' }));
      expect(p.vnp_Amount).toBe('15000000');
      expect(p.vnp_TmnCode).toBe('TMN01');
      expect(p.vnp_TxnRef).toBe('VTX2');
    });

    it('normalizes IPv6 loopback / mapped addresses to IPv4', () => {
      const ip = (raw: string) =>
        paramsFromUrl(svc.createPaymentUrl({ orderId: 'X', amount: 1, orderInfo: 'x', ipAddr: raw })).vnp_IpAddr;
      expect(ip('::1')).toBe('127.0.0.1');
      expect(ip('::ffff:10.0.0.5')).toBe('10.0.0.5');
      expect(ip('2001:db8::1')).toBe('127.0.0.1');
      expect(ip('')).toBe('127.0.0.1');
    });

    it('stamps create/expire dates in Vietnam time, 15 minutes apart', () => {
      const p = paramsFromUrl(svc.createPaymentUrl({ orderId: 'X', amount: 1, orderInfo: 'x', ipAddr: '1.1.1.1' }));
      const vnNow = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hourCycle: 'h23' })
        .format(new Date());
      expect(p.vnp_CreateDate).toMatch(/^\d{14}$/);
      // Hour field (yyyyMMdd|HH|mmss) must be the Vietnam hour, not the host's.
      expect(p.vnp_CreateDate.slice(8, 10)).toBe(vnNow);
      const toMs = (s: string) =>
        Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
      expect(toMs(p.vnp_ExpireDate) - toMs(p.vnp_CreateDate)).toBe(15 * 60 * 1000);
    });
  });

  describe('verifyIpn', () => {
    const base = {
      vnp_TxnRef: 'VTX9',
      vnp_Amount: '25000000',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: '14000001',
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: 'Thanh toan 1 ve',
    };

    it('accepts a correctly signed callback and converts the amount back to VND', () => {
      const r = svc.verifyIpn({ ...base, vnp_SecureHash: vnpaySign(base) });
      expect(r.isValid).toBe(true);
      expect(r.amount).toBe(250000);
      expect(r.txnRef).toBe('VTX9');
      expect(r.responseCode).toBe('00');
    });

    it('ignores vnp_SecureHashType when checking the signature', () => {
      const r = svc.verifyIpn({ ...base, vnp_SecureHashType: 'HmacSHA512', vnp_SecureHash: vnpaySign(base) });
      expect(r.isValid).toBe(true);
    });

    it('rejects a callback whose amount was tampered with', () => {
      const sig = vnpaySign(base);
      expect(svc.verifyIpn({ ...base, vnp_Amount: '100', vnp_SecureHash: sig }).isValid).toBe(false);
    });

    it('rejects a callback signed with another secret', () => {
      expect(svc.verifyIpn({ ...base, vnp_SecureHash: vnpaySign(base, 'OTHER') }).isValid).toBe(false);
    });

    it('rejects a callback with no signature', () => {
      expect(svc.verifyIpn({ ...base }).isValid).toBe(false);
    });
  });
});
