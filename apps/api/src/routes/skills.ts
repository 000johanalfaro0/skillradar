import { Hono } from 'hono';
import type { Env } from '../types';
import { getUserId } from '../lib/session';

const PAGE_SIZE = 20;

// Whitelist: maps the public sort param to a trusted ORDER BY clause.
const SORTS: Record<string, string> = {
  trending: 'trend_7d DESC, score DESC',
  month: 'trend_30d DESC, score DESC',
  top: 'score DESC',
  new: 'first_seen_at DESC',
};

export const skills = new Hono<{ Bindings: Env }>();

/** GET /api/skills?sort=trending|month|top|new&lang=&page= — the feed. */
skills.get('/', async (c) => {
  const sort = SORTS[c.req.query('sort') ?? 'trending'] ?? SORTS.trending;
  const lang = c.req.query('lang');
  const tag = c.req.query('tag');
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions: string[] = [];
  const filterBinds: unknown[] = [];
  if (lang) {
    conditions.push('primary_language = ?');
    filterBinds.push(lang);
  }
  if (tag) {
    conditions.push('EXISTS (SELECT 1 FROM json_each(skills.tags) WHERE value = ?)');
    filterBinds.push(tag);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { results } = await c.env.DB.prepare(
    `SELECT id, repo, repo_owner, name, description, html_url, repo_stars,
            primary_language, score, trend_7d, trend_30d, vote_count, analysis_status, tags, first_seen_at
       FROM skills ${where}
      ORDER BY ${sort}
      LIMIT ? OFFSET ?`,
  )
    .bind(...filterBinds, PAGE_SIZE, offset)
    .all();

  return c.json({ page, pageSize: PAGE_SIZE, items: results });
});

/** GET /api/skills/:id — detail with cached analysis + snapshot series for the chart. */
skills.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'bad id' }, 400);

  const skill = await c.env.DB.prepare(`SELECT * FROM skills WHERE id = ?`).bind(id).first();
  if (!skill) return c.json({ error: 'not found' }, 404);

  // Prefer the requested language; fall back to English if that language isn't generated yet.
  const lang = c.req.query('lang') ?? 'en';
  const analysis = await c.env.DB.prepare(
    `SELECT summary, critique, use_case, difficulty, primary_language, lang, model, generated_at
       FROM skill_analysis
      WHERE skill_id = ? AND lang IN (?, 'en')
      ORDER BY (lang = ?) DESC
      LIMIT 1`,
  )
    .bind(id, lang, lang)
    .first<{ critique: string } & Record<string, unknown>>();

  const history = await c.env.DB.prepare(
    `SELECT captured_on, stars FROM skill_snapshots
      WHERE skill_id = ? ORDER BY captured_on ASC LIMIT 60`,
  )
    .bind(id)
    .all();

  return c.json({
    skill,
    analysis: analysis
      ? { ...analysis, critique: safeParse(analysis.critique) }
      : null,
    history: history.results,
  });
});

/** POST /api/skills/:id/vote — toggle favorite (auth required). Keeps vote_count in sync. */
skills.post('/:id/vote', async (c) => {
  const userId = await getUserId(c.env, c.req.raw);
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'bad id' }, 400);

  const existing = await c.env.DB.prepare(
    `SELECT id FROM votes WHERE user_id = ? AND skill_id = ?`,
  )
    .bind(userId, id)
    .first();

  if (existing) {
    await c.env.DB.batch([
      c.env.DB.prepare(`DELETE FROM votes WHERE user_id = ? AND skill_id = ?`).bind(userId, id),
      c.env.DB.prepare(`UPDATE skills SET vote_count = MAX(vote_count - 1, 0) WHERE id = ?`).bind(id),
    ]);
    return c.json({ voted: false });
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO votes (user_id, skill_id) VALUES (?, ?)`).bind(userId, id),
    c.env.DB.prepare(`UPDATE skills SET vote_count = vote_count + 1 WHERE id = ?`).bind(id),
  ]);
  return c.json({ voted: true });
});

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
