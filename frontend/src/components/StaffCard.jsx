import React, { useState } from 'react';
import { api, staffSession } from '../services/api';
import { triggerHaptic } from '../services/telegram';

// A porter or taxi driver may give a card; customers of their orders see it with a copy button (Shuhrat)
export default function StaffCard({ session, setSession, lang }) {
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));
  const saved = session?.staff?.payment_card || '';
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const me = await api.staffSetCard(value);
      const next = { ...session, staff: { ...session.staff, payment_card: me.payment_card } };
      staffSession.set(next);
      setSession(next);
      setValue(me.payment_card || '');
      setMsg(tr('Saqlandi', 'Сохранено', 'Saved'));
      triggerHaptic('success');
    } catch (err) {
      setMsg(err.message);
      triggerHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="staff-card" style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '12px 14px', marginBottom: 12 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{tr('💳 Kartam', '💳 Моя карта', '💳 My card')}</span>
          <span style={{ display: 'block', fontSize: 12, color: '#64748b', overflowWrap: 'anywhere' }}>
            {saved || tr("Kiritilmagan — xaridor faqat naqd to'laydi", 'Не указана — покупатель платит только наличными', 'Not set: customers can only pay cash')}
          </span>
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{open ? '▲' : tr("O'zgartirish", 'Изменить', 'Edit')}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <input data-testid="staff-card-input" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="8600 0000 0000 0000" maxLength={30}
            style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 16, letterSpacing: 1 }} />
          <div style={{ fontSize: 12, color: '#64748b', margin: '6px 2px 8px', lineHeight: 1.4 }}>
            {tr("Karta raqami faqat siz olgan buyurtmalarning xaridoriga ko'rinadi. Bo'sh qoldirsangiz, karta o'chadi.",
              'Номер карты видят только покупатели ваших заказов. Оставьте пустым, чтобы убрать карту.',
              'Only customers of your orders see the card. Leave it empty to remove it.')}
          </div>
          <button type="button" data-testid="staff-card-save" disabled={busy} onClick={save}
            style={{ width: '100%', height: 44, borderRadius: 12, border: 'none', background: '#0f172a', color: '#ffffff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {tr('Saqlash', 'Сохранить', 'Save')}
          </button>
          {msg && <div data-testid="staff-card-msg" style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: msg.length < 20 ? '#047857' : '#b91c1c' }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
