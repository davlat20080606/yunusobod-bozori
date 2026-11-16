import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { getTelegramInitData, triggerHaptic } from '../services/telegram';
import { TERMS_VERSION, WARNING, TERMS } from '../services/terms';

const KEY = 'terms_accepted';

function readLocal() {
  try { return localStorage.getItem(KEY) === TERMS_VERSION; } catch { return false; }
}

function saveLocal() {
  try { localStorage.setItem(KEY, TERMS_VERSION); } catch {}
}

// The full rules (?tab=terms), also opened from the bot's «To'liq qoidalar» button
export function TermsPage({ onBack }) {
  const { language } = useLanguage();
  const doc = TERMS[language] || TERMS.uz;
  return (
    <div className="animate-fade" data-testid="terms-page" style={{ maxWidth: 720, margin: '0 auto', padding: '12px 0 110px' }}>
      <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#047857', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: '0 0 12px' }}>
        <ArrowLeft size={18} /> {language === 'ru' ? 'Назад' : (language === 'en' ? 'Back' : 'Orqaga')}
      </button>
      <div style={{ background: '#ffffff', borderRadius: 20, padding: '20px 18px', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 4px', color: '#0f172a', lineHeight: 1.25 }}>{doc.title}</h2>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{doc.updated}</div>
        {doc.sections.map(([heading, paragraphs]) => (
          <section key={heading} style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px', color: '#0f172a' }}>{heading}</h3>
            {paragraphs.map((p) => (
              <p key={p} style={{ fontSize: 14, color: '#334155', lineHeight: 1.55, margin: '0 0 8px' }}>{p}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

// «DIQQAT!» once per person and rules version; nothing else can be used until it is accepted
export function TermsGate({ hidden, onReadAll }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(() => !readLocal());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !getTelegramInitData()) return;
    // Accepted in the bot or on another phone: do not ask again
    api.termsStatus().then((r) => { if (r.accepted) { saveLocal(); setOpen(false); } }).catch(() => {});
  }, []);

  if (!open || hidden) return null;
  const w = WARNING[language] || WARNING.uz;
  const agree = async () => {
    setBusy(true);
    triggerHaptic('success');
    try { await api.termsAccept(language); } catch {}
    saveLocal();
    setOpen(false);
    setBusy(false);
  };
  return (
    <div data-testid="terms-gate" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', background: '#ffffff', borderRadius: '24px 24px 0 0', padding: '22px 18px calc(18px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#b45309', marginBottom: 10 }}>{w.title}</div>
        <p style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.5, margin: '0 0 10px' }}>{w.intro}</p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
          {w.points.map((p) => <li key={p} style={{ fontSize: 14, color: '#334155', lineHeight: 1.5, marginBottom: 6 }}>{p}</li>)}
        </ul>
        <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.45, margin: '0 0 14px' }}>{w.note}</p>
        <button type="button" data-testid="terms-read" onClick={onReadAll} style={{ width: '100%', height: 46, marginBottom: 10, borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#ffffff', color: '#0f172a', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          {w.read}
        </button>
        <button type="button" data-testid="terms-agree" disabled={busy} onClick={agree} style={{ width: '100%', height: 54, borderRadius: 16, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 17, cursor: 'pointer' }}>
          {w.agree}
        </button>
      </div>
    </div>
  );
}
