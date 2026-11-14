import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { MomoService } from './momo.service';
import { signaturesMatch } from './signature.util';

const SECRET = 'MOMOSECRET';
const ACCESS = 'ACCESSKEY';

function makeService() {
  const values: Record<string, string> = {
    MOMO_SECRET_KEY: SECRET,
    MOMO_ACCESS_KEY: ACCESS,
  };
  const config = {
    get: (k: string, d?: string) => values[k] ?? d,
  } as unknown as ConfigService;
  return new MomoService(config);
}

// What MoMo sends to our IPN / redirect URL, signed per MoMo's v2 spec.
function momoCallback(over: Record<string, string> = {}) {
  const p: Record<string, string> = {
    partnerCode: 'MOMO',
    orderId: 'VTX1',
    requestId: 'VTX1_1',
    amount: '200000',
    orderInfo: 'Thanh toan 2 ve su kien',
    orderType: 'momo_wallet',
    transId: '4100000001',
    resultCode: '0',
    message: 'Successful.',
    payType: 'qr',
    responseTime: '1794626948084',
    extraData: '',
    ...over,
  };
  const raw =
    `accessKey=${ACCESS}&amount=${p.amount}&extraData=${p.extraData}&message=${p.message}` +
    `&orderId=${p.orderId}&orderInfo=${p.orderInfo}&orderType=${p.orderType}&partnerCode=${p.partnerCode}` +
    `&payType=${p.payType}&requestId=${p.requestId}&responseTime=${p.responseTime}` +
    `&resultCode=${p.resultCode}&transId=${p.transId}`;
  p.signature = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  return p;
}

describe('MomoService.verifySignature', () => {
  const svc = makeService();

  it('accepts a correctly signed callback', () => {
    expect(svc.verifySignature(momoCallback())).toBe(true);
  });

  it.each(['amount', 'orderId', 'resultCode', 'transId'])(
    'rejects a callback whose %s was changed',
    (field) => {
      const p = momoCallback();
      p[field] = p[field] + '9';
      expect(svc.verifySignature(p)).toBe(false);
    },
  );

  it('rejects a missing or truncated signature', () => {
    const p = momoCallback();
    expect(
      svc.verifySignature({ ...p, signature: undefined as unknown as string }),
    ).toBe(false);
    expect(
      svc.verifySignature({ ...p, signature: p.signature.slice(0, -1) }),
    ).toBe(false);
  });
});

describe('signaturesMatch', () => {
  it('compares exactly, without throwing on bad input', () => {
    expect(signaturesMatch('abc123', 'abc123')).toBe(true);
    expect(signaturesMatch('abc123', 'abc124')).toBe(false);
    expect(signaturesMatch('abc123', 'abc12')).toBe(false);
    expect(signaturesMatch('abc123', 'ABC123')).toBe(false);
    expect(signaturesMatch('abc123', undefined)).toBe(false);
    expect(signaturesMatch('abc123', 123456)).toBe(false);
  });
});
