import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as QRCode from 'qrcode';

interface TicketInfo {
  confirmationCode: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  seatLabel: string | null;
  price: number;
}

interface ConfirmationEmailData {
  to: string;
  orderId: string;
  totalAmount: number;
  provider: string;
  tickets: TicketInfo[];
}

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('MAIL_HOST') || 'smtp.gmail.com',
      port: parseInt(configService.get<string>('MAIL_PORT') || '587', 10),
      secure: false,
      auth: {
        user: configService.get<string>('MAIL_USER'),
        pass: configService.get<string>('MAIL_PASS'),
      },
    });
    this.from =
      configService.get<string>('MAIL_FROM') || 'Vietix <noreply@vietix.vn>';
  }

  async generateQrBase64(data: string): Promise<string> {
    return QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });
  }

  async generateQrBuffer(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data, {
      width: 200,
      margin: 1,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });
  }

  async sendTicketConfirmation(data: ConfirmationEmailData): Promise<void> {
    const attachments: nodemailer.SendMailOptions['attachments'] = [];
    const qrHtmlParts: string[] = [];

    for (let i = 0; i < data.tickets.length; i++) {
      const t = data.tickets[i];
      const cid = `qr-${i}@vietix`;
      const qrBuffer = await this.generateQrBuffer(t.confirmationCode);

      attachments.push({
        filename: `qr-${t.confirmationCode}.png`,
        content: qrBuffer,
        cid,
      });

      qrHtmlParts.push(`
        <tr>
          <td style="padding:16px 0; border-bottom:1px solid #f0f0f5;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top; padding-right:16px;">
                  <img src="cid:${cid}" width="120" height="120" alt="QR Code" style="display:block; border-radius:8px;"/>
                </td>
                <td style="vertical-align:top;">
                  <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:#1a1a2e;">${t.eventTitle}</p>
                  <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">
                    📅 ${t.eventDate}<br/>
                    📍 ${t.eventLocation}
                  </p>
                  <p style="margin:0 0 4px; font-size:13px; color:#374151;">
                    Hạng: <strong>${t.ticketType}</strong>${t.seatLabel ? ` · Ghế: <strong>${t.seatLabel}</strong>` : ''}
                  </p>
                  <p style="margin:0 0 4px; font-size:13px; color:#374151;">
                    Giá: <strong>${t.price.toLocaleString('vi-VN')}₫</strong>
                  </p>
                  <p style="margin:0; font-size:11px; color:#9ca3af; font-family:monospace;">
                    Mã vé: ${t.confirmationCode}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `);
    }

    const payLabel = data.provider === 'MOMO' ? 'MoMo' : 'VNPay';

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"/></head>
<body style="margin:0; padding:0; background:#f5f5fa; font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5fa;">
    <tr><td align="center" style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="560" style="background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0F35FF 0%,#6366F1 100%); padding:28px 32px; text-align:center;">
          <h1 style="margin:0; font-size:22px; color:#fff; font-weight:800; letter-spacing:-0.3px;">Vietix</h1>
          <p style="margin:6px 0 0; font-size:13px; color:rgba(255,255,255,0.85);">Xác nhận đặt vé thành công</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 6px; font-size:15px; color:#374151;">Xin chào,</p>
          <p style="margin:0 0 20px; font-size:15px; color:#374151;">Thanh toán của bạn đã được xác nhận. Dưới đây là thông tin vé:</p>

          <!-- Order info -->
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8f8fd; border-radius:10px; padding:14px 18px; margin-bottom:20px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 4px; font-size:12px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px;">Mã đơn hàng</p>
              <p style="margin:0 0 10px; font-size:14px; color:#1a1a2e; font-weight:700; font-family:monospace;">${data.orderId}</p>
              <p style="margin:0 0 4px; font-size:12px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px;">Tổng tiền</p>
              <p style="margin:0 0 10px; font-size:18px; color:#0F35FF; font-weight:800;">${data.totalAmount.toLocaleString('vi-VN')}₫</p>
              <p style="margin:0; font-size:12px; color:#9ca3af;">Thanh toán qua <strong>${payLabel}</strong></p>
            </td></tr>
          </table>

          <!-- Tickets -->
          <p style="margin:0 0 10px; font-size:14px; font-weight:700; color:#1a1a2e;">Vé của bạn (${data.tickets.length})</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${qrHtmlParts.join('')}
          </table>

          <!-- Note -->
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px; background:#fffbeb; border-radius:10px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0; font-size:13px; color:#92400e;">⚠️ Vui lòng xuất trình mã QR khi check-in tại sự kiện. Mỗi mã QR chỉ sử dụng được một lần.</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px; background:#f8f8fd; text-align:center; border-top:1px solid #f0f0f5;">
          <p style="margin:0; font-size:12px; color:#9ca3af;">© ${new Date().getFullYear()} Vietix. Cảm ơn bạn đã sử dụng dịch vụ.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: data.to,
        subject: `Xác nhận đặt vé - ${data.orderId}`,
        html,
        attachments,
      });
    } catch (err) {
      console.error('Failed to send confirmation email:', err);
    }
  }
}
