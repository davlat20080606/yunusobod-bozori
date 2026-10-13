import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, CheckCircle2, Circle, Phone, Search, AlertCircle } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api, staffSession } from '../services/api';
import { triggerHaptic } from '../services/telegram';
import StaffLogin from './StaffLogin';

const T = {
  title: { uz: 'Pattachi kabineti', ru: 'Кабинет паттачи', en: 'Fee collector' },
  today: { uz: 'Bugun', ru: 'Сегодня', en: 'Today' },
  paid: { uz: "to'ladi", ru: 'оплатили', en: 'paid' },
  collected: { uz: "Yig'ildi", ru: 'Собрано', en: 'Collected' },
  search: { uz: 'Rasta yoki sotuvchi qidirish', ru: 'Поиск расты или продавца', en: 'Search stall or seller' },
  mark: { uz: "To'ladi", ru: 'Оплатил', en: 'Paid' },
  undo: { uz: 'Bekor qilish', ru: 'Отменить', en: 'Undo' },
  undo_confirm: { uz: "To'lovni bekor qilasizmi?", ru: 'Отменить оплату?', en: 'Undo this payment?' },
  amount: { uz: 'Summa', ru: 'Сумма', en: 'Amount' },
  unpaid_first: { uz: "To'lamaganlar", ru: 'Не оплатили', en: 'Not paid' },
  paid_list: { uz: "To'laganlar", ru: 'Оплатили', en: 'Paid' },
  logout: { uz: 'Chiqish', ru: 'Выйти', en: 'Sign out' },
};

const card = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 12, marginBottom: 8 };

export default function PattachiPanel({ onBackToMarket }) {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (key) => T[key][lang];

  const [session, setSession] = useState(() => {
    const current = staffSession.get();
    return current?.staff?.role === 'pattachi' ? current : null;
  });
  const [report, setReport] = useState(null);
  const [amount, setAmount] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api.pattaToday();
      setReport(data);
      setAmount((prev) => prev || String(data.default_amount));
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        staffSession.set(null);
        setSession(null);
      } else {
        setError(err.message);
      }
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (stall) => {
    if (stall.paid && !window.confirm(t('undo_confirm'))) return;
    setBusyId(stall.store_id);
    setError('');
    try {
      if (stall.paid) await api.pattaUndo(stall.store_id);
      else await api.pattaPay(stall.store_id, Number(amount) || undefined);
      triggerHaptic(stall.paid ? 'light' : 'success');
    } catch (err) {
      triggerHaptic('error');
      setError(err.message);
    } finally {
      setBusyId(null);
      load();
    }
  };

  if (!session) {
    return <StaffLogin role="pattachi" onBack={onBackToMarket} onSignedIn={() => setSession(staffSession.get())} />;
  }

  const q = query.trim().toLowerCase();
  const stalls = (report?.stores || []).filter((s) => !q || `${s.stall_number} ${s.name_uz} ${s.owner_name}`.toLowerCase().includes(q));
  const unpaid = stalls.filter((s) => !s.paid);
  const paid = stalls.filter((s) => s.paid);

  const row = (s) => (
    <div key={s.store_id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, background: s.paid ? '#f0fdf4' : '#ffffff', borderColor: s.paid ? '#bbf7d0' : '#e2e8f0' }}>
      {s.paid ? <CheckCircle2 size={26} color="#16a34a" style={{ flexShrink: 0 }} /> : <Circle size={26} color="#cbd5e1" style={{ flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{s.stall_number}</div>
        <div style={{ fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.owner_name} · {lang === 'ru' ? s.name_ru : s.name_uz}</div>
        {s.paid && <div style={{ fontSize: 12, color: '#15803d' }}>{Math.round(s.amount).toLocaleString()} UZS · {s.collector}</div>}
      </div>
      <a href={`tel:${(s.owner_phone || '').replace(/[^\d+]/g, '')}`} aria-label="call" style={{ width: 38, height: 38, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Phone size={16} color="#475569" />
      </a>
      <button type="button" disabled={busyId === s.store_id} onClick={() => toggle(s)} style={{ padding: '10px 12px', borderRadius: 12, border: s.paid ? '1.5px solid #fecaca' : 'none', background: s.paid ? '#ffffff' : '#7c3aed', color: s.paid ? '#dc2626' : '#ffffff', fontWeight: 800, fontSize: 13, cursor: 'pointer', flexShrink: 0, opacity: busyId === s.store_id ? 0.5 : 1 }}>
        {s.paid ? t('undo') : t('mark')}
      </button>
    </div>
  );

  return (
    <div className="animate-fade" style={{ paddingTop: 12, paddingBottom: 110 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #4c1d95, #7c3aed)', color: '#ffffff', border: 'none', padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 30 }}>🧾</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t('title')}</div>
          <div style={{ fontSize: 13, color: '#ddd6fe' }}>{session.staff.name}</div>
        </div>
        <button type="button" onClick={() => { staffSession.set(null); setSession(null); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <LogOut size={14} /> {t('logout')}
        </button>
      </div>

      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{t('today')} · {report.day}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{report.paid_count} / {report.stores.length}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{t('paid')}</div>
          </div>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{t('collected')}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#6d28d9' }}>{Math.round(report.total).toLocaleString()}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>UZS</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '0 10px' }}>
          <Search size={16} color="#94a3b8" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 15, padding: '11px 0', background: 'transparent' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '0 10px', fontSize: 12, color: '#64748b' }}>
          {t('amount')}
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={{ width: 70, border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, background: 'transparent' }} />
        </label>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: 8, background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {unpaid.length > 0 && <h3 style={{ fontSize: 14, fontWeight: 800, color: '#b91c1c', margin: '4px 2px 8px' }}>{t('unpaid_first')} ({unpaid.length})</h3>}
      {unpaid.map(row)}
      {paid.length > 0 && <h3 style={{ fontSize: 14, fontWeight: 800, color: '#15803d', margin: '16px 2px 8px' }}>{t('paid_list')} ({paid.length})</h3>}
      {paid.map(row)}
    </div>
  );
}
