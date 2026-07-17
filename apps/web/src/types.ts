export interface Skill {
  id: number;
  repo: string;
  repo_owner: string;
  name: string;
  description: string | null;
  html_url: string;
  repo_stars: number;
  primary_language: string | null;
  score: number;
  trend_7d: number;
  trend_30d: number;
  vote_count: number;
  analysis_status: 'pending' | 'done' | 'error';
  tags?: string; // JSON-encoded string[] from the API
  first_seen_at: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface Analysis {
  summary: string;
  critique: { pros: string[]; cons: string[] } | null;
  use_case: string;
  difficulty: string;
  primary_language: string | null;
  model: string;
  generated_at: string;
}

export interface SkillDetail {
  skill: Skill;
  analysis: Analysis | null;
  history: Array<{ captured_on: string; stars: number }>;
}

export interface Me {
  user: { id: number; username: string; avatar_url: string } | null;
  votes: number[];
}

export type SortKey = 'trending' | 'month' | 'top' | 'new';
