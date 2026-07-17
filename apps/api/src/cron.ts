import type { Env, SkillAnalysis } from './types';
import { discoverRepos, getRepoMetrics, findSkillPaths, fetchSkill } from './lib/github';
import { analyzeSkill, MODEL_NAME } from './lib/gemini';
import { upsertSkillVector } from './lib/embeddings';
import { computeScore, dayKey, round2 } from './lib/scoring';

/**
 * The daily job. Idempotent. Four phases:
 *   A. DISCOVER + MEASURE + ANALYZE (inline, batched) — walks repos -> SKILL.md files.
 *   B. SCORE — recomputes trends/score from the snapshot history.
 * Runtime note: for large skill counts this should be sharded across runs; for the
 * MVP's seed set it fits comfortably in one scheduled invocation.
 */
export async function runCron(env: Env): Promise<{ skills: number; analyzed: number }> {
  const today = dayKey();
  const analyzeBudget = Number(env.ANALYZE_BATCH) || 120;
  const langs = env.ANALYZE_LANGS.split(',').map((s) => s.trim()).filter(Boolean);
  const targetLangs = langs.length ? langs : ['en'];
  let analyzed = 0; // counts Gemini calls (one per skill per language)
  let skillCount = 0;

  const repos = await discoverRepos(env);

  for (const repo of repos) {
    const metrics = await getRepoMetrics(env, repo);
    if (!metrics) continue;

    const paths = await findSkillPaths(env, repo, metrics.defaultBranch);
    for (const path of paths) {
      const skill = await fetchSkill(env, repo, metrics.owner, path);
      if (!skill) continue;
      skillCount++;

      // DISCOVER: upsert the skill row. analysis_status flips to 'pending' on content change.
      const row = await env.DB.prepare(
        `INSERT INTO skills
           (repo, path, repo_owner, name, description, html_url, content_hash,
            repo_stars, primary_language, analysis_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
         ON CONFLICT(repo, path) DO UPDATE SET
           name=excluded.name,
           description=excluded.description,
           html_url=excluded.html_url,
           repo_stars=excluded.repo_stars,
           primary_language=COALESCE(skills.primary_language, excluded.primary_language),
           analysis_status=CASE WHEN skills.content_hash IS NOT excluded.content_hash
                                THEN 'pending' ELSE skills.analysis_status END,
           content_hash=excluded.content_hash,
           updated_at=datetime('now')
         RETURNING id, analysis_status`,
      )
        .bind(
          repo,
          path,
          skill.repoOwner,
          skill.name,
          skill.description,
          skill.htmlUrl,
          skill.contentHash,
          metrics.stars,
          metrics.primaryLanguage,
        )
        .first<{ id: number; analysis_status: string }>();
      if (!row) continue;

      // MEASURE: one snapshot per skill per day.
      await env.DB.prepare(
        `INSERT INTO skill_snapshots (skill_id, captured_on, stars, forks, last_commit_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(skill_id, captured_on) DO UPDATE SET
           stars=excluded.stars, forks=excluded.forks, last_commit_at=excluded.last_commit_at`,
      )
        .bind(row.id, today, metrics.stars, metrics.forks, metrics.pushedAt)
        .run();

      // ANALYZE + EMBED (inline, cached): only pending skills, only while we have budget.
      if (row.analysis_status === 'pending' && analyzed < analyzeBudget) {
        const canonical = await analyzeSkillLangs(env, row.id, skill.contentHash, skill.body, targetLangs);
        analyzed += targetLangs.length;
        if (canonical) {
          // Embed the canonical (first language) text — keeps the index single-language.
          const text = `${skill.name}. ${skill.description ?? ''}. ${canonical.summary} ${canonical.use_case} ${canonical.tags.join(' ')}`;
          await upsertSkillVector(env, row.id, text).catch((e) =>
            console.error('embed failed', row.id, e),
          );
        }
      }
    }
  }

  await scorePhase(env);
  return { skills: skillCount, analyzed };
}

/**
 * Run Gemini for one skill in every target language and persist a row per language.
 * The first successful language is "canonical": it drives the skill's tags, language
 * and embedding (the vector index stays single-language). Returns it for embedding.
 */
async function analyzeSkillLangs(
  env: Env,
  skillId: number,
  contentHash: string,
  body: string,
  langs: string[],
): Promise<SkillAnalysis | null> {
  let canonical: SkillAnalysis | null = null;

  for (const lang of langs) {
    const analysis = await analyzeSkill(env, body, lang);
    if (!analysis) continue;
    if (!canonical) canonical = analysis;

    await env.DB.prepare(
      `INSERT INTO skill_analysis
         (skill_id, lang, summary, critique, use_case, difficulty, primary_language, content_hash, model, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(skill_id, lang) DO UPDATE SET
         summary=excluded.summary, critique=excluded.critique, use_case=excluded.use_case,
         difficulty=excluded.difficulty, primary_language=excluded.primary_language,
         content_hash=excluded.content_hash, model=excluded.model, generated_at=datetime('now')`,
    )
      .bind(
        skillId,
        lang,
        analysis.summary,
        JSON.stringify(analysis.critique),
        analysis.use_case,
        analysis.difficulty,
        analysis.primary_language,
        contentHash,
        MODEL_NAME,
      )
      .run();
  }

  if (!canonical) {
    await env.DB.prepare(`UPDATE skills SET analysis_status='error' WHERE id=?`).bind(skillId).run();
    return null;
  }

  // Canonical analysis drives the skill row's tags + language + status (used by feed/search).
  await env.DB.prepare(
    `UPDATE skills
       SET analysis_status='done',
           primary_language=COALESCE(NULLIF(?, ''), primary_language),
           tags=?
     WHERE id=?`,
  )
    .bind(canonical.primary_language ?? '', JSON.stringify(canonical.tags ?? []), skillId)
    .run();

  return canonical;
}

/** SCORE: derive trend_7d / trend_30d / score from snapshot history. */
async function scorePhase(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT s.id, s.vote_count,
        (SELECT stars FROM skill_snapshots WHERE skill_id=s.id ORDER BY captured_on DESC LIMIT 1) AS stars_now,
        (SELECT stars FROM skill_snapshots WHERE skill_id=s.id AND captured_on <= date('now','-7 day')  ORDER BY captured_on DESC LIMIT 1) AS stars_7d,
        (SELECT stars FROM skill_snapshots WHERE skill_id=s.id AND captured_on <= date('now','-30 day') ORDER BY captured_on DESC LIMIT 1) AS stars_30d,
        (SELECT last_commit_at FROM skill_snapshots WHERE skill_id=s.id ORDER BY captured_on DESC LIMIT 1) AS pushed_at
     FROM skills s`,
  ).all<{
    id: number;
    vote_count: number;
    stars_now: number | null;
    stars_7d: number | null;
    stars_30d: number | null;
    pushed_at: string | null;
  }>();

  const updates = rows.results.map((r) => {
    const now = r.stars_now ?? 0;
    const trend7d = now - (r.stars_7d ?? now);
    const trend30d = now - (r.stars_30d ?? now);
    const score = computeScore({ stars: now, pushedAt: r.pushed_at, votes: r.vote_count, trend7d });
    return env.DB.prepare(
      `UPDATE skills SET score=?, trend_7d=?, trend_30d=?, repo_stars=? WHERE id=?`,
    ).bind(score, round2(trend7d), round2(trend30d), now, r.id);
  });

  if (updates.length) await env.DB.batch(updates);
}
