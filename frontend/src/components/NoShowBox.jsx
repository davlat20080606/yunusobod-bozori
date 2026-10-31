import React, { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';

// «Xaridor kelmadi» for the aravachi and the taxi driver: wait at the door or the point, call, and only
// after the set time give up. Then the bag goes back to the stalls, meat and dairy first.
const T = {
  arrived: { uz: '📍 Yetib keldim', ru: '📍 Я на месте', en: "📍 I've arrived" },
  arrived_hint: { uz: "Manzilga yetganda bosing — xaridorga xabar boradi va kutish vaqti boshlanadi", ru: 'Нажмите, когда приедете — покупатель получит сообщение, начнётся время ожидания', en: 'Tap when you get there — the customer is told and the waiting time starts' },
  waiting: { uz: 'Kutilmoqda: {m} daq', ru: 'Ждёте: {m} мин', en: 'Waiting: {m} min' },
  call: { uz: "Xaridorga qo'ng'iroq", ru: 'Позвонить покупателю', en: 'Call the customer' },
  call_hint: { uz: "Xaridor kelmayaptimi? Qo'ng'iroq qiling", ru: 'Покупатель не идёт? Позвоните', en: 'Customer not coming? Call them' },
  no_show_in: { uz: "«Xaridor kelmadi» {m} daqiqadan keyin ochiladi", ru: '«Не пришёл» откроется через {m} мин', en: '«No-show» opens in {m} min' },
  no_show: { uz: '😔 Xaridor kelmadi', ru: '😔 Покупатель не пришёл', en: '😔 Customer did not come' },
  no_show_confirm: { uz: "Xaridor kelmadimi? Buyurtma rastalarga qaytariladi.", ru: 'Покупатель не пришёл? Заказ вернётся на расты.', en: 'The customer did not come? The order goes back to the stalls.' },
  return_title: { uz: '↩️ Rastalarga qaytaring', ru: '↩️ Верните на расты', en: '↩️ Take it back to the stalls' },
  return_hint: { uz: "Har bir sotuvchi «Qaytib oldim» bosadi. Go'sht va sutni birinchi qaytaring", ru: 'Каждый продавец нажмёт «Вернули». Мясо и молочку — первыми', en: 'Each seller taps «Got it back». Meat and dairy first' },
  cold: { uz: '🌡 birinchi', ru: '🌡 первым', en: '🌡 first' },
  back_at_stall: { uz: '✅ qaytdi', ru: '✅ вернули', en: '✅ back' },
  undo: { uz: '↩️ Xaridor keldi — topshiraman', ru: '↩️ Покупатель пришёл — отдам', en: '↩️ The customer came — hand it over' },
};

const minutesSince = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(`${iso}Z`).getTime()) / 60000)) : 0);
const minutesUntil = (iso) => (iso ? Math.ceil((new Date(`${iso}Z`).getTime() - Date.now()) / 60000) : 0);

const btn = { width: '100%', height: 50, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer' };

export function NoShowWait({ order, language, busy, needsArrival, onArrived, onNoShow }) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (key, m) => T[key][lang].replace('{m}', m);
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 15000); return () => clearInterval(id); }, []);

  if (!order.waiting_since) {
    if (!needsArrival) return null;
    return (
      <div>
        <button type="button" disabled={busy} onClick={onArrived} style={{ ...btn, background: '#1d4ed8', color: '#fff', opacity: busy ? 0.6 : 1 }}>{t('arrived')}</button>
        <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 6 }}>{t('arrived_hint')}</div>
      </div>
    );
  }
  const waited = minutesSince(order.waiting_since);
  const left = minutesUntil(order.no_show_allowed_at);
  const phone = (order.customer_phone || '').replace(/[^\d+]/g, '');
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1d4ed8', textAlign: 'center' }}>⏱ {t('waiting', waited)}</div>
      {waited >= 5 && <div style={{ fontSize: 13, color: '#1e3a8a', textAlign: 'center', marginTop: 4 }}>{t('call_hint')}</div>}
      <a href={`tel:${phone}`} style={{ ...btn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, background: '#ffffff', color: '#1d4ed8', border: '1.5px solid #93c5fd', textDecoration: 'none', height: 44 }}>
        <Phone size={16} /> {t('call')}
      </a>
      {left > 0 ? (
        <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 8 }}>{t('no_show_in', left)}</div>
      ) : (
        <button type="button" disabled={busy} onClick={() => window.confirm(t('no_show_confirm')) && onNoShow()} style={{ ...btn, marginTop: 8, background: '#fee2e2', color: '#b91c1c', opacity: busy ? 0.6 : 1 }}>{t('no_show')}</button>
      )}
    </div>
  );
}

export function NoShowReturn({ order, language, busy, onUndo }) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (key) => T[key][lang];
  const name = (item) => (lang !== 'uz' && item[`product_name_${lang}`]) || item.product_name;
  // Stalls with cold goods first
  const stops = [...(order.stops || [])].sort((a, b) => Number(b.items.some((i) => i.cold)) - Number(a.items.some((i) => i.cold)));
  const anyBack = stops.some((st) => st.items.some((i) => i.returned && (i.is_picked || i.seller_handed)));
  return (
    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#9a3412' }}>{t('return_title')}</div>
      <div style={{ fontSize: 13, color: '#7c2d12', margin: '4px 0 10px' }}>{t('return_hint')}</div>
      {stops.map((st) => {
        const lines = st.items.filter((i) => i.item_status !== 'missing');
        const back = lines.every((i) => i.returned);
        return (
          <div key={st.store_id} style={{ padding: '8px 0', borderTop: '1px solid #fed7aa', opacity: back ? 0.55 : 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>
              {st.stall_number} · {st[`store_name_${lang}`] || st.store_name_uz}
              {!back && lines.some((i) => i.cold) && <span style={{ color: '#b91c1c', marginLeft: 6 }}>{t('cold')}</span>}
              {back && <span style={{ color: '#047857', marginLeft: 6 }}>{t('back_at_stall')}</span>}
            </div>
            <div style={{ fontSize: 13, color: '#475569' }}>{lines.map((i) => `${name(i)} ${i.actual_quantity ?? i.quantity} ${i.unit}`).join(', ')}</div>
          </div>
        );
      })}
      {!anyBack && onUndo && (
        <button type="button" disabled={busy} onClick={onUndo} style={{ ...btn, marginTop: 10, background: '#ffffff', color: '#047857', border: '1.5px solid #86efac', opacity: busy ? 0.6 : 1 }}>{t('undo')}</button>
      )}
    </div>
  );
}
