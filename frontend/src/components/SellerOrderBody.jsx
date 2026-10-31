import React, { useState } from 'react';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';
import { formatUnit } from './ProductCard';
import { fulfillmentLabel, bonusLabel, weightRange, weightOk } from '../services/offers';
import { statusTitle } from './OrderTracker';
import { stallLabel, itemName } from '../services/stall';

// One order in the seller cabinet: their items, gifts to add, and the "Ready" / "Handed over" confirmations
export default function SellerOrderBody({ order, language, onChanged }) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [weightValue, setWeightValue] = useState('');

  const mode = order.fulfillment || 'courier';
  const items = order.items || [];
  const ready = items.length > 0 && items.every((i) => i.seller_ready);
  const handed = items.length > 0 && items.every((i) => i.seller_handed);
  const closed = ['delivered', 'cancelled', 'no_show', 'returned'].includes(order.status);
  // After a no-show: goods that left the stall come back, the seller confirms it
  const awayLines = items.filter((i) => i.item_status !== 'missing' && !i.returned);
  const toReturn = order.status === 'no_show' && awayLines.length > 0;
  // For a porter order the seller hands over only once an aravachi has taken it
  const canHand = mode === 'self' || Boolean(order.porter_name);
  const gifts = (order.bonuses || []).filter((b) => b.kind === 'gift');
  const costs = (order.bonuses || []).filter((b) => b.amount > 0);
  const cur = tr("so'm", 'сум', 'UZS');

  const run = async (call) => {
    setBusy(true);
    setError('');
    try {
      await call();
      triggerHaptic('success');
      await onChanged?.();
    } catch (e) {
      setError(e.message);
      triggerHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  const smallBtn = { flex: 1, height: 36, borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
  const btn = { flex: 1, height: 46, borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer' };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <strong>#{order.order_number}</strong>
        <span style={{ color: '#059669', fontWeight: 700, fontSize: 13, textAlign: 'right' }}>{statusTitle(order.status, language)}</span>
      </div>
      <div style={{ fontSize: 13, color: '#334155', fontWeight: 700, marginBottom: 4 }}>
        {fulfillmentLabel(mode, lang)}{order.porter_name ? ` · 🛒 ${order.porter_name}` : ''}
      </div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>👤 {order.customer_name} · {order.customer_phone}</div>

      <div style={{ background: 'var(--bg-subtle)', padding: 10, borderRadius: 8, fontSize: 14, marginBottom: 10 }}>
        {items.map((item) => {
          const missing = item.item_status === 'missing';
          const weighed = item.actual_quantity != null && !missing;
          return (
            <div key={item.id} style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ textDecoration: missing ? 'line-through' : 'none', color: missing ? '#b91c1c' : 'inherit' }}>
                  {missing ? '❌' : (item.seller_handed ? '✅' : (item.seller_ready ? '📦' : '•'))} {itemName(item, lang)} — {item.quantity} {formatUnit(item.unit, language)}
                  {weighed && <b style={{ color: item.weight_status === 'pending' ? '#b45309' : '#047857' }}> → ⚖️ {item.actual_quantity}{item.weight_status === 'pending' ? ` (${tr('xaridor javobi kutilmoqda', 'ждём ответ покупателя', 'waiting for the customer')})` : ''}</b>}
                </span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{Math.round(item.total_price).toLocaleString()}</span>
              </div>
              {!closed && item.price > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {!missing && (
                    <button type="button" disabled={busy} onClick={() => { setEditing(item.id); setWeightValue(String(item.actual_quantity ?? item.quantity)); }} style={smallBtn}>⚖️ {tr('Vazn', 'Вес', 'Weight')}</button>
                  )}
                  <button type="button" disabled={busy} onClick={() => run(() => api.sellerItemMissing(item.id, !missing))} style={{ ...smallBtn, color: missing ? '#047857' : '#b91c1c' }}>
                    {missing ? `↩️ ${tr('Bor ekan', 'Есть', 'Back in stock')}` : `❌ ${tr('Tugadi', 'Закончился', 'Ran out')}`}
                  </button>
                </div>
              )}
              {editing === item.id && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                  <input value={weightValue} onChange={(e) => setWeightValue(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))} inputMode="decimal" autoFocus style={{ width: 90, height: 42, borderRadius: 10, border: '2px solid #93c5fd', fontSize: 18, fontWeight: 800, textAlign: 'center' }} />
                  <span>{formatUnit(item.unit, language)}</span>
                  <button type="button" onClick={() => setEditing(null)} style={smallBtn}>✕</button>
                  <button type="button" disabled={busy || !weightOk(item.quantity, weightValue)} onClick={() => { run(() => api.sellerItemWeight(item.id, Number(weightValue))); setEditing(null); }} style={{ ...smallBtn, background: '#059669', color: '#ffffff', opacity: busy || !weightOk(item.quantity, weightValue) ? 0.5 : 1 }}>{tr('Saqlash', 'Сохранить', 'Save')}</button>
                </div>
              )}
              {editing === item.id && (
                <div style={{ fontSize: 12, marginTop: 4, fontWeight: 700, color: Number(weightValue) > 0 && !weightOk(item.quantity, weightValue) ? '#b91c1c' : '#475569' }}>
                  {Number(weightValue) > 0 && !weightOk(item.quantity, weightValue) ? '⚠️ ' : ''}
                  {tr("Ruxsat", 'Можно', 'Allowed')}: {weightRange(item.quantity).join('–')} {formatUnit(item.unit, language)} (±5%)
                  {Number(weightValue) > 0 && !weightOk(item.quantity, weightValue) ? ` — ${tr("kesib yoki qo'shib to'g'rilang", 'отрежьте или довесьте', 'trim or add to fix it')}` : ''}
                </div>
              )}
            </div>
          );
        })}
        {gifts.map((b) => (
          <div key={b.text} style={{ marginTop: 6, color: '#047857', fontWeight: 800 }}>{bonusLabel(b, lang)} — {tr("qo'shib bering", 'положите в заказ', 'add it to the order')}</div>
        ))}
      </div>

      {/* What this stall gives for its offers: its discount, or its share of the free taxi */}
      {costs.map((b) => (
        <div key={b.kind} style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
          {bonusLabel(b, lang)}: {tr('sizdan', 'с вас', 'you give')} {Math.round(b.amount).toLocaleString()} {cur}
        </div>
      ))}

      {!closed && (
        <div style={{ display: 'flex', gap: 8 }}>
          {!ready && (
            <button type="button" disabled={busy} onClick={() => run(() => api.sellerOrderReady(order.id))} style={{ ...btn, background: '#f1f5f9', color: '#0f172a', opacity: busy ? 0.6 : 1 }}>
              📦 {tr('Tayyor', 'Готово', 'Ready')}
            </button>
          )}
          {!handed && (
            <button type="button" disabled={busy || !canHand} onClick={() => run(() => api.sellerOrderHanded(order.id))} style={{ ...btn, background: '#059669', color: '#ffffff', opacity: busy || !canHand ? 0.5 : 1 }}>
              🤝 {mode === 'self' ? tr('Xaridorga berdim', 'Отдал покупателю', 'Gave to customer') : tr('Aravachiga berdim', 'Отдал аравачи', 'Gave to porter')}
            </button>
          )}
          {handed && <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, color: '#047857', padding: '12px 0' }}>✅ {tr('Topshirildi', 'Передано', 'Handed over')}</div>}
        </div>
      )}
      {toReturn && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 10 }}>
          <div style={{ fontWeight: 800, color: '#9a3412', fontSize: 14, marginBottom: 8 }}>
            ↩️ {tr("Xaridor kelmadi — mahsulot qaytariladi. Olganingizda bosing", 'Покупатель не пришёл — товар вернут. Нажмите, когда получите', 'The customer did not come — the goods are coming back. Tap when you have them')}
          </div>
          <button type="button" disabled={busy} onClick={() => run(() => api.sellerOrderReturned(order.id))} style={{ ...btn, width: '100%', background: '#ea580c', color: '#ffffff', opacity: busy ? 0.6 : 1 }}>
            ✅ {tr('Qaytib oldim', 'Вернули', 'Got it back')}
          </button>
        </div>
      )}
      {['no_show', 'returned'].includes(order.status) && !toReturn && (
        <div style={{ fontSize: 13, color: '#047857', fontWeight: 700 }}>✅ {tr("Mahsulot sizda, qoldiqqa qaytdi", 'Товар у вас, вернулся в остаток', 'The goods are with you, back in stock')}</div>
      )}
      {!closed && !canHand && !handed && (
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{tr('Aravachi kelganda bosing', 'Нажмите, когда придёт аравачи', 'Tap when the porter arrives')}</div>
      )}
      {error && <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>}

      <a href={`tel:${order.customer_phone}`} style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: '#059669', fontWeight: 700, textDecoration: 'none' }}>
        📞 {tr("Xaridorga qo'ng'iroq", 'Позвонить покупателю', 'Call the customer')}
      </a>
    </>
  );
}
