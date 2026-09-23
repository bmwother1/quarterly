/**
 * Encrypting calendar links before they reach the database.
 *
 * A feed URL is a password: anyone holding it reads a student's whole schedule,
 * with no login, for as long as the link lives. Row-level security already stops
 * one student reading another's rows. This covers what RLS does not: a database
 * backup, a leaked dump, a dashboard screenshot, or a service-role query. What
 * sits in `calendar_feed` is ciphertext, and the key lives only in Vercel's
 * environment (`FEED_LINK_KEY`), never in Supabase.
 *
 * AES-256-GCM, a fresh random IV per link, and the user id as associated data,
 * so a row copied into another student's account does not decrypt.
 *
 * Rows are addressed by an HMAC of the URL rather than the URL. The ciphertext
 * changes every time a link is saved, so it cannot be a key, and a plain hash of
 * a secret is still a secret's fingerprint. The HMAC key is derived from the
 * same secret, so the two cannot drift apart.
 */

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

export interface Keys {
  seal: Buffer;
  id: Buffer;
}

/** The two keys, from `FEED_LINK_KEY` (32 random bytes, base64). Null when unset or malformed. */
export function keysFrom(secret: string | undefined): Keys | null {
  if (!secret) return null;
  const raw = Buffer.from(secret, 'base64');
  if (raw.length < 32) return null;
  const derive = (info: string) => Buffer.from(hkdfSync('sha256', raw, Buffer.alloc(0), info, 32));
  return { seal: derive('heron feed link seal v1'), id: derive('heron feed link id v1') };
}

/** Stable per user and link, reveals neither. */
export function linkId(keys: Keys, userId: string, url: string): string {
  return createHmac('sha256', keys.id).update(`${userId}\n${url}`).digest('hex');
}

/** `v1.<iv>.<tag>.<ciphertext>`, base64url. */
export function seal(keys: Keys, userId: string, url: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys.seal, iv);
  cipher.setAAD(Buffer.from(userId));
  const body = Buffer.concat([cipher.update(url, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), body].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

/** The URL, or null for anything tampered with, moved between accounts, or sealed under another key. */
export function unseal(keys: Keys, userId: string, sealed: string): string | null {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || body === undefined) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keys.seal, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
