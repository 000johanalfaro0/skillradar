import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchSkill } from '../api';
import { useI18n } from '../i18n';
import StarChart from '../components/StarChart';
import VoteButton from '../components/VoteButton';

export default function SkillDetail() {
  const { id } = useParams();
  const { t, lang, difficultyLabel } = useI18n();
  const skillId = Number(id);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill', skillId, lang],
    queryFn: () => fetchSkill(skillId, lang),
    enabled: Number.isInteger(skillId),
  });

  if (isLoading) return <p className="text-muted">{t('state.loading')}</p>;
  if (isError || !data) return <p className="text-red-400">{t('detail.notFound')}</p>;

  const { skill, analysis, history } = data;

  return (
    <article className="flex flex-col gap-5">
      <Link to="/" className="text-sm text-muted hover:text-gray-100">
        {t('detail.back')}
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{skill.name}</h1>
          <a
            href={skill.html_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent hover:underline"
          >
            {skill.repo}
          </a>
        </div>
        <VoteButton skillId={skill.id} count={skill.vote_count} />
      </header>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>★ {skill.repo_stars}</span>
        {skill.primary_language && <span>{skill.primary_language}</span>}
        {skill.trend_7d > 0 && <span className="text-emerald-400">+{skill.trend_7d} ★ / 7d</span>}
        {analysis?.difficulty && (
          <span>
            {t('detail.level')}: {difficultyLabel(analysis.difficulty)}
          </span>
        )}
      </div>

      {analysis ? (
        <>
          <section className="rounded-lg border border-edge bg-panel p-4">
            <h2 className="mb-1 text-sm font-semibold text-muted">{t('detail.inPlainWords')}</h2>
            <p className="text-gray-200">{analysis.summary}</p>
            {analysis.use_case && (
              <p className="mt-2 text-sm text-muted">
                <span className="font-medium text-gray-300">{t('detail.bestFor')} </span>
                {analysis.use_case}
              </p>
            )}
          </section>

          {analysis.critique && (
            <section className="grid gap-3 sm:grid-cols-2">
              <CritiqueList title={t('detail.strengths')} items={analysis.critique.pros} tone="emerald" />
              <CritiqueList title={t('detail.watchOut')} items={analysis.critique.cons} tone="amber" />
            </section>
          )}
        </>
      ) : (
        <p className="text-muted">
          {skill.analysis_status === 'pending' ? t('detail.queued') : t('detail.noAnalysis')}
        </p>
      )}

      <section className="rounded-lg border border-edge bg-panel p-4">
        <h2 className="mb-2 text-sm font-semibold text-muted">{t('detail.starsOverTime')}</h2>
        <StarChart data={history} />
      </section>

      {analysis && (
        <p className="text-xs text-muted">
          {t('detail.analysisBy')} {analysis.model} · {analysis.generated_at}
        </p>
      )}
    </article>
  );
}

function CritiqueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'emerald' | 'amber';
}) {
  const color = tone === 'emerald' ? 'text-emerald-400' : 'text-amber-400';
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <h3 className={`mb-2 text-sm font-semibold ${color}`}>{title}</h3>
      <ul className="flex flex-col gap-1 text-sm text-gray-300">
        {items.length === 0 && <li className="text-muted">—</li>}
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={color}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
