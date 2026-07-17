-- Domain tags per skill (JSON array of strings from a controlled vocabulary).
-- Used for chip filters and to enrich the embedding text.
ALTER TABLE skills ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
