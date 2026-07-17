/**
 * Ranking score. Combines popularity, freshness, community votes and momentum.
 * Monorepo skills share the repo's stars, so votes + recency + momentum are the
 * signals that break ties between skills living in the same repository.
 */
export function computeScore(opts: {
  stars: number;
  pushedAt: string | null;
  votes: number;
  trend7d: number;
}): number {
  const popularity = Math.log10(opts.stars + 1) * 10; // log so 10k stars doesn't bury everything
  const recency = recencyBoost(opts.pushedAt);
  const community = opts.votes * 2;
  const momentum = Math.max(opts.trend7d, 0) * 0.5;
  return round2(popularity + recency + community + momentum);
}

/** Up to +10 for a repo pushed today, decaying to ~0 after a year. */
function recencyBoost(pushedAt: string | null): number {
  if (!pushedAt) return 0;
  const days = (Date.now() - new Date(pushedAt).getTime()) / 86_400_000;
  if (days < 0) return 10;
  return round2(10 * Math.exp(-days / 120));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** YYYY-MM-DD for a Date in UTC (snapshot day key). */
export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
