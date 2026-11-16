import { OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Short-lived auth secrets: password-reset OTPs (5 min) and the one-time
 * codes that hand a JWT over after Google sign-in (60 s).
 *
 * They used to live in a Map inside AuthService, so a restart or redeploy
 * (routine on Render) silently invalidated every code in flight, and a
 * second instance would not see codes issued by the first. Redis is already
 * required for BullMQ, so they live there now, with Redis enforcing expiry.
 */
export const TOKEN_STORE = Symbol('TOKEN_STORE');

export interface TokenStore {
  set(key: string, value: string, ttlMs: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** Replace the value of an existing key, keeping its remaining TTL. */
  update(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  /** Read and delete in one step, so a single-use code can't be used twice. */
  take(key: string): Promise<string | null>;
}

export class RedisTokenStore implements TokenStore, OnModuleDestroy {
  constructor(private readonly redis: Redis) {}

  async set(key: string, value: string, ttlMs: number) {
    await this.redis.set(key, value, 'PX', ttlMs);
  }

  get(key: string) {
    return this.redis.get(key);
  }

  async update(key: string, value: string) {
    // XX: never resurrect a key that expired between read and write.
    await this.redis.set(key, value, 'KEEPTTL', 'XX');
  }

  async del(key: string) {
    await this.redis.del(key);
  }

  take(key: string) {
    return this.redis.getdel(key);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}

/** Same contract in process memory; used by unit tests. */
export class MemoryTokenStore implements TokenStore {
  private readonly data = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  private live(key: string) {
    const entry = this.data.get(key);
    if (entry && Date.now() >= entry.expiresAt) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: string, ttlMs: number) {
    this.data.set(key, { value, expiresAt: Date.now() + ttlMs });
    return Promise.resolve();
  }

  get(key: string) {
    return Promise.resolve(this.live(key)?.value ?? null);
  }

  update(key: string, value: string) {
    const entry = this.live(key);
    if (entry) entry.value = value;
    return Promise.resolve();
  }

  del(key: string) {
    this.data.delete(key);
    return Promise.resolve();
  }

  take(key: string) {
    const value = this.live(key)?.value ?? null;
    this.data.delete(key);
    return Promise.resolve(value);
  }
}
