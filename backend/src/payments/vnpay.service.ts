import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { signaturesMatch } from './signature.util';

export interface VnpayPaymentParams {
  orderId: string;
  amount: number;
  orderInfo: string;
  ipAddr: string;
  locale?: string;
  bankCode?: string;
}

export interface VnpayReturnParams {
  [key: string]: string;
}

@Injectable()
export class VnpayService {
  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly vnpUrl: string;
  private readonly returnUrl: string;

  constructor(private configService: ConfigService) {
    this.tmnCode = this.configService.get<string>('VNPAY_TMN_CODE', '');
    this.hashSecret = this.configService.get<string>('VNPAY_HASH_SECRET', '');
    this.vnpUrl = this.configService.get<string>(
      'VNPAY_URL',
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    );
    this.returnUrl = this.configService.get<string>(
      'VNPAY_RETURN_URL',
      'http://localhost:3001/checkout/vnpay-return',
    );
  }

  createPaymentUrl(params: VnpayPaymentParams): string {
    const date = new Date();
    const createDate = this.formatDate(date);
    const expireDate = this.formatDate(
      new Date(date.getTime() + 15 * 60 * 1000),
    );

    const vnpParams: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: params.locale || 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: 'other',
      vnp_IpAddr: this.normalizeIp(params.ipAddr),
      vnp_Amount: params.amount * 100,
      vnp_ReturnUrl: this.returnUrl,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    if (params.bankCode) {
      vnpParams['vnp_BankCode'] = params.bankCode;
    }

    const sorted = this.sortObject(vnpParams);
    const signData = this.stringifyParams(sorted);
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    sorted['vnp_SecureHash'] = signed;
    return this.vnpUrl + '?' + this.stringifyParams(sorted);
  }

  verifyReturnUrl(vnpParams: VnpayReturnParams): {
    isValid: boolean;
    responseCode: string;
  } {
    return {
      isValid: this.hasValidSignature(vnpParams),
      responseCode: vnpParams['vnp_ResponseCode'] || '',
    };
  }

  verifyIpn(vnpParams: VnpayReturnParams): {
    isValid: boolean;
    responseCode: string;
    txnRef: string;
    amount: number;
    transactionNo: string;
    bankCode: string;
    bankTranNo: string;
    cardType: string;
    payDate: string;
  } {
    return {
      isValid: this.hasValidSignature(vnpParams),
      responseCode: vnpParams['vnp_ResponseCode'] || '',
      txnRef: vnpParams['vnp_TxnRef'] || '',
      amount: parseInt(vnpParams['vnp_Amount'] || '0', 10) / 100,
      transactionNo: vnpParams['vnp_TransactionNo'] || '',
      bankCode: vnpParams['vnp_BankCode'] || '',
      bankTranNo: vnpParams['vnp_BankTranNo'] || '',
      cardType: vnpParams['vnp_CardType'] || '',
      payDate: vnpParams['vnp_PayDate'] || '',
    };
  }

  // Recomputes the HMAC over every vnp_* param except the hash fields and
  // compares it in constant time with the one VNPay sent.
  private hasValidSignature(vnpParams: VnpayReturnParams): boolean {
    const params = { ...vnpParams };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    const signData = this.stringifyParams(this.sortObject(params));
    const signed = crypto
      .createHmac('sha512', this.hashSecret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    return signaturesMatch(signed, vnpParams['vnp_SecureHash']);
  }

  // Khớp đúng sortObject từ VNPay sample code:
  // encode cả key lẫn value, thay %20 bằng +
  private sortObject(
    obj: Record<string, string | number>,
  ): Record<string, string> {
    const sorted: Record<string, string> = {};
    const encodedKeys: string[] = [];

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        encodedKeys.push(encodeURIComponent(key));
      }
    }
    encodedKeys.sort();

    for (const encodedKey of encodedKeys) {
      const originalKey = decodeURIComponent(encodedKey);
      sorted[encodedKey] = encodeURIComponent(
        String(obj[originalKey]),
      ).replace(/%20/g, '+');
    }
    return sorted;
  }

  // qs.stringify(params, { encode: false }) — join đã-encode params
  private stringifyParams(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  // VNPay xử lý IPv6 (::1, ::ffff:127.0.0.1) không nhất quán → chuẩn hóa về IPv4
  private normalizeIp(ip: string): string {
    if (!ip) return '127.0.0.1';
    if (ip === '::1') return '127.0.0.1';
    if (ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');
    if (ip.includes(':') && !ip.includes('.')) return '127.0.0.1';
    return ip;
  }

  /**
   * yyyyMMddHHmmss in GMT+7, which is what VNPay's spec requires.
   *
   * This used to read the raw local clock (getHours() and friends). That works
   * on a machine set to Vietnam time but on a UTC host every timestamp came out
   * 7 hours behind, so vnp_ExpireDate was already in the past when the request
   * was signed and the gateway answered "giao dịch đã quá thời gian chờ".
   */
  private formatDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '00';

    return (
      get('year') +
      get('month') +
      get('day') +
      get('hour') +
      get('minute') +
      get('second')
    );
  }
}
