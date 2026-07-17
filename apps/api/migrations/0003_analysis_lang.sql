-- Make analysis multi-language: one row per (skill_id, lang).
-- Existing rows become the English ('en') version.
CREATE TABLE skill_analysis_new (
  skill_id         INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  lang             TEXT    NOT NULL DEFAULT 'en',
  summary          TEXT,
  critique         TEXT,                            -- JSON: { pros: [], cons: [] }
  use_case         TEXT,
  difficulty       TEXT,                            -- canonical English key (UI translates)
  primary_language TEXT,
  content_hash     TEXT,
  model            TEXT,
  generated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (skill_id, lang)
);

INSERT INTO skill_analysis_new
  (skill_id, lang, summary, critique, use_case, difficulty, primary_language, content_hash, model, generated_at)
SELECT skill_id, 'en', summary, critique, use_case, difficulty, primary_language, content_hash, model, generated_at
  FROM skill_analysis;

DROP TABLE skill_analysis;
ALTER TABLE skill_analysis_new RENAME TO skill_analysis;
