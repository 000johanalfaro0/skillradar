-- SkillRadar initial schema.
-- Golden rule: this DB holds precomputed values the app reads directly.
-- The cron job is the only writer of skills/snapshots/analysis.

-- One row per discovered skill. Ranking columns are precomputed by the cron.
CREATE TABLE skills (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  repo            TEXT    NOT NULL,                 -- "owner/name"
  path            TEXT    NOT NULL DEFAULT '',      -- SKILL.md path inside the repo (distinguishes monorepo skills)
  repo_owner      TEXT,                             -- for the creator view
  name            TEXT    NOT NULL,                 -- from SKILL.md frontmatter
  description     TEXT,                             -- from SKILL.md frontmatter
  html_url        TEXT,                             -- link to the SKILL.md on GitHub
  content_hash    TEXT,                             -- hash of SKILL.md body; changes trigger re-analysis
  repo_stars      INTEGER NOT NULL DEFAULT 0,
  primary_language TEXT,
  score           REAL    NOT NULL DEFAULT 0,       -- precomputed ranking score
  trend_7d        REAL    NOT NULL DEFAULT 0,       -- star delta vs 7 days ago
  trend_30d       REAL    NOT NULL DEFAULT 0,       -- star delta vs 30 days ago
  vote_count      INTEGER NOT NULL DEFAULT 0,       -- denormalized count of user votes
  analysis_status TEXT    NOT NULL DEFAULT 'pending', -- pending | done | error
  first_seen_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo, path)
);

-- Daily time series. This table IS the raw material for trends.
CREATE TABLE skill_snapshots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id       INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  captured_on    TEXT    NOT NULL,                  -- 'YYYY-MM-DD' (one per skill per day)
  stars          INTEGER NOT NULL DEFAULT 0,
  forks          INTEGER NOT NULL DEFAULT 0,
  last_commit_at TEXT,
  score          REAL    NOT NULL DEFAULT 0,
  UNIQUE(skill_id, captured_on)
);

-- Cached Gemini output. Regenerated only when the skill's content_hash changes.
CREATE TABLE skill_analysis (
  skill_id         INTEGER PRIMARY KEY REFERENCES skills(id) ON DELETE CASCADE,
  summary          TEXT,                            -- natural-language summary for beginners
  critique         TEXT,                            -- JSON: { pros: [], cons: [] }
  use_case         TEXT,
  difficulty       TEXT,                            -- beginner | intermediate | advanced
  primary_language TEXT,                            -- Gemini's inference, merged with GitHub languages
  content_hash     TEXT,                            -- the hash this analysis was generated for
  model            TEXT,
  generated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id  INTEGER NOT NULL UNIQUE,
  username   TEXT    NOT NULL,
  avatar_url TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- A vote = a favorite/upvote. One per user per skill.
CREATE TABLE votes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id   INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, skill_id)
);

-- Indexes for the feed's ORDER BY / filters.
CREATE INDEX idx_skills_score        ON skills(score DESC);
CREATE INDEX idx_skills_trend_7d     ON skills(trend_7d DESC);
CREATE INDEX idx_skills_trend_30d    ON skills(trend_30d DESC);
CREATE INDEX idx_skills_first_seen   ON skills(first_seen_at DESC);
CREATE INDEX idx_skills_language     ON skills(primary_language);
CREATE INDEX idx_skills_status       ON skills(analysis_status);
CREATE INDEX idx_skills_owner        ON skills(repo_owner);
CREATE INDEX idx_snapshots_skill     ON skill_snapshots(skill_id, captured_on DESC);
CREATE INDEX idx_votes_skill         ON votes(skill_id);
CREATE INDEX idx_votes_user          ON votes(user_id);
