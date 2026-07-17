import type { Skill, SkillDetail, Me, SortKey, TagCount } from './types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

interface Filters {
  lang?: string;
  tag?: string;
  page?: number;
}

export function fetchSkills(sort: SortKey, f: Filters = {}): Promise<{ items: Skill[]; page: number }> {
  const params = new URLSearchParams({ sort, page: String(f.page ?? 1) });
  if (f.lang) params.set('lang', f.lang);
  if (f.tag) params.set('tag', f.tag);
  return get(`/api/skills?${params}`);
}

export function searchSkills(q: string, f: Filters = {}): Promise<{ items: Skill[] }> {
  const params = new URLSearchParams({ q });
  if (f.lang) params.set('lang', f.lang);
  if (f.tag) params.set('tag', f.tag);
  return get(`/api/search?${params}`);
}

export function fetchTags(): Promise<{ tags: TagCount[] }> {
  return get('/api/tags');
}

export function fetchSkill(id: number, lang?: string): Promise<SkillDetail> {
  const qs = lang ? `?lang=${lang}` : '';
  return get(`/api/skills/${id}${qs}`);
}

export function fetchMe(): Promise<Me> {
  return get('/auth/me');
}

export async function toggleVote(id: number): Promise<{ voted: boolean }> {
  const res = await fetch(`${BASE}/api/skills/${id}/vote`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function loginUrl(): string {
  return `${BASE}/auth/github`;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
}
