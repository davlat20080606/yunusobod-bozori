import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, Plus, Minus, MessageCircle, ChevronRight, ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../services/telegram';
import ProductCard, { formatUnit } from './ProductCard';
import { api } from '../services/api';
import { bonusLabel, hintLabel } from '../services/offers';

// Full-screen cart like Yandex Go: items, note, "Anything else?", floating Checkout
export default function CartDrawer({ isOpen, onClose, cart, onUpdateQuantity, onClearCart, onCheckout, pickerNotes, setPickerNotes, products = [], onOpenProduct }) {
  const { getLocalized, language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const [noteOpen, setNoteOpen] = useState(false);
  const [quote, setQuote] = useState(null);

  // Stall offers reached so far and what is missing for the next one (priced as home delivery)
  const cartKey = cart.map((i) => `${i.product.id}:${i.quantity}`).join(',');
  useEffect(() => {
    if (!isOpen || !cart.length) return undefined;
    let alive = true;
    const items = cart.map((i) => ({ product_id: i.product.id, store_id: i.product.store_id, quantity: i.quantity }));
    api.quoteOrder('courier', items).then((q) => { if (alive) setQuote(q); }).catch(() => {});
    return () => { alive = false; };
  }, [isOpen, cartKey]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const cur = lang === 'ru' ? 'сум' : (lang === 'en' ? 'UZS' : "so'm");
  const itemsTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const oldTotal = cart.reduce((sum, item) => sum + (item.product.old_price && item.product.old_price > item.product.price ? item.product.old_price : item.product.price) * item.quantity, 0);
  const fmtQty = (p, q) => `${Number.isInteger(q) ? q : q.toFixed(1)} ${formatUnit(p.unit, language)}`;

  // Suggestions: first from the same stalls (one porter trip), then popular items
  const inCartIds = new Set(cart.map((i) => i.product.id));
  const storeIds = new Set(cart.map((i) => i.product.store_id));
  const suggestions = products
    .filter((p) => !inCartIds.has(p.id) && p.is_available !== false)
    .sort((a, b) => Number(storeIds.has(b.store_id)) - Number(storeIds.has(a.store_id)))
    .slice(0, 8);

  const clear = () => {
    if (window.confirm(lang === 'ru' ? 'Очистить корзину?' : (lang === 'en' ? 'Clear the cart?' : "Savatni tozalaymizmi?"))) {
      triggerHaptic('medium');
      onClearCart();
      onClose();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8500, background: '#ffffff', display: 'flex', flexDirection: 'column' }} className="animate-fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 10px', borderBottom: '1px solid #f1f5f9' }}>
        <button type="button" onClick={onClose} aria-label="back" style={{ width: 44, height: 44, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ArrowLeft size={24} /></button>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{lang === 'ru' ? 'Корзина' : (lang === 'en' ? 'Cart' : 'Savat')}</div>
          {cart.length > 0 && (
            <div style={{ fontSize: 13, color: '#64748b' }}>
              <b style={{ color: '#047857' }}>{Math.round(itemsTotal).toLocaleString()} {cur}</b>
              {oldTotal > itemsTotal && <s style={{ marginLeft: 6 }}>{Math.round(oldTotal).toLocaleString()}</s>}
              {' · 45–60 '}{lang === 'ru' ? 'мин' : (lang === 'en' ? 'min' : 'daq')}
            </div>
          )}
        </div>
        <button type="button" onClick={clear} disabled={!cart.length} aria-label="clear" style={{ width: 44, height: 44, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: cart.length ? 1 : 0.3 }}><Trash2 size={22} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '70px 24px', color: '#64748b' }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>🛒</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{lang === 'ru' ? 'Корзина пуста' : (lang === 'en' ? 'Your cart is empty' : "Savat bo'sh")}</div>
            <button type="button" onClick={onClose} style={{ marginTop: 18, padding: '14px 24px', borderRadius: 16, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
              {lang === 'ru' ? 'Открыть меню' : (lang === 'en' ? 'Open menu' : 'Menyuni ochish')}
            </button>
          </div>
        ) : (
          <>
            {/* Items */}
            <div style={{ padding: '4px 16px' }}>
              {cart.map(({ product, quantity }) => {
                const old = product.old_price && product.old_price > product.price ? product.old_price * quantity : null;
                return (
                  <div key={product.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <img src={product.image_url} alt="" onClick={() => onOpenProduct?.(product)} style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', background: '#f1f5f9', flexShrink: 0, cursor: 'pointer' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getLocalized(product, 'name')}</div>
                      {product.stall_number && <div style={{ fontSize: 12, color: '#94a3b8' }}>{product.stall_number}</div>}
                      <div style={{ fontSize: 14, marginTop: 2 }}>
                        <b style={{ color: old ? '#047857' : '#0f172a' }}>{Math.round(product.price * quantity).toLocaleString()} {cur}</b>
                        {old && <s style={{ color: '#94a3b8', marginLeft: 6, fontSize: 12 }}>{Math.round(old).toLocaleString()}</s>}
                        <span style={{ color: '#94a3b8', fontSize: 12 }}> · {fmtQty(product, quantity)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 14, height: 40, flexShrink: 0 }}>
                      <button type="button" onClick={() => { triggerHaptic('light'); onUpdateQuantity(product.id, -1); }} aria-label="minus" style={{ width: 36, height: 40, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={16} /></button>
                      <span style={{ minWidth: 34, textAlign: 'center', fontWeight: 800, fontSize: 13 }}>{Number.isInteger(quantity) ? quantity : quantity.toFixed(1)}</span>
                      <button type="button" onClick={() => { triggerHaptic('light'); onUpdateQuantity(product.id, 1); }} aria-label="plus" style={{ width: 36, height: 40, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '14px 16px 0' }}>
              <button type="button" onClick={onClose} style={{ width: '100%', height: 50, borderRadius: 16, border: 'none', background: '#f1f5f9', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                {lang === 'ru' ? 'Открыть меню' : (lang === 'en' ? 'Open menu' : 'Menyuni ochish')}
              </button>
            </div>

            {/* Note for the porter */}
            <div style={{ padding: '6px 16px 0' }}>
              <button type="button" onClick={() => setNoteOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', border: 'none', borderBottom: '1px solid #f1f5f9', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <MessageCircle size={22} color="#475569" />
                <span style={{ flex: 1, fontSize: 16 }}>
                  {pickerNotes ? pickerNotes : (lang === 'ru' ? 'Пожелания для аравачи' : (lang === 'en' ? 'Note for the porter' : 'Aravachiga izoh'))}
                </span>
                <ChevronRight size={20} color="#94a3b8" />
              </button>
              {noteOpen && (
                <textarea value={pickerNotes} onChange={(e) => setPickerNotes(e.target.value)} maxLength={500} rows={3} autoFocus
                  placeholder={lang === 'ru' ? 'Например: помидоры потвёрже, мясо без костей' : (lang === 'en' ? 'E.g. firm tomatoes, boneless meat' : "Masalan: pomidorni qattiqroq, go'sht suyaksiz")}
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 12, fontSize: 15, fontFamily: 'inherit', resize: 'none' }} />
              )}
            </div>

            {/* Anything else? */}
            {suggestions.length > 0 && (
              <div style={{ padding: '22px 0 0' }}>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '0 16px 12px' }}>{lang === 'ru' ? 'Что-нибудь ещё?' : (lang === 'en' ? 'Anything else?' : 'Yana nimadir?')}</h3>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 6px' }}>
                  {suggestions.map((p) => (
                    <div key={p.id} style={{ width: 140, flexShrink: 0 }}>
                      <ProductCard product={p} onOpenMediaModal={() => onOpenProduct?.(p)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '18px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(quote?.bonuses || []).map((b) => (
                <div key={`${b.store_id}-${b.kind}`} style={{ padding: '10px 12px', borderRadius: 14, background: '#ecfdf5', color: '#047857', fontSize: 14, fontWeight: 700, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{bonusLabel(b, lang)} · {b.stall_number}</span>
                  {b.amount > 0 && <span style={{ whiteSpace: 'nowrap' }}>−{Math.round(b.amount).toLocaleString()}</span>}
                </div>
              ))}
              {(quote?.hints || []).map((h) => (
                <div key={`${h.store_id}-${h.kind}`} style={{ padding: '10px 12px', borderRadius: 14, background: '#f0fdf4', color: '#166534', fontSize: 13, fontWeight: 600 }}>💡 {hintLabel(h, lang)}</div>
              ))}
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {lang === 'ru' ? 'Доставка домой' : (lang === 'en' ? 'Home delivery' : 'Uyga yetkazish')}: {quote ? `${Math.round(quote.delivery_fee).toLocaleString()} ${cur}` : '…'}
                {' · '}{lang === 'ru' ? 'самовывоз бесплатно' : (lang === 'en' ? 'pickup is free' : "o'zingiz olsangiz bepul")}
              </div>
            </div>
          </>
        )}
      </div>

      {cart.length > 0 && (
        <button type="button" onClick={() => { triggerHaptic('medium'); onCheckout(); }} style={{ position: 'fixed', right: 16, bottom: 'calc(20px + env(safe-area-inset-bottom))', zIndex: 8600, height: 60, padding: '0 22px', borderRadius: 30, border: 'none', background: '#059669', color: '#ffffff', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 6px 20px rgba(5,150,105,0.4)', cursor: 'pointer' }}>
          {lang === 'ru' ? 'Оформить' : (lang === 'en' ? 'Checkout' : 'Rasmiylashtirish')}
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffffff', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={18} /></span>
        </button>
      )}
    </div>
  );
}
