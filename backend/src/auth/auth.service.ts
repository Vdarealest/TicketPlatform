import {
  Inject,
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { TOKEN_STORE, type TokenStore } from './token-store';

interface OtpRecord {
  otp: string;
  expiresAt: number;
  verified: boolean;
  attempts: number;
}

const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_MS = 5 * 60 * 1000;
const OAUTH_CODE_TTL_MS = 60 * 1000; // one-time code, dies in 60s

const otpKey = (email: string) => `otp:${email}`;
const oauthKey = (code: string) => `oauth:${code}`;

// Sessions: a short-lived JWT access token plus an opaque refresh token.
// Only the refresh token's SHA-256 is stored, so a Redis dump can't be
// replayed. Each refresh rotates it; presenting an already-rotated token
// (outside a short grace window for two tabs refreshing at once) means it
// was copied, so the whole session family is revoked.
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REUSE_GRACE_MS = 30 * 1000;

const sha256 = (v: string) =>
  crypto.createHash('sha256').update(v).digest('hex');
const refreshKey = (hash: string) => `refresh:${hash}`;
const usedKey = (hash: string) => `refresh-used:${hash}`;
const revokedKey = (family: string) => `family-revoked:${family}`;

export interface Session {
  access_token: string;
  refresh_token: string;
}

interface RefreshRecord {
  userId: number;
  family: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    // OTPs and OAuth exchange codes (Redis in the app, memory in tests).
    @Inject(TOKEN_STORE) private tokens: TokenStore,
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
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) throw new BadRequestException('Email already exists');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
      ...(phone ? { phone } : {}),
    });
    await this.usersRepository.save(user);
    return { message: 'Register success' };
  }

  async login(email: string, password: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user || !user.password)
      throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return this.issueSession(user);
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

    return this.issueSession(user);
  }

  // ─── Sessions (access + refresh token) ───────────────────────────────────

  private async issueSession(
    user: User,
    family: string = crypto.randomUUID(),
  ): Promise<Session> {
    const refresh = crypto.randomBytes(32).toString('base64url');
    const record: RefreshRecord = {
      userId: user.id,
      family,
      expiresAt: Date.now() + REFRESH_TTL_MS,
    };
    await this.tokens.set(
      refreshKey(sha256(refresh)),
      JSON.stringify(record),
      REFRESH_TTL_MS,
    );
    return { access_token: this.signToken(user), refresh_token: refresh };
  }

  async refreshSession(refreshToken: string): Promise<Session> {
    const hash = sha256(refreshToken);
    const raw = await this.tokens.take(refreshKey(hash));

    if (!raw) {
      // Unknown token. If it was rotated before, someone is replaying it.
      const used = await this.tokens.get(usedKey(hash));
      if (used) {
        const { family, at } = JSON.parse(used) as {
          family: string;
          at: number;
        };
        if (Date.now() - at > REUSE_GRACE_MS) {
          await this.tokens.set(revokedKey(family), '1', REFRESH_TTL_MS);
          this.logger.warn(
            `Refresh token reuse detected; session family ${family.slice(0, 8)} revoked`,
          );
        }
      }
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    const record = JSON.parse(raw) as RefreshRecord;
    const revoked = await this.tokens.get(revokedKey(record.family));
    if (revoked || Date.now() > record.expiresAt) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    const user = await this.usersRepository.findOne({
      where: { id: record.userId },
    });
    if (!user) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    await this.tokens.set(
      usedKey(hash),
      JSON.stringify({ family: record.family, at: Date.now() }),
      REFRESH_TTL_MS,
    );
    return this.issueSession(user, record.family);
  }

  /** Ends the session the refresh token belongs to. Idempotent. */
  async logout(refreshToken: string) {
    const raw = await this.tokens.take(refreshKey(sha256(refreshToken)));
    if (raw) {
      const { family } = JSON.parse(raw) as RefreshRecord;
      await this.tokens.set(revokedKey(family), '1', REFRESH_TTL_MS);
    }
    return { message: 'Đã đăng xuất.' };
  }

  async getMe(userId: number) {
    return this.usersRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'name',
        'phone',
        'avatarUrl',
        'googleId',
        'role',
        'createdAt',
      ],
    });
  }

  // ─── Forgot password / OTP flow ───────────────────────────────────────────

  async forgotPassword(identifier: string) {
    // Find by email first, then by phone
    let user = await this.usersRepository.findOne({
      where: { email: identifier },
    });
    if (!user) {
      user = await this.usersRepository.findOne({
        where: { phone: identifier },
      });
    }

    if (!user) {
      throw new BadRequestException(
        'Số điện thoại / email không tồn tại trong hệ thống.',
      );
    }

    if (!user.password) {
      throw new BadRequestException(
        'Tài khoản này đăng nhập qua Google. Không thể đặt lại mật khẩu.',
      );
    }

    // crypto.randomInt, not Math.random: the code is a credential.
    const otp = crypto.randomInt(100000, 1000000).toString();
    const record: OtpRecord = {
      otp,
      expiresAt: Date.now() + OTP_TTL_MS,
      verified: false,
      attempts: 0,
    };
    await this.tokens.set(
      otpKey(user.email),
      JSON.stringify(record),
      OTP_TTL_MS,
    );

    await this.sendOtpEmail(user.email, otp);

    return {
      message: 'Mã OTP đã được gửi đến email của bạn.',
      maskedEmail: this.maskEmail(user.email),
      email: user.email,
    };
  }

  async verifyOtp(email: string, otp: string) {
    const record = await this.getValidOtp(email);
    if (record.otp !== otp) {
      record.attempts += 1;
      // Too many wrong guesses: burn this OTP so it can't be brute-forced.
      if (record.attempts >= MAX_OTP_ATTEMPTS) {
        await this.tokens.del(otpKey(email));
        throw new BadRequestException(
          'Nhập sai OTP quá nhiều lần. Vui lòng yêu cầu mã mới.',
        );
      }
      await this.tokens.update(otpKey(email), JSON.stringify(record));
      throw new BadRequestException('Mã OTP không đúng.');
    }

    record.verified = true;
    await this.tokens.update(otpKey(email), JSON.stringify(record));
    return { message: 'Xác minh thành công.' };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const record = await this.getValidOtp(email);

    if (!record.verified) {
      throw new BadRequestException(
        'OTP chưa được xác minh. Vui lòng thử lại từ đầu.',
      );
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

    await this.tokens.del(otpKey(email));
    return { message: 'Mật khẩu đã được đặt lại thành công.' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getValidOtp(email: string): Promise<OtpRecord> {
    const raw = await this.tokens.get(otpKey(email));
    const record = raw ? (JSON.parse(raw) as OtpRecord) : null;
    // The store expires keys itself; expiresAt is a second guard.
    if (!record || Date.now() > record.expiresAt) {
      await this.tokens.del(otpKey(email));
      throw new BadRequestException(
        'Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.',
      );
    }
    return record;
  }

  private async sendOtpEmail(email: string, otp: string) {
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailFrom =
      this.configService.get<string>('MAIL_FROM') || `"Vietix" <${mailUser}>`;

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
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `OTP email to ${this.maskEmail(email)} failed: ${reason}`,
      );
      // Dev convenience only: a local setup without SMTP can still finish a
      // reset. Never when mail is configured or in production — a live reset
      // code in the logs is usable by anyone who can read them. (Render does
      // not set NODE_ENV for you, hence the SMTP check as well.)
      const smtpConfigured = !!this.configService.get<string>('MAIL_USER');
      if (!smtpConfigured && process.env.NODE_ENV !== 'production') {
        this.logger.warn(`Dev OTP for ${email}: ${otp}`);
      }
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

  // ─── OAuth one-time exchange code ────────────────────────────────────────

  // The JWT itself never touches the URL / browser history / Referer /
  // server logs after Google sign-in — only this short-lived, single-use
  // code does, and it is useless once exchanged or expired.
  async createOAuthCode(session: Session): Promise<string> {
    const code = crypto.randomBytes(24).toString('hex');
    const record = { session, expiresAt: Date.now() + OAUTH_CODE_TTL_MS };
    await this.tokens.set(
      oauthKey(code),
      JSON.stringify(record),
      OAUTH_CODE_TTL_MS,
    );
    return code;
  }

  async exchangeOAuthCode(code: string): Promise<Session> {
    // Single-use: read and delete atomically, whatever the outcome.
    const raw = await this.tokens.take(oauthKey(code));
    const record = raw
      ? (JSON.parse(raw) as { session: Session; expiresAt: number })
      : null;
    if (!record || Date.now() > record.expiresAt) {
      throw new BadRequestException(
        'Mã đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    }
    return record.session;
  }
}
