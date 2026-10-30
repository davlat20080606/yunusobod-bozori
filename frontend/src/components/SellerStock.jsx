import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';
import { formatUnit } from './ProductCard';

// The morning list: what is at the stall today and roughly how much. One screen, about 30 seconds.
// An empty amount means "not counted": the product is sold while it is marked as here.
export default function SellerStock({ language, products = [], onSaved }) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));
  const [rows, setRows] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    setRows(Object.fromEntries(products.map((p) => [p.id, {
      available: p.is_available,
      quantity: p.track_stock ? String(p.stock_quantity) : '',
    }])));
  }, [products]);

  // Opened from the bot's morning message: go straight to the list
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('stock') === '1') {
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    }
  }, []);

  const change = (id, patch) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const updated = await api.sellerStock(products.map((p) => {
        const row = rows[p.id] || {};
        const quantity = String(row.quantity ?? '').replace(',', '.').trim();
        return {
          product_id: p.id,
          is_available: Boolean(row.available),
          quantity: quantity === '' ? null : Number(quantity),
          low_stock_alert: p.low_stock_alert ?? null,
        };
      }));
      onSaved?.(updated);
      triggerHaptic('success');
      setNotice(tr('Saqlandi', 'Сохранено', 'Saved'));
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      triggerHaptic('error');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} id="stock" style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 20, scrollMarginTop: 80 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>📦 {tr('Bugungi qoldiq', 'Остатки на сегодня', "Today's stock")}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
        {tr(
          "Nima bor va taxminan qancha. Miqdor yozilsa, buyurtmalar shundan oshmaydi va tugaganda mahsulot o'zi yopiladi. Bo'sh qoldirsangiz — sanalmaydi.",
          'Что есть и примерно сколько. Если указать количество, заказы не превысят его, а когда закончится — товар закроется сам. Пусто — не считаем.',
          'What you have and roughly how much. With an amount, orders never go over it and the product closes itself when it runs out. Empty — not counted.'
        )}
      </p>

      {products.map((p) => {
        const row = rows[p.id] || {};
        const unit = formatUnit(p.unit, language);
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #f1f5f9', opacity: row.available ? 1 : 0.55 }}>
            <button type="button" onClick={() => change(p.id, { available: !row.available })} aria-label="available" style={{ width: 52, height: 32, flexShrink: 0, borderRadius: 16, border: 'none', background: row.available ? '#059669' : '#e2e8f0', position: 'relative', cursor: 'pointer' }}>
              <span style={{ position: 'absolute', top: 3, left: row.available ? 23 : 3, width: 26, height: 26, borderRadius: '50%', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.15s' }} />
            </button>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p[`name_${lang}`] || p.name_uz}</span>
              <span style={{ display: 'block', fontSize: 12, color: p.stock_reserved > 0 ? '#b45309' : '#64748b' }}>
                {!row.available ? tr("Bugun yo'q", 'Сегодня нет', 'Not today')
                  : p.stock_reserved > 0 ? tr(`Buyurtmalarda: ${p.stock_reserved} ${unit}`, `В заказах: ${p.stock_reserved} ${unit}`, `In orders: ${p.stock_reserved} ${unit}`)
                    : tr('Bor', 'Есть', 'Here')}
              </span>
            </span>
            <input
              value={row.quantity ?? ''}
              onChange={(e) => change(p.id, { quantity: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })}
              inputMode="decimal"
              disabled={!row.available}
              placeholder="—"
              aria-label="quantity"
              style={{ width: 72, height: 40, borderRadius: 10, border: '1.5px solid #e2e8f0', textAlign: 'center', fontSize: 16, fontWeight: 700 }}
            />
            <span style={{ width: 44, fontSize: 13, color: '#475569' }}>{unit}</span>
          </div>
        );
      })}

      <button type="button" onClick={save} disabled={busy} style={{ width: '100%', height: 48, marginTop: 10, borderRadius: 12, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {tr('Saqlash', 'Сохранить', 'Save')}
      </button>
      {notice && <div style={{ marginTop: 8, color: '#047857', fontSize: 13, fontWeight: 700 }}>✅ {notice}</div>}
      {error && <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>}
    </div>
  );
}
