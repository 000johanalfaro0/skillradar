/** Cloudflare bindings + secrets available to the Worker. */
export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  VECTORIZE: Vectorize;
  AI: Ai;

  // Non-secret vars (wrangler.toml [vars]).
  APP_URL: string;
  GITHUB_OAUTH_CALLBACK: string;
  SEED_TOPICS: string;
  SEED_REPOS: string;
  ANALYZE_BATCH: string;
  ANALYZE_LANGS: string; // comma-separated, e.g. "en,es"

  // Secrets (.dev.vars locally / `wrangler secret put` in prod).
  GITHUB_TOKEN: string;
  GEMINI_API_KEY: string;
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  SESSION_SECRET: string;
}

/** A skill candidate discovered on GitHub, before it is measured/scored. */
export interface DiscoveredSkill {
  repo: string; // "owner/name"
  repoOwner: string;
  path: string; // SKILL.md path inside the repo
  name: string; // from frontmatter
  description: string | null;
  htmlUrl: string;
  contentHash: string;
  body: string; // SKILL.md content (used by the analyzer)
}

/** Live repo metrics fetched from GitHub. */
export interface RepoMetrics {
  stars: number;
  forks: number;
  pushedAt: string | null;
  defaultBranch: string;
  owner: string;
  primaryLanguage: string | null;
}

/** Cached Gemini analysis shape (also the JSON the model must return). */
export interface SkillAnalysis {
  summary: string;
  critique: { pros: string[]; cons: string[] };
  use_case: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  primary_language: string | null;
  tags: string[];
}
