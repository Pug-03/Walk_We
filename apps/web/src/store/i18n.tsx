import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGS, translate, type Lang, type StringKey, type Vars } from '../i18n.ts';
import { storage } from '../utils/storage.ts';

const KEY = 'ww_lang';

function initialLang(): Lang {
  const saved = storage.getItem(KEY);
  return LANGS.some((l) => l.code === saved) ? (saved as Lang) : 'th';
}

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    storage.setItem(KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback((key: StringKey, vars?: Vars) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n outside LangProvider');
  return v;
}
