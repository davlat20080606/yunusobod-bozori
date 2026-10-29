import React, { useState } from 'react';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';
import { formatUnit } from './ProductCard';
import { fulfillmentLabel, bonusLabel } from '../services/offers';
import { statusTitle } from './OrderTracker';
import { stallLabel, itemName } from '../services/stall';

// One order in the seller cabinet: their items, gifts to add, and the "Ready" / "Handed over" confirmations
export default function SellerOrderBody({ order, language, onChanged }) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const mode = order.fulfillment || 'courier';
  const items = order.items || [];
  const ready = items.length > 0 && items.every((i) => i.seller_ready);
  const handed = items.length > 0 && items.every((i) => i.seller_handed);
  const closed = ['delivered', 'cancelled'].includes(order.status);
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
        {items.map((item) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
            <span>{item.seller_handed ? '✅' : (item.seller_ready ? '📦' : '•')} {itemName(item, lang)} — {item.quantity} {formatUnit(item.unit, language)}</span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{Math.round(item.total_price).toLocaleString()}</span>
          </div>
        ))}
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
