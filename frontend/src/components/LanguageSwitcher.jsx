import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../services/telegram';

const LANGS = [['uz', "O'zbekcha"], ['ru', 'Русский'], ['en', 'English']];

/* Three equal parts: the names stay readable on the narrowest phones */
export default function LanguageSwitcher() {
  const { language, setLang } = useLanguage();
  return (
    <div className="med-lang-switch" role="group" aria-label="Til · Язык · Language" data-testid="language-switcher">
      {LANGS.map(([code, name]) => (
        <button
          key={code}
          type="button"
          aria-pressed={language === code}
          className={`med-lang-option ${language === code ? 'active' : ''}`}
          onClick={() => { triggerHaptic('selection'); setLang(code); }}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
