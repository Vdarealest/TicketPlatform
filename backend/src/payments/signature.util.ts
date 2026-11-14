import * as crypto from 'crypto';

/**
 * Constant-time comparison for gateway signatures (VNPay, MoMo).
 *
 * `===` returns at the first differing character, so response timing leaks
 * how much of a forged signature was right. timingSafeEqual always compares
 * every byte. It throws on unequal lengths, so that case (and a missing
 * signature) is answered up front — length is not secret, the hash length is
 * fixed and public.
 */
export function signaturesMatch(expected: string, received: unknown): boolean {
  if (typeof received !== 'string' || received.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
}
