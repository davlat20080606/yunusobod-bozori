import React from 'react';
import { ShoppingBag, Globe, Store, ShoppingCart, ChevronRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../services/telegram';

const T = {
  title: { uz: 'Sotuvchi', ru: 'Продавец', en: 'Seller' },
  cart: { uz: 'Savat', ru: 'Корзина', en: 'Cart' },
  cart_empty: { uz: "Savat bo'sh", ru: 'Корзина пуста', en: 'Cart is empty' },
  items: { uz: 'ta mahsulot', ru: 'товаров', en: 'items' },
  open_cart: { uz: 'Ochish', ru: 'Открыть', en: 'Open' },
  language: { uz: 'Til', ru: 'Язык', en: 'Language' },
  seller: { uz: 'Sotuvchi kabineti', ru: 'Кабинет продавца', en: 'Seller dashboard' },
  seller_hint: { uz: "Narxlar, mahsulotlar va buyurtmalar", ru: 'Цены, товары и заказы', en: 'Prices, products and orders' },
  porter: { uz: 'Aravachi kabineti', ru: 'Кабинет аравачи', en: 'Porter dashboard' },
  porter_hint: { uz: "Buyurtmalarni rastalardan yig'ish", ru: 'Сбор заказов по растам', en: 'Collect orders from stalls' },
};

const LANGS = [['uz', "O'zbekcha"], ['ru', 'Русский'], ['en', 'English']];

const card = { background: '#ffffff', borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(15,23,42,0.06)' };

export default function SellerHub({ cartItemsCount, cartTotal, onOpenCart, onOpenSellerCabinet, onOpenPorter }) {
  const { language, setLang } = useLanguage();
  const t = (key) => T[key]?.[language] || T[key]?.uz || key;

  const row = (Icon, color, title, hint, onClick) => (
    <button type="button" onClick={() => { triggerHaptic('light'); onClick(); }} style={{ ...card, width: '100%', display: 'flex', alignItems: 'center', gap: 14, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{title}</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>{hint}</div>
      </div>
      <ChevronRight size={20} color="#94a3b8" style={{ flexShrink: 0 }} />
    </button>
  );

  return (
    <div className="animate-fade" style={{ maxWidth: 640, margin: '0 auto', padding: '16px 0 110px' }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 16px' }}>{t('title')}</h2>

      {/* Cart */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
          <ShoppingBag size={22} color="#059669" />
          {cartItemsCount > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: '#059669', color: '#ffffff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{cartItemsCount}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{t('cart')}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {cartItemsCount > 0 ? `${cartItemsCount} ${t('items')} · ${Math.round(cartTotal).toLocaleString()} UZS` : t('cart_empty')}
          </div>
        </div>
        <button type="button" onClick={() => { triggerHaptic('medium'); onOpenCart(); }} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>
          {t('open_cart')}
        </button>
      </div>

      {/* Language */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Globe size={20} color="#2563eb" />
          <span style={{ fontSize: 16, fontWeight: 800 }}>{t('language')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {LANGS.map(([code, name]) => (
            <button
              key={code}
              type="button"
              onClick={() => { triggerHaptic('selection'); setLang(code); }}
              style={{
                padding: '12px 4px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                border: language === code ? '2px solid #059669' : '1.5px solid #e2e8f0',
                background: language === code ? '#ecfdf5' : '#ffffff',
                color: language === code ? '#047857' : '#334155'
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {row(Store, '#059669', t('seller'), t('seller_hint'), onOpenSellerCabinet)}
      {row(ShoppingCart, '#d97706', t('porter'), t('porter_hint'), onOpenPorter)}
    </div>
  );
}
