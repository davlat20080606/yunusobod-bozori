import React, { createContext, useContext, useState, useEffect } from 'react';
import uz from './uz.json';
import ru from './ru.json';
import en from './en.json';

const translations = { uz, ru, en };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    // 1. Check URL param ?lang=...
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang');
      if (urlLang && ['uz', 'ru', 'en'].includes(urlLang)) {
        return urlLang;
      }
    } catch {}

    // 2. Check LocalStorage
    const saved = localStorage.getItem('yunusobod_lang');
    return saved && ['uz', 'ru', 'en'].includes(saved) ? saved : 'uz';
  });

  const setLang = (newLang) => {
    if (['uz', 'ru', 'en'].includes(newLang)) {
      setLangState(newLang);
      localStorage.setItem('yunusobod_lang', newLang);
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
