import React, { useEffect } from 'react';
import AdminPanel from './AdminPanel';
import { useLanguage } from '../i18n/LanguageContext';

// Bozorkom's own page (Shuhrat, 2026-11-23): bozorbot.uz/bozorkom or the bot's «🏛 Bozorkom» buttons.
// No market around it (search, cart, bottom menu, footer) and no link to it anywhere on the site.
export default function BozorkomPage() {
  const { language, setLang } = useLanguage();
  useEffect(() => {
    document.title = 'Bozorkom · Yunusobod Dehqon Bozori';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.body.classList.add('bk-on');
    return () => { meta.remove(); document.body.classList.remove('bk-on'); };
  }, []);
  return (
    <div className="bk-page" data-testid="bozorkom-page">
      <header className="bk-head">
        <div className="bk-head-row">
          <span className="bk-mark" aria-hidden="true">🏛</span>
          <div className="bk-title">
            <strong>Bozorkom</strong>
            <small>Yunusobod Dehqon Bozori</small>
          </div>
          <div className="bk-langs" role="group" aria-label="Til · Язык · Language">
            {['uz', 'ru', 'en'].map((l) => (
              <button key={l} type="button" aria-pressed={language === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </header>
      <main className="bk-body">
        <AdminPanel />
      </main>
    </div>
  );
}
