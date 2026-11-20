import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const T = {
  title: { uz: 'Xush kelibsiz, aziz mehmon!', ru: 'Добро пожаловать, дорогой гость!', en: 'Welcome, dear guest!' },
  sub: {
    uz: "Aravachi eng yaxshisini rastadan o'zi tanlab olib keladi",
    ru: 'Аравачи сам выберет лучшее на растах и принесёт',
    en: 'A porter picks the best at the stalls and brings it to you',
  },
};

// «O'zbek naqshi» greeting at the top of the home screen: lapis tile, gold girih pattern, Lora heading
export default function WelcomeHero() {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  return (
    <section
      data-testid="welcome-hero"
      style={{
        marginTop: 14, borderRadius: 24, padding: '20px 18px', color: '#ffffff',
        background: 'var(--naqsh-blue) var(--naqsh-pattern)', border: '2px solid var(--naqsh-gold)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ margin: 0, fontFamily: "'Lora', Georgia, serif", fontSize: 'clamp(21px, 6vw, 26px)', fontWeight: 700, lineHeight: 1.15 }}>
          {T.title[lang]}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#d6e0ec', lineHeight: 1.4 }}>{T.sub[lang]}</p>
      </div>
      <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--naqsh-gold)', background: 'var(--naqsh-turq)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e9c46a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 7h14l-1.5 10h-11z" /><path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
      </div>
    </section>
  );
}
