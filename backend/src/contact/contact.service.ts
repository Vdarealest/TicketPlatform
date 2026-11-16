import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ContactMessage } from './entities/contact-message.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(ContactMessage)
    private contactRepo: Repository<ContactMessage>,
    private mailService: MailService,
  ) {}

  async create(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    if (!data.name?.trim())
      throw new BadRequestException('Vui lòng nhập họ tên.');
    if (!data.email?.trim())
      throw new BadRequestException('Vui lòng nhập email.');
    if (!data.subject?.trim())
      throw new BadRequestException('Vui lòng nhập chủ đề.');
    if (!data.message?.trim())
      throw new BadRequestException('Vui lòng nhập nội dung.');
    if (data.message.trim().length > 5000)
      throw new BadRequestException('Nội dung tối đa 5000 ký tự.');

    const msg = this.contactRepo.create({
      name: data.name.trim(),
      email: data.email.trim(),
      subject: data.subject.trim(),
      message: data.message.trim(),
    });
    await this.contactRepo.save(msg);

    this.notifyAdmin(msg);

    return {
      message: 'Gửi liên hệ thành công. Chúng tôi sẽ phản hồi sớm nhất.',
    };
  }

  async findAll() {
    return this.contactRepo.find({ order: { createdAt: 'DESC' } });
  }

  async markRead(id: number) {
    const msg = await this.contactRepo.findOne({ where: { id } });
    if (!msg) throw new BadRequestException('Không tìm thấy tin nhắn.');
    msg.status = 'READ';
    await this.contactRepo.save(msg);
    return msg;
  }

  async reply(id: number, replyMessage: string) {
    if (!replyMessage?.trim())
      throw new BadRequestException('Vui lòng nhập nội dung trả lời.');

    const msg = await this.contactRepo.findOne({ where: { id } });
    if (!msg) throw new BadRequestException('Không tìm thấy tin nhắn.');

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5fa;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5fa;">
    <tr><td align="center" style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="520" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#0F35FF 0%,#6366F1 100%);padding:24px 28px;text-align:center;">
          <h1 style="margin:0;font-size:20px;color:#fff;font-weight:800;">Vietix</h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Phản hồi liên hệ của bạn</p>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 6px;font-size:14px;color:#374151;">Xin chào <strong>${msg.name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;color:#374151;">Cảm ơn bạn đã liên hệ với Vietix. Dưới đây là phản hồi cho câu hỏi của bạn:</p>
          <div style="padding:16px;background:#f0f4ff;border-radius:10px;margin-bottom:20px;">
            <p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.6;white-space:pre-wrap;">${replyMessage.trim()}</p>
          </div>
          <div style="padding:14px 16px;background:#f8f8fd;border-radius:10px;">
            <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Tin nhắn gốc của bạn</p>
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-weight:600;">${msg.subject}</p>
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;white-space:pre-wrap;">${msg.message}</p>
          </div>
        </td></tr>
        <tr><td style="padding:16px 28px 20px;border-top:1px solid #f0f0f5;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} Vietix. Cảm ơn bạn đã sử dụng dịch vụ.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this.mailService.sendRaw({
      to: msg.email,
      subject: `Re: ${msg.subject}`,
      html,
    });

    msg.status = 'REPLIED';
    await this.contactRepo.save(msg);

    return { message: 'Đã gửi phản hồi thành công.' };
  }

  private notifyAdmin(msg: ContactMessage) {
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5fa;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5fa;">
    <tr><td align="center" style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="520" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#0F35FF 0%,#6366F1 100%);padding:24px 28px;text-align:center;">
          <h1 style="margin:0;font-size:20px;color:#fff;font-weight:800;">Vietix — Liên hệ mới</h1>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding:8px 0;font-size:13px;color:#9ca3af;width:80px;">Họ tên</td><td style="padding:8px 0;font-size:14px;color:#1a1a2e;font-weight:600;">${msg.name}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#9ca3af;">Email</td><td style="padding:8px 0;font-size:14px;color:#1a1a2e;">${msg.email}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#9ca3af;">Chủ đề</td><td style="padding:8px 0;font-size:14px;color:#1a1a2e;font-weight:600;">${msg.subject}</td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#f8f8fd;border-radius:10px;">
            <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Nội dung</p>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${msg.message}</p>
          </div>
          <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Trả lời trực tiếp email <strong>${msg.email}</strong></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    this.mailService
      .sendRaw({
        subject: `[Vietix Contact] ${msg.subject}`,
        html,
      })
      .catch((err) =>
        this.logger.error('Failed to send contact notification', err),
      );
  }
}
