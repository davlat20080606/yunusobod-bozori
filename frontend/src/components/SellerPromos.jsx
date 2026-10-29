import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';
import { promoLabel } from '../services/offers';

// A stall's offers for big orders: discount, free taxi or a gift
export default function SellerPromos({ language }) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState({ kind: 'free_taxi', min_amount: '400000', percent: '5', gift_text: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.sellerPromos().then(setPromos).catch(() => {}); }, []);

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const promo = await api.sellerAddPromo({
        kind: form.kind,
        min_amount: Number(String(form.min_amount).replace(/\D/g, '')),
        percent: form.kind === 'discount' ? Number(form.percent) : null,
        gift_text: form.kind === 'gift' ? form.gift_text : null,
      });
      setPromos((prev) => [...prev, promo].sort((a, b) => a.min_amount - b.min_amount));
      setForm((f) => ({ ...f, gift_text: '' }));
      triggerHaptic('success');
    } catch (e) {
      setError(e.message);
      triggerHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(tr("Aksiyani o'chiramizmi?", 'Удалить акцию?', 'Delete this offer?'))) return;
    await api.sellerDeletePromo(id).catch(() => {});
    setPromos((prev) => prev.filter((p) => p.id !== id));
  };

  const input = { height: 44, borderRadius: 12, border: '1.5px solid #e2e8f0', padding: '0 12px', fontSize: 15, minWidth: 0, boxSizing: 'border-box', background: '#ffffff' };
  const kinds = [
    ['free_taxi', tr('🚕 Bepul taksi', '🚕 Бесплатное такси', '🚕 Free taxi')],
    ['discount', tr('🏷 Chegirma %', '🏷 Скидка %', '🏷 Discount %')],
    ['gift', tr("🎁 Sovg'a", '🎁 Подарок', '🎁 Gift')],
  ];

  return (
    <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>🎁 {tr('Aksiyalar', 'Акции', 'Offers')}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
        {tr(
          "Xaridor sizdan shu summadan ko'p olsa, bonus avtomatik qo'shiladi. Bir buyurtmaga bitta taksi: bir nechta rasta bersa, narxini teng bo'lishasiz.",
          'Если покупатель берёт у вас на эту сумму, бонус добавится сам. Одно такси на заказ: если его дают несколько раст, цену делите поровну.',
          'When a customer buys this much from you, the bonus is added automatically. One taxi per order: if several stalls offer it, you split its cost.'
        )}
      </p>

      {promos.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{promoLabel(p, lang)}</span>
          <button type="button" onClick={() => remove(p.id)} aria-label="delete" style={{ width: 36, height: 36, border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={16} /></button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 8px' }}>
        {kinds.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setForm((f) => ({ ...f, kind: id }))} style={{ padding: '8px 12px', borderRadius: 999, border: form.kind === id ? '2px solid #059669' : '1.5px solid #e2e8f0', background: form.kind === id ? '#ecfdf5' : '#ffffff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: form.kind === 'free_taxi' ? '1fr auto' : '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <label style={{ fontSize: 12, color: '#64748b', minWidth: 0 }}>
          {tr('Summadan (so\'m)', 'От суммы (сум)', 'From (UZS)')}
          <input inputMode="numeric" value={form.min_amount} onChange={(e) => setForm((f) => ({ ...f, min_amount: e.target.value }))} style={{ ...input, width: '100%', display: 'block', marginTop: 4 }} />
        </label>
        {form.kind === 'discount' && (
          <label style={{ fontSize: 12, color: '#64748b', minWidth: 0 }}>
            %
            <input inputMode="numeric" value={form.percent} onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))} style={{ ...input, width: '100%', display: 'block', marginTop: 4 }} />
          </label>
        )}
        {form.kind === 'gift' && (
          <label style={{ fontSize: 12, color: '#64748b', minWidth: 0 }}>
            {tr("Sovg'a", 'Подарок', 'Gift')}
            <input value={form.gift_text} maxLength={150} placeholder={tr('1 kg sabzi', '1 кг моркови', '1 kg carrots')} onChange={(e) => setForm((f) => ({ ...f, gift_text: e.target.value }))} style={{ ...input, width: '100%', display: 'block', marginTop: 4 }} />
          </label>
        )}
        <button type="button" onClick={add} disabled={busy} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          + {tr("Qo'shish", 'Добавить', 'Add')}
        </button>
      </div>
      {error && <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>}
    </div>
  );
}
