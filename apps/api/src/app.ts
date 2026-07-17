import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { skills } from './routes/skills';
import { search } from './routes/search';
import { auth } from './routes/auth';
import { runCron } from './cron';

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  // Allow the frontend origin to call the API with credentials (session cookie).
  app.use('*', cors({ origin: (_o, c) => c.env.APP_URL, credentials: true }));

  app.get('/health', (c) => c.json({ ok: true }));

  app.route('/api/skills', skills);
  app.route('/api', search); // /api/search, /api/tags
  app.route('/auth', auth); // /auth/github, /auth/github/callback, /auth/logout, /auth/me

  // Manual cron trigger for testing/seeding (guarded by the session secret).
  app.get('/admin/run-cron', async (c) => {
    if (c.req.header('x-admin-key') !== c.env.SESSION_SECRET) {
      return c.json({ error: 'forbidden' }, 403);
    }
    const result = await runCron(c.env);
    return c.json({ ok: true, ...result });
  });

  return app;
}
