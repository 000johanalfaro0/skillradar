import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_CONFIGURED, fetchSkills, searchSkills, fetchTags } from '../api';
import type { SortKey } from '../types';
import { useI18n } from '../i18n';
import SkillCard from '../components/SkillCard';

const TAB_KEYS: SortKey[] = ['trending', 'month', 'top', 'new'];

export default function Feed() {
  const { t, tagLabel } = useI18n();
  const [sort, setSort] = useState<SortKey>('trending');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState(''); // submitted search query
  const [tag, setTag] = useState<string | null>(null);

  const searching = query.trim().length > 0;

  const { data: tagData } = useQuery({ queryKey: ['tags'], queryFn: fetchTags, enabled: API_CONFIGURED, retry: 1 });

  const { data, isLoading, isError } = useQuery({
    queryKey: searching ? ['search', query, tag] : ['skills', sort, tag],
    queryFn: () =>
      searching
        ? searchSkills(query, { tag: tag ?? undefined })
        : fetchSkills(sort, { tag: tag ?? undefined }),
    enabled: API_CONFIGURED,
    retry: 1,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(input);
  }

  function clearSearch() {
    setInput('');
    setQuery('');
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="mb-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {searching ? (
          <button
            type="button"
            onClick={clearSearch}
            className="rounded-lg border border-edge px-3 text-sm text-muted hover:text-gray-100"
          >
            {t('search.clear')}
          </button>
        ) : (
          <button type="submit" className="rounded-lg bg-accent px-4 text-sm font-medium text-white">
            {t('search.button')}
          </button>
        )}
      </form>

      {tagData && tagData.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {tagData.tags.map((tc) => (
            <button
              key={tc.tag}
              onClick={() => setTag(tag === tc.tag ? null : tc.tag)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                tag === tc.tag ? 'bg-accent text-white' : 'bg-panel text-muted hover:text-gray-100'
              }`}
            >
              {tagLabel(tc.tag)} <span className="opacity-60">{tc.count}</span>
            </button>
          ))}
        </div>
      )}

      {!searching && (
        <nav className="mb-4 flex gap-1 overflow-x-auto">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                sort === key ? 'bg-accent text-white' : 'bg-panel text-muted hover:text-gray-100'
              }`}
            >
              {t(`tab.${key}`)}
            </button>
          ))}
        </nav>
      )}

      {searching && (
        <p className="mb-3 text-sm text-muted">
          {t('search.resultsFor')} “<span className="text-gray-200">{query}</span>”
        </p>
      )}

      {!API_CONFIGURED && (
        <section role="status" className="rounded-lg border border-edge bg-panel p-5">
          <h1 className="font-semibold text-gray-100">{t('state.previewTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{t('state.previewBody')}</p>
          <a className="mt-4 inline-block text-sm font-medium text-accent hover:underline" href="https://github.com/000johanalfaro0/skillradar">{t('state.viewCode')}</a>
        </section>
      )}
      {API_CONFIGURED && isLoading && <p className="text-muted">{t('state.loading')}</p>}
      {API_CONFIGURED && isError && <div role="alert"><p className="text-red-400">{t('state.error')}</p><button className="mt-2 text-sm text-accent hover:underline" onClick={() => window.location.reload()}>{t('state.retry')}</button></div>}
      {data && data.items.length === 0 && <p className="text-muted">{t('state.noMatches')}</p>}

      <div className="flex flex-col gap-3">
        {data?.items.map((skill) => (
          <SkillCard key={skill.id} skill={skill} sort={searching ? 'top' : sort} />
        ))}
      </div>
    </div>
  );
}
