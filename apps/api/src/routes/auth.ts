import { Hono } from 'hono';
import type { Env } from '../types';
import { createSession, destroySession, getUserId } from '../lib/session';

export const auth = new Hono<{ Bindings: Env }>();

/** GET /auth/github — start the OAuth dance. */
auth.get('/github', async (c) => {
  const state = crypto.randomUUID();
  await c.env.SESSIONS.put(`oauth_state:${state}`, '1', { expirationTtl: 600 });

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', c.env.GITHUB_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', c.env.GITHUB_OAUTH_CALLBACK);
  url.searchParams.set('scope', 'read:user');
  url.searchParams.set('state', state);
  return c.redirect(url.toString());
});

/** GET /auth/github/callback — exchange code, upsert user, open session, bounce to the app. */
auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) return c.redirect(`${c.env.APP_URL}?auth=error`);

  const stateKey = `oauth_state:${state}`;
  if (!(await c.env.SESSIONS.get(stateKey))) return c.redirect(`${c.env.APP_URL}?auth=badstate`);
  await c.env.SESSIONS.delete(stateKey);

  // Exchange the code for an access token.
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: c.env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: c.env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: c.env.GITHUB_OAUTH_CALLBACK,
    }),
  });
  const token = ((await tokenRes.json()) as { access_token?: string }).access_token;
  if (!token) return c.redirect(`${c.env.APP_URL}?auth=error`);

  // Identify the user.
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'SkillRadar',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!userRes.ok) return c.redirect(`${c.env.APP_URL}?auth=error`);
  const gh = (await userRes.json()) as { id: number; login: string; avatar_url: string };

  const user = await c.env.DB.prepare(
    `INSERT INTO users (github_id, username, avatar_url) VALUES (?, ?, ?)
     ON CONFLICT(github_id) DO UPDATE SET username=excluded.username, avatar_url=excluded.avatar_url
     RETURNING id`,
  )
    .bind(gh.id, gh.login, gh.avatar_url)
    .first<{ id: number }>();
  if (!user) return c.redirect(`${c.env.APP_URL}?auth=error`);

  c.header('Set-Cookie', await createSession(c.env, user.id));
  return c.redirect(`${c.env.APP_URL}?auth=ok`);
});

/** POST /auth/logout — clear the session. */
auth.post('/logout', async (c) => {
  c.header('Set-Cookie', await destroySession(c.env, c.req.raw));
  return c.json({ ok: true });
});

/** GET /api/me — current user + the skill ids they've voted for. */
auth.get('/me', async (c) => {
  const userId = await getUserId(c.env, c.req.raw);
  if (!userId) return c.json({ user: null, votes: [] });

  const user = await c.env.DB.prepare(
    `SELECT id, username, avatar_url FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first();

  const votes = await c.env.DB.prepare(`SELECT skill_id FROM votes WHERE user_id = ?`)
    .bind(userId)
    .all<{ skill_id: number }>();

  return c.json({ user, votes: votes.results.map((v) => v.skill_id) });
});
