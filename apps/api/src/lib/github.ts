import type { Env, DiscoveredSkill, RepoMetrics } from '../types';

const GH_API = 'https://api.github.com';

/** Authenticated GitHub API fetch with retry-aware rate-limit handling. */
async function gh<T>(env: Env, path: string, accept = 'application/vnd.github+json'): Promise<T | null> {
  const res = await fetch(`${GH_API}${path}`, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'SkillRadar',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (res.status === 404) return null;

  // Secondary/primary rate limit: back off once, then give up for this run.
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    const waitMs = Math.min(Math.max(reset - Date.now(), 1000), 60_000);
    await new Promise((r) => setTimeout(r, waitMs));
    const retry = await fetch(`${GH_API}${path}`, {
      headers: {
        Accept: accept,
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'SkillRadar',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!retry.ok) return null;
    return (await retry.json()) as T;
  }

  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Collect candidate repos: seed repos + repos carrying the configured topics. */
export async function discoverRepos(env: Env): Promise<Set<string>> {
  const repos = new Set<string>();

  for (const r of env.SEED_REPOS.split(',').map((s) => s.trim()).filter(Boolean)) {
    repos.add(r);
  }

  for (const topic of env.SEED_TOPICS.split(',').map((s) => s.trim()).filter(Boolean)) {
    const data = await gh<{ items: Array<{ full_name: string }> }>(
      env,
      `/search/repositories?q=topic:${encodeURIComponent(topic)}&sort=stars&per_page=100`,
    );
    for (const item of data?.items ?? []) repos.add(item.full_name);
  }

  return repos;
}

/** Fetch live metrics for a repo. Returns null if the repo is gone/private. */
export async function getRepoMetrics(env: Env, repo: string): Promise<RepoMetrics | null> {
  const data = await gh<{
    stargazers_count: number;
    forks_count: number;
    pushed_at: string | null;
    default_branch: string;
    language: string | null;
    owner: { login: string };
  }>(env, `/repos/${repo}`);
  if (!data) return null;

  return {
    stars: data.stargazers_count ?? 0,
    forks: data.forks_count ?? 0,
    pushedAt: data.pushed_at,
    defaultBranch: data.default_branch ?? 'main',
    owner: data.owner?.login ?? repo.split('/')[0],
    primaryLanguage: data.language,
  };
}

/** List every SKILL.md path in a repo via the recursive git tree (handles monorepos). */
export async function findSkillPaths(env: Env, repo: string, branch: string): Promise<string[]> {
  const tree = await gh<{ tree: Array<{ path: string; type: string }>; truncated: boolean }>(
    env,
    `/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
  if (!tree) return [];
  return tree.tree
    .filter((e) => e.type === 'blob' && e.path.split('/').pop() === 'SKILL.md')
    .map((e) => e.path);
}

/** Fetch raw SKILL.md content, parse frontmatter, and build a DiscoveredSkill. */
export async function fetchSkill(
  env: Env,
  repo: string,
  repoOwner: string,
  path: string,
): Promise<DiscoveredSkill | null> {
  const file = await gh<{ content?: string; encoding?: string; html_url: string }>(
    env,
    `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
  );
  if (!file?.content) return null;

  const body = file.encoding === 'base64' ? decodeBase64(file.content) : file.content;
  const fm = parseFrontmatter(body);
  const fallbackName = path.includes('/') ? path.split('/').slice(-2)[0] : repo.split('/')[1];

  return {
    repo,
    repoOwner,
    path,
    name: fm.name ?? fallbackName,
    description: fm.description ?? null,
    htmlUrl: file.html_url,
    contentHash: await sha256(body),
    body,
  };
}

/** Minimal YAML frontmatter parser for SKILL.md (name + description only). */
export function parseFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[kv[1].toLowerCase()] = value;
  }
  return { name: out.name, description: out.description };
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeBase64(b64: string): string {
  const clean = b64.replace(/\n/g, '');
  const bin = atob(clean);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
