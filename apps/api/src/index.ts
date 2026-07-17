import { createApp } from './app';
import { runCron } from './cron';
import type { Env } from './types';

const app = createApp();

export default {
  fetch: app.fetch,

  // Cloudflare Cron Trigger entrypoint — the daily heart of the app.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runCron(env).then(
        (r) => console.log('cron complete', r),
        (e) => console.error('cron failed', e),
      ),
    );
  },
};
