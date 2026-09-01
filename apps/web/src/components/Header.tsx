import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../hooks';
import { useI18n, type Lang } from '../i18n';
import { API_CONFIGURED, loginUrl, logout } from '../api';

export default function Header() {
  const { data } = useMe();
  const { t, lang, setLang } = useI18n();
  const qc = useQueryClient();
  const user = data?.user;

  async function onLogout() {
    await logout();
    qc.invalidateQueries({ queryKey: ['me'] });
  }

  return (
    <header className="sticky top-0 z-10 border-b border-edge bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="text-accent">◎</span> SkillRadar
        </Link>

        <div className="flex items-center gap-3">
          <LangToggle lang={lang} setLang={setLang} />

          {user ? (
            <div className="flex items-center gap-2">
              <img src={user.avatar_url} alt="" className="h-7 w-7 rounded-full" />
              <span className="hidden text-sm text-muted sm:inline">{user.username}</span>
              <button onClick={onLogout} className="text-sm text-muted hover:text-gray-100">
                {t('nav.signOut')}
              </button>
            </div>
          ) : API_CONFIGURED ? (
            <a
              href={loginUrl()}
              className="rounded-md border border-edge bg-panel px-3 py-1.5 text-sm hover:border-accent"
            >
              {t('nav.signIn')}
            </a>
          ) : <span className="rounded-md border border-edge px-3 py-1.5 text-xs text-muted">{t('nav.demo')}</span>}
        </div>
      </div>
    </header>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-edge text-xs">
      {(['es', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2 py-1 uppercase ${
            lang === l ? 'bg-accent text-white' : 'text-muted hover:text-gray-100'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
