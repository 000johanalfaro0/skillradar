import { Link } from 'react-router-dom';
import type { Skill, SortKey } from '../types';
import { parseTags } from '../utils';
import { useI18n } from '../i18n';
import VoteButton from './VoteButton';

function trendLabel(skill: Skill, sort: SortKey): string | null {
  const delta = sort === 'month' ? skill.trend_30d : skill.trend_7d;
  if (sort === 'top' || sort === 'new' || delta <= 0) return null;
  return `+${delta} ★ ${sort === 'month' ? '30d' : '7d'}`;
}

export default function SkillCard({ skill, sort }: { skill: Skill; sort: SortKey }) {
  const { t, tagLabel } = useI18n();
  const trend = trendLabel(skill, sort);
  const tags = parseTags(skill.tags);

  return (
    <Link
      to={`/skill/${skill.id}`}
      className="block rounded-lg border border-edge bg-panel p-4 transition hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{skill.name}</h3>
          <p className="truncate text-xs text-muted">{skill.repo}</p>
        </div>
        <VoteButton skillId={skill.id} count={skill.vote_count} />
      </div>

      {skill.description && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-300">{skill.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>★ {skill.repo_stars}</span>
        {skill.primary_language && <span>{skill.primary_language}</span>}
        {trend && <span className="text-emerald-400">{trend}</span>}
        {skill.analysis_status !== 'done' && (
          <span className="italic">{t('card.analysisPending')}</span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tg) => (
            <span key={tg} className="rounded bg-ink px-1.5 py-0.5 text-[10px] text-muted">
              {tagLabel(tg)}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
