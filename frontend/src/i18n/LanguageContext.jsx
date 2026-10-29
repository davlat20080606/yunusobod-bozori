import React, { createContext, useContext, useState, useEffect } from 'react';
import uz from './uz.json';
import ru from './ru.json';
import en from './en.json';

const translations = { uz, ru, en };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const known = (value) => ['uz', 'ru', 'en'].includes(value);
    // 1. The bot opens the app with ?lang=… (the language picked in the chat); remember it,
    //    so buttons in order messages and later visits open in the same language
    try {
      const urlLang = new URLSearchParams(window.location.search).get('lang');
      if (known(urlLang)) {
        try { localStorage.setItem('yunusobod_lang', urlLang); } catch {}
        return urlLang;
      }
    } catch {}

    // 2. The language chosen before
    try {
      const saved = localStorage.getItem('yunusobod_lang');
      if (known(saved)) return saved;
    } catch {}

    // 3. First visit: the language of the person's Telegram app
    const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || '';
    if (tgLang.startsWith('ru')) return 'ru';
    if (tgLang.startsWith('en')) return 'en';
    return 'uz';
  });

  // Tell the browser which language the page is really in
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (newLang) => {
    if (['uz', 'ru', 'en'].includes(newLang)) {
      setLangState(newLang);
      try { localStorage.setItem('yunusobod_lang', newLang); } catch {}
    }
  };

  // Helper translation function t('hero.title')
  const t = (path) => {
    const keys = path.split('.');
    let current = translations[lang];
    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        let fallback = translations['ru'];
        for (const fKey of keys) {
          if (fallback && fallback[fKey] !== undefined) fallback = fallback[fKey];
          else return path;
        }
        return fallback;
      }
    }
    return current;
  };

  // Helper for DB localized fields
  const cleanTitleEmojis = (text) => {
    if (typeof text !== 'string') return text;
    // Strip leading emojis and symbols (👑, 🍲, 🍢, 🥗, ☕, 🥖, 🧀, etc.)
    return text.replace(/^[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
  };

  const getLocalized = (item, fieldPrefix = 'name') => {
    if (!item) return '';
    const localizedKey = `${fieldPrefix}_${lang}`;
    let rawText = '';
    if (item[localizedKey]) {
      rawText = item[localizedKey];
    } else {
      rawText = item[`${fieldPrefix}_uz`] || item[`${fieldPrefix}_ru`] || item[`${fieldPrefix}_en`] || item[fieldPrefix] || '';
    }

    if (fieldPrefix === 'name' || fieldPrefix === 'title') {
      return cleanTitleEmojis(rawText);
    }
    return rawText;
  };

  return (
    <LanguageContext.Provider value={{ lang, language: lang, setLang, t, getLocalized }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
