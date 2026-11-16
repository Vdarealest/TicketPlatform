/**
 * Redis connection options shared by BullMQ and the auth token store.
 * Managed hosts (Render Key Value, Upstash…) hand out a single connection
 * URL, so REDIS_URL wins when present; the discrete host/port vars stay for
 * local development.
 */
export function redisConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      // Managed Redis over TLS advertises itself with the rediss:// scheme.
      ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}
