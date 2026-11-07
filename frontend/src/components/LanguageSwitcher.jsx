import React, { useEffect, useRef, useState } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../services/telegram';

const LANGS = [['uz', 'UZ', "O'zbekcha"], ['ru', 'RU', 'Русский'], ['en', 'EN', 'English']];

/* Top right of the header: a small button with the current language, the full names in a menu.
   Small enough to sit next to the bazaar name on a 320 px phone. */
export default function LanguageSwitcher() {
  const { language, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const current = LANGS.find(([code]) => code === language) || LANGS[0];

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const escape = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  return (
    <div className="med-lang-menu" ref={boxRef} data-testid="language-switcher">
      <button
        type="button"
        className="med-lang-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Til · Язык · Language"
        onClick={() => { triggerHaptic('light'); setOpen((v) => !v); }}
      >
        <Globe size={16} />
        <span>{current[1]}</span>
        <ChevronDown size={14} className={open ? 'med-lang-chevron open' : 'med-lang-chevron'} />
      </button>
      {open && (
        <div className="med-lang-list" role="menu">
          {LANGS.map(([code, , name]) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={language === code}
              className={`med-lang-option ${language === code ? 'active' : ''}`}
              onClick={() => { triggerHaptic('selection'); setLang(code); setOpen(false); }}
            >
              <span>{name}</span>
              {language === code && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
