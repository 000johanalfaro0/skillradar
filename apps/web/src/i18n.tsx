import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'es';

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    'nav.signIn': 'Sign in with GitHub',
    'nav.signOut': 'Sign out',
    'nav.demo': 'Preview',
    'search.placeholder': 'Search by meaning… e.g. “make nice charts”',
    'search.button': 'Search',
    'search.clear': 'Clear',
    'search.resultsFor': 'Semantic results for',
    'tab.trending': 'Trending 7d',
    'tab.month': 'This month',
    'tab.top': 'Top',
    'tab.new': 'New',
    'state.loading': 'Loading…',
    'state.error': 'Could not load. Is the API running?',
    'state.retry': 'Try again',
    'state.previewTitle': 'Frontend preview',
    'state.previewBody': 'The public API is not connected to this deployment yet. The interface is available for review without pretending that live ranking data is loading.',
    'state.viewCode': 'View architecture and code',
    'state.noMatches': 'No matches. Try another search or tag.',
    'card.analysisPending': 'analysis pending',
    'detail.back': '← Back',
    'detail.inPlainWords': 'In plain words',
    'detail.bestFor': 'Best for:',
    'detail.strengths': 'Strengths',
    'detail.watchOut': 'Watch out',
    'detail.level': 'Level',
    'detail.queued': 'AI analysis is queued — check back after the next cron run.',
    'detail.noAnalysis': 'No analysis available for this skill.',
    'detail.starsOverTime': 'Stars over time',
    'detail.analysisBy': 'Analysis by',
    'detail.notFound': 'Skill not found.',
    'chart.notEnough': 'Not enough history yet — trends appear after a few days of snapshots.',
    'difficulty.beginner': 'beginner',
    'difficulty.intermediate': 'intermediate',
    'difficulty.advanced': 'advanced',
  },
  es: {
    'nav.signIn': 'Entrar con GitHub',
    'nav.signOut': 'Salir',
    'nav.demo': 'Vista previa',
    'search.placeholder': 'Buscá por significado… ej. “hacer gráficos lindos”',
    'search.button': 'Buscar',
    'search.clear': 'Limpiar',
    'search.resultsFor': 'Resultados semánticos para',
    'tab.trending': 'Tendencia 7d',
    'tab.month': 'Este mes',
    'tab.top': 'Top',
    'tab.new': 'Nuevas',
    'state.loading': 'Cargando…',
    'state.error': 'No se pudo cargar. ¿Está corriendo la API?',
    'state.retry': 'Reintentar',
    'state.previewTitle': 'Vista previa del frontend',
    'state.previewBody': 'La API pública todavía no está conectada a este despliegue. La interfaz se puede revisar sin simular que los datos del ranking siguen cargando.',
    'state.viewCode': 'Ver arquitectura y código',
    'state.noMatches': 'Sin resultados. Probá otra búsqueda o etiqueta.',
    'card.analysisPending': 'análisis pendiente',
    'detail.back': '← Volver',
    'detail.inPlainWords': 'En palabras simples',
    'detail.bestFor': 'Ideal para:',
    'detail.strengths': 'Fortalezas',
    'detail.watchOut': 'A tener en cuenta',
    'detail.level': 'Nivel',
    'detail.queued': 'El análisis con IA está en cola — volvé tras la próxima corrida.',
    'detail.noAnalysis': 'No hay análisis disponible para esta skill.',
    'detail.starsOverTime': 'Estrellas en el tiempo',
    'detail.analysisBy': 'Análisis por',
    'detail.notFound': 'Skill no encontrada.',
    'chart.notEnough': 'Todavía no hay historia suficiente — las tendencias aparecen tras unos días de snapshots.',
    'difficulty.beginner': 'principiante',
    'difficulty.intermediate': 'intermedio',
    'difficulty.advanced': 'avanzado',
  },
};

// Tag labels per language (tag keys stay canonical English in the data).
const TAG_LABELS: Record<Lang, Record<string, string>> = {
  en: {},
  es: {
    web: 'web',
    frontend: 'frontend',
    backend: 'backend',
    mobile: 'móvil',
    design: 'diseño',
    data: 'datos',
    'ai-ml': 'ia-ml',
    devops: 'devops',
    testing: 'testing',
    security: 'seguridad',
    database: 'base de datos',
    automation: 'automatización',
    docs: 'documentación',
    api: 'api',
    cli: 'cli',
    productivity: 'productividad',
    art: 'arte',
    performance: 'rendimiento',
  },
};

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  tagLabel: (tag: string) => string;
  difficultyLabel: (d: string) => string;
}

const Ctx = createContext<LangCtx | null>(null);

function detectInitial(): Lang {
  const saved = localStorage.getItem('lang');
  if (saved === 'en' || saved === 'es') return saved;
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const value: LangCtx = {
    lang,
    setLang: setLangState,
    t: (key) => DICT[lang][key] ?? DICT.en[key] ?? key,
    tagLabel: (tag) => TAG_LABELS[lang][tag] ?? tag,
    difficultyLabel: (d) => DICT[lang][`difficulty.${d}`] ?? d,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): LangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used within LangProvider');
  return ctx;
}
