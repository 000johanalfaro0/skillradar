import type { Env } from '../types';

const COOKIE = 'sr_session';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Create a KV-backed session and return the Set-Cookie header value. */
export async function createSession(env: Env, userId: number): Promise<string> {
  const id = crypto.randomUUID();
  await env.SESSIONS.put(`session:${id}`, String(userId), { expirationTtl: TTL_SECONDS });
  return cookie(id, TTL_SECONDS);
}

/** Resolve the current user id from the request's session cookie, or null. */
export async function getUserId(env: Env, req: Request): Promise<number | null> {
  const id = readCookie(req, COOKIE);
  if (!id) return null;
  const userId = await env.SESSIONS.get(`session:${id}`);
  return userId ? Number(userId) : null;
}

export async function destroySession(env: Env, req: Request): Promise<string> {
  const id = readCookie(req, COOKIE);
  if (id) await env.SESSIONS.delete(`session:${id}`);
  return cookie('', 0);
}

function cookie(value: string, maxAge: number): string {
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}
