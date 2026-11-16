import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { MemoryTokenStore } from './token-store';

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
  const config = {
    get: jest.fn((_key: string): string | undefined => undefined),
  };
  const tokens = new MemoryTokenStore();
  const service = new AuthService(
    repo as any,
    jwt as any,
    config as any,
    tokens,
  );
  const sendMail = jest.fn(async () => ({}));
  (service as any).transporter = { sendMail };
  return { service, repo, jwt, users, sendMail, config, tokens };
}

// bcrypt cost 10 is slow; a cheap hash keeps these tests fast and is still
// a real bcrypt hash that the service has to compare against.
const hash = (pw: string) => bcrypt.hashSync(pw, 4);

type Stored = { otp?: string; token?: string; expiresAt: number };
const readKey = async (tokens: MemoryTokenStore, key: string) =>
  JSON.parse((await tokens.get(key)) ?? 'null') as Stored | null;
// Pretend the record's own expiry has passed (the store TTL is separate).
const expireKey = async (tokens: MemoryTokenStore, key: string) => {
  const rec = await readKey(tokens, key);
  await tokens.update(
    key,
    JSON.stringify({ ...rec, expiresAt: Date.now() - 1 }),
  );
};

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
        refresh_token: expect.stringMatching(/^[\w-]{43}$/),
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
      const otp = (await readKey(ctx.tokens, 'otp:a@example.com'))!.otp!;
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

    it('never logs the OTP in production when the email fails', async () => {
      const ctx = setup([
        { id: 1, email: 'a@example.com', password: hash('old-pass') },
      ]);
      ctx.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await ctx.service.forgotPassword('a@example.com');
        const otp = (await readKey(ctx.tokens, 'otp:a@example.com'))!.otp!;
        const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
        expect(logged).toContain('SMTP down');
        expect(logged).not.toContain(otp);
        expect(logged).not.toContain('a@example.com');
      } finally {
        process.env.NODE_ENV = oldEnv;
        warn.mockRestore();
      }
    });

    it.each([
      ['SMTP is configured', 'smtp-user', 'development', false],
      ['running locally without SMTP', undefined, 'development', true],
    ])(
      'OTP in logs when the email fails and %s: %p',
      async (_label, mailUser, nodeEnv, expectLogged) => {
        const ctx = setup([
          { id: 1, email: 'a@example.com', password: hash('old-pass') },
        ]);
        ctx.config.get.mockImplementation((k: string) =>
          k === 'MAIL_USER' ? mailUser : undefined,
        );
        ctx.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
        const warn = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => {});
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = nodeEnv;
        try {
          await ctx.service.forgotPassword('a@example.com');
          const otp = (await readKey(ctx.tokens, 'otp:a@example.com'))!.otp!;
          const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
          expect(logged.includes(otp)).toBe(expectLogged);
        } finally {
          process.env.NODE_ENV = oldEnv;
          warn.mockRestore();
        }
      },
    );

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
      const { service, otp, tokens } = await requestOtp();
      await expireKey(tokens, 'otp:a@example.com');
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
    it('returns the token once, then is useless', async () => {
      const { service } = setup();
      const code = await service.createOAuthCode({
        access_token: 'jwt:9',
        refresh_token: 'r9',
      });
      await expect(service.exchangeOAuthCode(code)).resolves.toEqual({
        access_token: 'jwt:9',
        refresh_token: 'r9',
      });
      await expect(service.exchangeOAuthCode(code)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('expires after its TTL', async () => {
      const { service, tokens } = setup();
      const code = await service.createOAuthCode({
        access_token: 'jwt:9',
        refresh_token: 'r9',
      });
      await expireKey(tokens, `oauth:${code}`);
      await expect(service.exchangeOAuthCode(code)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a made-up code', async () => {
      const { service } = setup();
      await expect(
        service.exchangeOAuthCode('deadbeef'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores the code with a 60s TTL', async () => {
      const { service, tokens } = setup();
      const spy = jest.spyOn(tokens, 'set');
      const code = await service.createOAuthCode({
        access_token: 'jwt:9',
        refresh_token: 'r9',
      });
      expect(spy).toHaveBeenCalledWith(
        `oauth:${code}`,
        expect.any(String),
        60_000,
      );
    });
  });

  describe('refresh tokens', () => {
    const user = () => ({
      id: 3,
      email: 'a@example.com',
      password: hash('secret123'),
    });

    async function loggedIn() {
      const ctx = setup([user()]);
      const session = await ctx.service.login('a@example.com', 'secret123');
      return { ...ctx, session };
    }

    it('stores only a hash of the refresh token, for 30 days', async () => {
      const ctx = setup([user()]);
      const spy = jest.spyOn(ctx.tokens, 'set');
      const { refresh_token } = await ctx.service.login(
        'a@example.com',
        'secret123',
      );
      const [key, value, ttl] = spy.mock.calls[0];
      expect(key).toMatch(/^refresh:[0-9a-f]{64}$/);
      expect(key).not.toContain(refresh_token);
      expect(value).not.toContain(refresh_token);
      expect(ttl).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('rotates: a refresh gives a new pair and the old token stops working', async () => {
      const { service, session } = await loggedIn();
      const next = await service.refreshSession(session.refresh_token);
      expect(next.access_token).toBe('jwt:3');
      expect(next.refresh_token).not.toBe(session.refresh_token);
      await expect(
        service.refreshSession(next.refresh_token),
      ).resolves.toBeDefined();
    });

    it('a rotated token reused after the grace window revokes the whole session', async () => {
      const { service, session } = await loggedIn();
      const now = Date.now();
      const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
      try {
        const next = await service.refreshSession(session.refresh_token);
        clock.mockReturnValue(now + 60_000); // attacker replays a minute later
        await expect(
          service.refreshSession(session.refresh_token),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        // The legitimate user's newer token is dead too.
        await expect(
          service.refreshSession(next.refresh_token),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      } finally {
        clock.mockRestore();
      }
    });

    it('two tabs refreshing at once do not revoke the session', async () => {
      const { service, session } = await loggedIn();
      const next = await service.refreshSession(session.refresh_token);
      // The second tab used the same old token within the grace window.
      await expect(
        service.refreshSession(session.refresh_token),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        service.refreshSession(next.refresh_token),
      ).resolves.toBeDefined();
    });

    it('logout ends the session', async () => {
      const { service, session } = await loggedIn();
      await expect(service.logout(session.refresh_token)).resolves.toEqual({
        message: 'Đã đăng xuất.',
      });
      await expect(
        service.refreshSession(session.refresh_token),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      // Idempotent.
      await expect(
        service.logout(session.refresh_token),
      ).resolves.toBeDefined();
    });

    it('rejects made-up and expired refresh tokens', async () => {
      const { service, session, tokens } = await loggedIn();
      await expect(
        service.refreshSession('not-a-real-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      const key = tokens['data'].keys().next().value as string;
      await expireKey(tokens, key);
      await expect(
        service.refreshSession(session.refresh_token),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a refresh for a deleted user', async () => {
      const { service, session, users } = await loggedIn();
      users.length = 0;
      await expect(
        service.refreshSession(session.refresh_token),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('OTP storage', () => {
    it('stores the OTP with a 5-minute TTL', async () => {
      const ctx = setup([
        { id: 1, email: 'a@example.com', password: hash('old-pass') },
      ]);
      const spy = jest.spyOn(ctx.tokens, 'set');
      await ctx.service.forgotPassword('a@example.com');
      expect(spy).toHaveBeenCalledWith(
        'otp:a@example.com',
        expect.any(String),
        300_000,
      );
    });

    it('persists wrong-guess counts between requests', async () => {
      const ctx = setup([
        { id: 1, email: 'a@example.com', password: hash('old-pass') },
      ]);
      await ctx.service.forgotPassword('a@example.com');
      const otp = (await readKey(ctx.tokens, 'otp:a@example.com'))!.otp!;
      const wrong = otp === '000000' ? '111111' : '000000';
      await expect(
        ctx.service.verifyOtp('a@example.com', wrong),
      ).rejects.toThrow();
      await expect(
        ctx.service.verifyOtp('a@example.com', wrong),
      ).rejects.toThrow();
      const rec = (await readKey(ctx.tokens, 'otp:a@example.com')) as Stored & {
        attempts: number;
      };
      expect(rec.attempts).toBe(2);
    });
  });
});
