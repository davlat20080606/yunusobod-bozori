import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Plus, Minus, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { triggerHaptic } from '../services/telegram';

export function formatUnit(unit, language) {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();

  if (language === 'ru') {
    if (u === 'dona' || u.includes('dona') || u.includes('штук')) return 'шт.';
    if (u === 'kg' || u === 'кг') return 'кг';
    if (u.includes("bog'lam") || u.includes('boglam') || u.includes('dasta') || u.includes('пучок')) return 'пучок';
    if (u.includes("to'plam") || u.includes("to`plam") || u.includes("сет") || u.includes("set")) return 'набор';
    if (u === 'litr' || u === 'литр') return 'л.';
    return unit;
  }

  if (language === 'en') {
    if (u === 'dona' || u.includes('dona')) return 'pcs';
    if (u === 'kg') return 'kg';
    if (u.includes("bog'lam") || u.includes('boglam') || u.includes('dasta')) return 'bunch';
    if (u.includes("to'plam") || u.includes("set")) return 'set';
    if (u === 'litr') return 'L';
    return unit;
  }

  // UZ (default)
  if (u === 'kg' || u === 'кг') return 'kg';
  if (u === 'dona' || u.includes('штук')) return 'dona';
  if (u.includes("bog'lam") || u.includes('boglam') || u.includes('dasta') || u.includes('пучок')) return 'dasta';
  if (u.includes("to'plam") || u.includes("сет") || u.includes("set")) return "to'plam";
  if (u === 'litr' || u === 'литр') return 'litr';
  return unit;
}


export default function ProductCard({ 
  product, 
  onAddToCart, 
  onOpenMediaModal,
  isSaved = false,
  onToggleSave
}) {
  const { getLocalized, language } = useLanguage();
  const cartApi = useCart();

  const step = product.step_weight || 0.5;
  const min = product.min_weight || step;
  const displayUnit = formatUnit(product.unit, language);
  const inCart = cartApi ? cartApi.quantityOf(product.id) : 0;
  const currencyLabel = language === 'ru' ? 'сум' : (language === 'en' ? 'UZS' : "so'm");
  const qtyLabel = (q) => `${Number.isInteger(q) ? q : q.toFixed(1)} ${displayUnit}`;

  // One "+" like Yandex Lavka: the first tap adds the minimum, then the button becomes "− 1 kg +"
  const add = (e) => {
    e.stopPropagation();
    triggerHaptic(inCart ? 'light' : 'medium');
    if (inCart && cartApi) cartApi.update(product.id, 1);
    else if (cartApi) cartApi.add(product, min);
    else if (onAddToCart) onAddToCart(product, min);
  };
  const remove = (e) => {
    e.stopPropagation();
    triggerHaptic('light');
    cartApi?.update(product.id, -1);
  };
  const toggleSave = (e) => {
    e.stopPropagation();
    triggerHaptic('selection');
    onToggleSave?.(product.id);
  };
  const open = () => onOpenMediaModal?.(product);

  const unavailable = product.is_available === false;

  const discountSum = product.old_price && product.old_price > product.price ? Math.round(product.old_price - product.price) : null;
  const circle = { width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a' };

  return (
    <article className="med-product-card" onClick={open} style={{ display: 'flex', flexDirection: 'column', background: 'transparent', border: 'none', boxShadow: 'none', cursor: 'pointer', height: '100%' }}>
      {/* Photo with the add control on it (Yandex Go style) */}
      <div style={{ position: 'relative', aspectRatio: '1 / 1', background: '#f1f5f9', borderRadius: 22, overflow: 'hidden', flexShrink: 0 }}>
        <img src={product.image_url} alt={getLocalized(product, 'name')} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: unavailable ? 0.45 : 1 }} />
        {discountSum && (
          <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 8, background: '#059669', color: '#ffffff', fontSize: 12, fontWeight: 800 }}>−{discountSum.toLocaleString()} {currencyLabel}</span>
        )}
        <button type="button" onClick={toggleSave} aria-label="save" style={{ position: 'absolute', top: 6, right: 6, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Heart size={16} color={isSaved ? '#f43f5e' : '#64748b'} fill={isSaved ? '#f43f5e' : 'none'} />
        </button>

        {!unavailable && (inCart ? (
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 40, borderRadius: 20, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" onClick={remove} aria-label="minus" style={{ width: 40, height: 40, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={18} /></button>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{qtyLabel(inCart)}</span>
            <button type="button" onClick={add} aria-label="plus" style={{ width: 40, height: 40, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={18} /></button>
          </div>
        ) : (
          <button type="button" onClick={add} aria-label="add" style={{ ...circle, position: 'absolute', right: 8, bottom: 8 }}><Plus size={20} /></button>
        ))}
        {unavailable && (
          <span style={{ position: 'absolute', left: 8, bottom: 8, padding: '4px 10px', borderRadius: 999, background: '#ffffff', fontSize: 12, fontWeight: 700, color: '#64748b' }}>
            {language === 'ru' ? 'Нет в наличии' : (language === 'en' ? 'Out of stock' : "Hozir yo'q")}
          </span>
        )}
      </div>

      {/* Price, name, weight */}
      <div style={{ padding: '8px 4px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: discountSum ? '#047857' : '#0f172a' }}>{Math.round(product.price).toLocaleString()} {currencyLabel}</span>
          {discountSum && <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through' }}>{Math.round(product.old_price).toLocaleString()}</span>}
        </div>
        <div style={{ fontSize: 15, color: '#0f172a', lineHeight: 1.3, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {getLocalized(product, 'name')}
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
          {qtyLabel(min)}{product.stall_number ? ` · ${product.stall_number}` : ''}
        </div>
      </div>
    </article>
  );
}
