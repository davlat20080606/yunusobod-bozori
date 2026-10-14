import React, { useEffect, useRef, useState } from 'react';
import { X, Minus, Plus, Heart, ChevronRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useCart } from '../context/CartContext';
import { triggerHaptic } from '../services/telegram';
import ProductCard, { formatUnit } from './ProductCard';

// Yandex Go style product sheet: slides up over the shop, choose amount, "Add"
export default function ProductSheet({ product, store, categoryName, otherProducts = [], isSaved, onToggleSave, onClose, onOpenStore, onSelectProduct, savedProductIds = [] }) {
  const { getLocalized, language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const cartApi = useCart();
  const step = product.step_weight || 0.5;
  const min = product.min_weight || step;
  const inCart = cartApi.quantityOf(product.id);
  const [qty, setQty] = useState(inCart || min);
  const [showAll, setShowAll] = useState(false);

  const scrollRef = useRef(null);
  useEffect(() => {
    setQty(cartApi.quantityOf(product.id) || min);
    setShowAll(false);
    // Opening another product from the list starts at its photo
    scrollRef.current?.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // Lock the page behind the sheet
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // 1) same kind (an apple -> fruit): the owner's first, then other sellers'
  // 2) "Boshqa mahsulotlar tanlovi": everything else, the owner's goods first
  const others = otherProducts
    .filter((p) => p.id !== product.id && p.is_available !== false)
    .map((p, index) => ({ p, index }));
  const byOwnerFirst = (a, b) => Number(b.p.store_id === product.store_id) - Number(a.p.store_id === product.store_id) || a.index - b.index;
  const sameKind = others.filter(({ p }) => p.category_slug === product.category_slug).sort(byOwnerFirst).map(({ p }) => p);
  const rest = others.filter(({ p }) => p.category_slug !== product.category_slug).sort(byOwnerFirst).map(({ p }) => p);

  const unit = formatUnit(product.unit, language);
  const cur = lang === 'ru' ? 'сум' : (lang === 'en' ? 'UZS' : "so'm");
  const fmtQty = (q) => `${Number.isInteger(q) ? q : q.toFixed(1)} ${unit}`;
  const price = Math.round(product.price * qty);
  const oldPrice = product.old_price && product.old_price > product.price ? Math.round(product.old_price * qty) : null;
  const discount = product.old_price && product.old_price > product.price ? Math.round(product.old_price - product.price) : null;
  const description = getLocalized(product, 'description') || product.description_uz || '';
  const unavailable = product.is_available === false;

  const change = (dir) => {
    triggerHaptic('light');
    setQty((q) => Math.max(min, +(q + dir * step).toFixed(2)));
  };

  const confirm = () => {
    triggerHaptic('success');
    cartApi.set(product, qty);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-fade" style={{ width: '100%', maxWidth: 640, maxHeight: '94vh', background: '#f8fafc', borderRadius: '28px 28px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
          {/* Photo */}
          <div style={{ position: 'relative', background: '#ffffff', borderRadius: '0 0 28px 28px', paddingBottom: 16 }}>
            <div style={{ position: 'relative', aspectRatio: '1 / 0.85', overflow: 'hidden' }}>
              <img src={product.image_url} alt={getLocalized(product, 'name')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <button type="button" onClick={onClose} aria-label="close" style={{ position: 'absolute', top: 14, right: 14, width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={22} />
            </button>
            <button type="button" onClick={() => { triggerHaptic('selection'); onToggleSave?.(product.id); }} aria-label="save" style={{ position: 'absolute', top: 14, left: 14, width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Heart size={20} color={isSaved ? '#f43f5e' : '#64748b'} fill={isSaved ? '#f43f5e' : 'none'} />
            </button>

            <div style={{ padding: '14px 16px 0' }}>
              {discount && (
                <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 8, background: '#059669', color: '#ffffff', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                  −{discount.toLocaleString()} {cur}
                </span>
              )}
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.25 }}>{getLocalized(product, 'name')}</h2>
              {description && (
                <p style={{ fontSize: 15, color: '#334155', margin: 0, lineHeight: 1.45, display: showAll ? 'block' : '-webkit-box', WebkitLineClamp: showAll ? 'none' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {description}
                </p>
              )}
              {description.length > 120 && !showAll && (
                <button type="button" onClick={() => setShowAll(true)} style={{ border: 'none', background: 'none', color: '#64748b', padding: '4px 0 0', fontSize: 14, cursor: 'pointer' }}>
                  {lang === 'ru' ? 'Всё описание' : (lang === 'en' ? 'All description' : "To'liq tavsif")}
                </button>
              )}
            </div>
          </div>

          {/* Seller (teacher's request: the seller's other products) */}
          {store && (
            <button type="button" onClick={() => onOpenStore?.(store)} style={{ width: 'calc(100% - 24px)', margin: '12px 12px 0', display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, border: 'none', background: '#ffffff', cursor: 'pointer', textAlign: 'left' }}>
              <img src={store.avatar_url} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#e2e8f0' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, color: '#047857', fontWeight: 700 }}>{lang === 'ru' ? 'Продавец' : (lang === 'en' ? 'Seller' : "Do'konchi")} · {store.stall_number}</span>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.owner_name} — {getLocalized(store, 'name')}</span>
              </span>
              <ChevronRight size={20} color="#94a3b8" />
            </button>
          )}

          {sameKind.length > 0 && (
            <div style={{ background: '#ffffff', borderRadius: 28, margin: '12px 0 0', padding: '18px 12px 20px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, margin: '0 4px 14px' }}>{categoryName || (lang === 'ru' ? 'Похожие товары' : (lang === 'en' ? 'Similar items' : "O'xshash mahsulotlar"))}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px 8px' }}>
                {sameKind.map((p) => (
                  <ProductCard key={p.id} compact product={p} onOpenMediaModal={() => onSelectProduct?.(p)} isSaved={savedProductIds.includes(p.id)} onToggleSave={onToggleSave} />
                ))}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div style={{ background: '#ffffff', borderRadius: 28, margin: '12px 0 0', padding: '18px 12px 20px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, margin: '0 4px 14px' }}>{lang === 'ru' ? 'Выбор других товаров' : (lang === 'en' ? 'More to choose from' : 'Boshqa mahsulotlar tanlovi')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px 8px' }}>
                {rest.map((p) => (
                  <ProductCard key={p.id} compact product={p} onOpenMediaModal={() => onSelectProduct?.(p)} isSaved={savedProductIds.includes(p.id)} onToggleSave={onToggleSave} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar: name, weight, price · [- qty +] [Add] */}
        <div style={{ background: '#ffffff', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 16px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, padding: '0 4px' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getLocalized(product, 'name')} <span style={{ color: '#94a3b8', fontWeight: 500 }}>{fmtQty(qty)}</span>
            </span>
            {oldPrice && <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through' }}>{oldPrice.toLocaleString()}</span>}
            <span style={{ fontSize: 17, fontWeight: 800, color: '#047857', whiteSpace: 'nowrap' }}>{price.toLocaleString()} {cur}</span>
          </div>
          {unavailable ? (
            <div style={{ height: 56, borderRadius: 18, background: '#f1f5f9', color: '#94a3b8', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {lang === 'ru' ? 'Нет в наличии' : (lang === 'en' ? 'Out of stock' : "Hozir yo'q")}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 18, height: 56 }}>
                <button type="button" onClick={() => change(-1)} disabled={qty <= min} aria-label="minus" style={{ width: 48, height: 56, border: 'none', background: 'none', cursor: 'pointer', opacity: qty <= min ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={20} /></button>
                <span style={{ minWidth: 56, textAlign: 'center', fontWeight: 800, fontSize: 16 }}>{fmtQty(qty)}</span>
                <button type="button" onClick={() => change(1)} aria-label="plus" style={{ width: 48, height: 56, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={20} /></button>
              </div>
              <button type="button" onClick={confirm} style={{ flex: 1, height: 56, borderRadius: 18, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 17, cursor: 'pointer' }}>
                {inCart
                  ? (lang === 'ru' ? 'Готово' : (lang === 'en' ? 'Done' : 'Tayyor'))
                  : (lang === 'ru' ? 'Добавить' : (lang === 'en' ? 'Add' : "Qo'shish"))}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
