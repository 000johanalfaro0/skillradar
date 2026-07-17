import { Hono } from 'hono';
import type { Env } from '../types';
import { searchSimilar } from '../lib/embeddings';

const COLUMNS = `id, repo, repo_owner, name, description, html_url, repo_stars,
  primary_language, score, trend_7d, trend_30d, vote_count, analysis_status, tags, first_seen_at`;

type SkillRow = { id: number; primary_language: string | null; tags: string | null };

export const search = new Hono<{ Bindings: Env }>();

/** GET /api/search?q=&tag=&lang= — semantic search via Vectorize, ordered by similarity. */
search.get('/search', async (c) => {
  const q = c.req.query('q')?.trim();
  const tag = c.req.query('tag');
  const lang = c.req.query('lang');
  if (!q) return c.json({ items: [] });

  const ids = await searchSimilar(c.env, q, 40);
  if (ids.length === 0) return c.json({ items: [] });

  // Hydrate from D1, then restore Vectorize's similarity order (SQL IN doesn't preserve it).
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await c.env.DB.prepare(
    `SELECT ${COLUMNS} FROM skills WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .all<SkillRow>();

  const byId = new Map(results.map((r) => [r.id, r]));
  let items = ids.map((id) => byId.get(id)).filter((r): r is SkillRow => Boolean(r));

  if (lang) items = items.filter((s) => s.primary_language === lang);
  if (tag) items = items.filter((s) => parseTags(s.tags).includes(tag));

  return c.json({ items });
});

/** GET /api/tags — distinct domain tags with counts, for the filter chips. */
search.get('/tags', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT value AS tag, COUNT(*) AS count
       FROM skills, json_each(skills.tags)
      GROUP BY value
      ORDER BY count DESC`,
  ).all();
  return c.json({ tags: results });
});

function parseTags(json: string | null): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}
