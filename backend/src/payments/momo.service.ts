import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface MomoPaymentParams {
  orderId: string;
  amount: number;
  orderInfo: string;
  requestType?: string; // 'captureWallet' (ví QR) | 'payWithATM' (thẻ ATM)
}

export interface MomoCreateResult {
  payUrl: string;
}

@Injectable()
export class MomoService {
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;
  private readonly redirectUrl: string;
  private readonly ipnUrl: string;

  constructor(private configService: ConfigService) {
    // Credentials sandbox công khai mặc định của MoMo (dùng được ngay để test)
    this.partnerCode = this.configService.get<string>(
      'MOMO_PARTNER_CODE',
      'MOMO',
    );
    this.accessKey = this.configService.get<string>(
      'MOMO_ACCESS_KEY',
      'F8BBA842ECF85',
    );
    this.secretKey = this.configService.get<string>(
      'MOMO_SECRET_KEY',
      'K951B6PE1waDMi640xX08PD3vg6EkVlz',
    );
    this.endpoint = this.configService.get<string>(
      'MOMO_ENDPOINT',
      'https://test-payment.momo.vn/v2/gateway/api/create',
    );
    this.redirectUrl = this.configService.get<string>(
      'MOMO_REDIRECT_URL',
      'http://localhost:3001/checkout/momo-return',
    );
    this.ipnUrl = this.configService.get<string>(
      'MOMO_IPN_URL',
      'http://localhost:3000/payments/momo/ipn',
    );
  }

  async createPayment(
    params: MomoPaymentParams,
  ): Promise<MomoCreateResult> {
    const requestId = `${params.orderId}_${Date.now()}`;
    // captureWallet: ví MoMo (QR) | payWithATM: thẻ ATM nội địa
    const requestType =
      params.requestType === 'payWithATM' ? 'payWithATM' : 'captureWallet';
    const extraData = '';

    // Chuỗi ký theo đúng thứ tự alphabet MoMo yêu cầu
    const rawSignature =
      `accessKey=${this.accessKey}` +
      `&amount=${params.amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${this.ipnUrl}` +
      `&orderId=${params.orderId}` +
      `&orderInfo=${params.orderInfo}` +
      `&partnerCode=${this.partnerCode}` +
      `&redirectUrl=${this.redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    const body = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      amount: String(params.amount),
      orderId: params.orderId,
      orderInfo: params.orderInfo,
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      extraData,
      requestType,
      signature,
      lang: 'vi',
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log('[MoMo] create response:', data.resultCode, data.message);

    if (data.resultCode !== 0 || !data.payUrl) {
      throw new InternalServerErrorException(
        `MoMo tạo thanh toán thất bại: ${data.message || 'Lỗi không xác định'}`,
      );
    }

    return { payUrl: data.payUrl };
  }

  // Verify chữ ký IPN/return từ MoMo (HMAC-SHA256 theo thứ tự alphabet)
  verifySignature(params: Record<string, string>): boolean {
    const rawSignature =
      `accessKey=${this.accessKey}` +
      `&amount=${params.amount}` +
      `&extraData=${params.extraData}` +
      `&message=${params.message}` +
      `&orderId=${params.orderId}` +
      `&orderInfo=${params.orderInfo}` +
      `&orderType=${params.orderType}` +
      `&partnerCode=${params.partnerCode}` +
      `&payType=${params.payType}` +
      `&requestId=${params.requestId}` +
      `&responseTime=${params.responseTime}` +
      `&resultCode=${params.resultCode}` +
      `&transId=${params.transId}`;

    const expected = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    return expected === params.signature;
  }
}
