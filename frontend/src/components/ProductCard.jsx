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

  const discountPercent = product.old_price && product.old_price > product.price
    ? Math.round(((product.old_price - product.price) / product.old_price) * 100)
    : null;

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

  return (
    <article className="med-product-card" onClick={open} style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: 20, overflow: 'hidden', cursor: 'pointer', height: '100%', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
      {/* Photo */}
      <div style={{ position: 'relative', aspectRatio: '1 / 1', background: '#f1f5f9', overflow: 'hidden', flexShrink: 0 }}>
        <img src={product.image_url} alt={getLocalized(product, 'name')} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: unavailable ? 0.5 : 1 }} />
        {discountPercent && (
          <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 999, background: '#f97316', color: '#ffffff', fontSize: 12, fontWeight: 800 }}>−{discountPercent}%</span>
        )}
        <button type="button" onClick={toggleSave} aria-label="save" style={{ position: 'absolute', top: 8, right: 8, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Heart size={17} className={isSaved ? 'fill-rose-500 text-rose-500' : ''} color={isSaved ? '#f43f5e' : '#64748b'} fill={isSaved ? '#f43f5e' : 'none'} />
        </button>
      </div>

      {/* Price, name, weight */}
      <div style={{ padding: '10px 10px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{Math.round(product.price).toLocaleString()} {currencyLabel}</span>
          {discountPercent && <span style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'line-through' }}>{Math.round(product.old_price).toLocaleString()}</span>}
        </div>
        <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.3, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {getLocalized(product, 'name')}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          {qtyLabel(min)}{product.stall_number ? ` · ${product.stall_number}` : ''}
        </div>
      </div>

      {/* One big button */}
      <div style={{ padding: 10 }}>
        {unavailable ? (
          <div style={{ height: 44, borderRadius: 14, background: '#f1f5f9', color: '#94a3b8', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {language === 'ru' ? 'Нет в наличии' : (language === 'en' ? 'Out of stock' : "Hozir yo'q")}
          </div>
        ) : inCart ? (
          <div onClick={(e) => e.stopPropagation()} style={{ height: 44, borderRadius: 14, background: '#059669', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" onClick={remove} aria-label="minus" style={{ width: 44, height: 44, border: 'none', background: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={18} /></button>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{qtyLabel(inCart)}</span>
            <button type="button" onClick={add} aria-label="plus" style={{ width: 44, height: 44, border: 'none', background: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={18} /></button>
          </div>
        ) : (
          <button type="button" onClick={add} style={{ width: '100%', height: 44, borderRadius: 14, border: 'none', background: '#f1f5f9', color: '#0f172a', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
            <Plus size={18} /> {language === 'ru' ? 'В корзину' : (language === 'en' ? 'Add' : "Qo'shish")}
          </button>
        )}
      </div>
    </article>
  );
}
