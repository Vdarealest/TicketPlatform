import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';

import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';

interface OtpRecord {
  otp: string;
  expiresAt: number;
  verified: boolean;
}

@Injectable()
export class AuthService {
  // In-memory OTP store: email → record (TTL 5 min)
  private readonly otpStore = new Map<string, OtpRecord>();

  private readonly transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('MAIL_HOST') || 'smtp.gmail.com',
      port: parseInt(configService.get<string>('MAIL_PORT') || '587', 10),
      secure: false,
      auth: {
        user: configService.get<string>('MAIL_USER'),
        pass: configService.get<string>('MAIL_PASS'),
      },
    });
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async register(email: string, password: string, phone?: string) {
    const existingUser = await this.usersRepository.findOne({ where: { email } });
    if (existingUser) throw new BadRequestException('Email already exists');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({ email, password: hashedPassword, ...(phone ? { phone } : {}) });
    await this.usersRepository.save(user);
    return { message: 'Register success' };
  }

  async login(email: string, password: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user || !user.password) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return { access_token: this.signToken(user) };
  }

  async googleLogin(googleId: string, email: string) {
    let user = await this.usersRepository.findOne({ where: { googleId } });

    if (!user && email) {
      user = await this.usersRepository.findOne({ where: { email } });
      if (user) {
        user.googleId = googleId;
        await this.usersRepository.save(user);
      }
    }

    if (!user) {
      user = this.usersRepository.create({ email, googleId });
      await this.usersRepository.save(user);
    }

    return { access_token: this.signToken(user) };
  }

  async getMe(userId: number) {
    return this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'googleId', 'role'],
    });
  }

  // ─── Forgot password / OTP flow ───────────────────────────────────────────

  async forgotPassword(identifier: string) {
    // Find by email first, then by phone
    let user = await this.usersRepository.findOne({ where: { email: identifier } });
    if (!user) {
      user = await this.usersRepository.findOne({ where: { phone: identifier } });
    }

    if (!user) {
      throw new BadRequestException('Số điện thoại / email không tồn tại trong hệ thống.');
    }

    if (!user.password) {
      throw new BadRequestException('Tài khoản này đăng nhập qua Google. Không thể đặt lại mật khẩu.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpStore.set(user.email, { otp, expiresAt: Date.now() + 5 * 60 * 1000, verified: false });

    await this.sendOtpEmail(user.email, otp);

    return {
      message: 'Mã OTP đã được gửi đến email của bạn.',
      maskedEmail: this.maskEmail(user.email),
      email: user.email,
    };
  }

  async verifyOtp(email: string, otp: string) {
    const record = this.getValidOtp(email);
    if (record.otp !== otp) throw new BadRequestException('Mã OTP không đúng.');

    record.verified = true;
    return { message: 'Xác minh thành công.' };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const record = this.getValidOtp(email);

    if (!record.verified) {
      throw new BadRequestException('OTP chưa được xác minh. Vui lòng thử lại từ đầu.');
    }
    if (record.otp !== otp) {
      throw new BadRequestException('Mã OTP không hợp lệ.');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 6 ký tự.');
    }

    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) throw new BadRequestException('Tài khoản không tồn tại.');

    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);

    this.otpStore.delete(email);
    return { message: 'Mật khẩu đã được đặt lại thành công.' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getValidOtp(email: string): OtpRecord {
    const record = this.otpStore.get(email);
    if (!record || Date.now() > record.expiresAt) {
      this.otpStore.delete(email);
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.');
    }
    return record;
  }

  private async sendOtpEmail(email: string, otp: string) {
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailFrom = this.configService.get<string>('MAIL_FROM') || `"Vietix" <${mailUser}>`;

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#e02020;padding:24px 32px;">
          <span style="font-size:26px;font-weight:900;color:#fff;letter-spacing:3px;font-family:Georgia,serif;">Vietix</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 8px;color:#111;font-size:20px;font-weight:700;">Đặt lại mật khẩu</h2>
          <p style="margin:0 0 24px;color:#6e6e73;font-size:14px;line-height:1.6;">
            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong style="color:#111;">${email}</strong>.
            Sử dụng mã OTP dưới đây để tiếp tục.
          </p>
          <!-- OTP block -->
          <div style="background:#f5f6f8;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9ea5ad;">Mã OTP của bạn</p>
            <span style="font-size:40px;font-weight:900;letter-spacing:10px;color:#e02020;font-family:monospace;">${otp}</span>
            <p style="margin:12px 0 0;font-size:12px;color:#9ea5ad;">Hiệu lực trong <strong>5 phút</strong></p>
          </div>
          <p style="margin:0;font-size:12px;color:#c7c7cc;line-height:1.6;">
            Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
            Không chia sẻ mã này với bất kỳ ai.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:11px;color:#c7c7cc;">© 2025 Vietix. Tất cả quyền được bảo lưu.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: mailFrom,
        to: email,
        subject: `[Vietix] Mã OTP đặt lại mật khẩu: ${otp}`,
        html,
      });
    } catch (err) {
      // Dev fallback — log OTP to console if SMTP not configured
      console.warn(`[Vietix] Email send failed. Dev OTP for ${email}: ${otp}`);
      console.warn(err?.message);
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const show = local.length >= 3 ? local.slice(0, 3) : local;
    return `${show}${'*'.repeat(6)}@${domain}`;
  }

  private signToken(user: User) {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }
}
