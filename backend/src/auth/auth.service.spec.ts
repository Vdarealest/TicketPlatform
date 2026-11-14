import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

type Row = Record<string, any>;

function setup(users: Row[] = []) {
  const repo = {
    findOne: jest.fn(async ({ where }: { where: Row }) => {
      const [[k, v]] = Object.entries(where);
      return users.find((u) => u[k] === v) ?? null;
    }),
    create: jest.fn((x: Row) => ({ ...x })),
    save: jest.fn(async (x: Row) => {
      if (!x.id) {
        x.id = users.length + 1;
        users.push(x);
      }
      return x;
    }),
  };
  const jwt = { sign: jest.fn((payload: Row) => `jwt:${payload.sub}`) };
  const config = { get: jest.fn(() => undefined) };
  const service = new AuthService(repo as any, jwt as any, config as any);
  const sendMail = jest.fn(async () => ({}));
  (service as any).transporter = { sendMail };
  return { service, repo, jwt, users, sendMail };
}

// bcrypt cost 10 is slow; a cheap hash keeps these tests fast and is still
// a real bcrypt hash that the service has to compare against.
const hash = (pw: string) => bcrypt.hashSync(pw, 4);

describe('AuthService', () => {
  describe('register', () => {
    it('stores a bcrypt hash, never the plain password', async () => {
      const { service, users } = setup();
      await service.register('a@example.com', 'secret123');
      expect(users[0].password).not.toBe('secret123');
      expect(await bcrypt.compare('secret123', users[0].password)).toBe(true);
    });

    it('rejects an email that is already registered', async () => {
      const { service, repo } = setup([{ id: 1, email: 'a@example.com' }]);
      await expect(
        service.register('a@example.com', 'secret123'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token signed with the user id', async () => {
      const { service, jwt } = setup([
        { id: 3, email: 'a@example.com', password: hash('secret123') },
      ]);
      expect(await service.login('a@example.com', 'secret123')).toEqual({
        access_token: 'jwt:3',
      });
      expect(jwt.sign).toHaveBeenCalledWith({ sub: 3, email: 'a@example.com' });
    });

    it('rejects a wrong password', async () => {
      const { service } = setup([
        { id: 3, email: 'a@example.com', password: hash('secret123') },
      ]);
      await expect(
        service.login('a@example.com', 'nope'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email with the same error (no account enumeration)', async () => {
      const { service } = setup();
      await expect(service.login('ghost@example.com', 'x')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('rejects password login for a Google-only account', async () => {
      const { service } = setup([
        { id: 1, email: 'g@example.com', googleId: 'g-1', password: null },
      ]);
      await expect(service.login('g@example.com', '')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('googleLogin', () => {
    it('links Google to an existing email account instead of duplicating it', async () => {
      const existing = { id: 1, email: 'a@example.com', password: 'h' };
      const { service, users } = setup([existing]);
      await service.googleLogin('g-1', 'a@example.com');
      expect(users).toHaveLength(1);
      expect(existing).toMatchObject({ googleId: 'g-1' });
    });

    it('creates a passwordless account for a new Google user', async () => {
      const { service, users } = setup();
      const res = await service.googleLogin('g-2', 'new@example.com');
      expect(users[0]).toMatchObject({
        email: 'new@example.com',
        googleId: 'g-2',
      });
      expect(users[0].password).toBeUndefined();
      expect(res.access_token).toBe('jwt:1');
    });
  });

  describe('password reset via OTP', () => {
    async function requestOtp() {
      const ctx = setup([
        { id: 1, email: 'a@example.com', password: hash('old-pass') },
      ]);
      await ctx.service.forgotPassword('a@example.com');
      const otp = (ctx.service as any).otpStore.get('a@example.com')
        .otp as string;
      return { ...ctx, otp };
    }

    it('emails a 6-digit code and masks the address in the response', async () => {
      const { sendMail, otp, service } = await requestOtp();
      expect(otp).toMatch(/^\d{6}$/);
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@example.com' }),
      );
      const res = await service.forgotPassword('a@example.com');
      expect(res.maskedEmail).toBe('a******@example.com');
    });

    it('shows only the first three characters of a longer address', async () => {
      const { service } = setup([
        { id: 1, email: 'johndoe@example.com', password: 'h' },
      ]);
      expect(
        (await service.forgotPassword('johndoe@example.com')).maskedEmail,
      ).toBe('joh******@example.com');
    });

    it('refuses Google-only accounts', async () => {
      const { service } = setup([
        { id: 1, email: 'g@example.com', password: null },
      ]);
      await expect(
        service.forgotPassword('g@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('burns the code after 5 wrong guesses', async () => {
      const { service, otp } = await requestOtp();
      const wrong = otp === '000000' ? '111111' : '000000';
      for (let i = 0; i < 4; i++) {
        await expect(service.verifyOtp('a@example.com', wrong)).rejects.toThrow(
          'Mã OTP không đúng',
        );
      }
      await expect(service.verifyOtp('a@example.com', wrong)).rejects.toThrow(
        'quá nhiều lần',
      );
      // Even the right code no longer works.
      await expect(service.verifyOtp('a@example.com', otp)).rejects.toThrow(
        'hết hạn',
      );
    });

    it('rejects an expired code', async () => {
      const { service, otp } = await requestOtp();
      (service as any).otpStore.get('a@example.com').expiresAt = Date.now() - 1;
      await expect(service.verifyOtp('a@example.com', otp)).rejects.toThrow(
        'hết hạn',
      );
    });

    it('will not reset before the code is verified', async () => {
      const { service, otp } = await requestOtp();
      await expect(
        service.resetPassword('a@example.com', otp, 'new-pass'),
      ).rejects.toThrow('chưa được xác minh');
    });

    it('resets the password once, then the code is spent', async () => {
      const { service, otp, users } = await requestOtp();
      await service.verifyOtp('a@example.com', otp);
      await service.resetPassword('a@example.com', otp, 'new-pass');

      expect(await bcrypt.compare('new-pass', users[0].password)).toBe(true);
      await expect(
        service.login('a@example.com', 'new-pass'),
      ).resolves.toBeDefined();
      await expect(
        service.resetPassword('a@example.com', otp, 'again!!'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('OAuth exchange code', () => {
    it('returns the token once, then is useless', () => {
      const { service } = setup();
      const code = service.createOAuthCode('jwt:9');
      expect(service.exchangeOAuthCode(code)).toEqual({
        access_token: 'jwt:9',
      });
      expect(() => service.exchangeOAuthCode(code)).toThrow(
        BadRequestException,
      );
    });

    it('expires after its TTL', () => {
      const { service } = setup();
      const code = service.createOAuthCode('jwt:9');
      (service as any).oauthCodeStore.get(code).expiresAt = Date.now() - 1;
      expect(() => service.exchangeOAuthCode(code)).toThrow(
        BadRequestException,
      );
    });

    it('rejects a made-up code', () => {
      const { service } = setup();
      expect(() => service.exchangeOAuthCode('deadbeef')).toThrow(
        BadRequestException,
      );
    });
  });
});
