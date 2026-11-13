import React from 'react';
import ProductCard from './ProductCard';
import { useLanguage } from '../i18n/LanguageContext';
import { stallLabel } from '../services/stall';

// Uzbek is typed with many kinds of apostrophe (o' oʻ o‘ o`), Russian with е or ё: all count as the same letter
export function normalize(text) {
  return String(text || '').toLowerCase().replace(/[ʻʼ‘’`´']/g, "'").replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

const productText = (p) => normalize([p.name_uz, p.name_ru, p.name_en, p.description_uz, p.description_ru].join(' '));
const storeText = (s) => normalize([s.name_uz, s.name_ru, s.name_en, s.owner_name, s.stall_number].join(' '));

export function searchBazaar(query, products, stores) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return { products: [], stores: [] };
  const hit = (text) => words.every((w) => text.includes(w));
  const foundStores = stores.filter((s) => hit(storeText(s)));
  const storeIds = new Set(foundStores.map((s) => s.id));
  // A product matches by its own name, or because its stall matched («Karen» shows Karen's meat)
  const foundProducts = products.filter((p) => hit(productText(p)) || storeIds.has(p.store_id));
  return { products: foundProducts, stores: foundStores };
}

const T = {
  found: { uz: 'Topildi', ru: 'Найдено', en: 'Found' },
  stalls: { uz: 'Rastalar', ru: 'Расты', en: 'Stalls' },
  products: { uz: 'Mahsulotlar', ru: 'Товары', en: 'Products' },
  none: { uz: "Hech narsa topilmadi", ru: 'Ничего не найдено', en: 'Nothing found' },
  none_hint: { uz: "Boshqacha yozib ko'ring: masalan «olma» yoki «go'sht»", ru: 'Попробуйте по-другому: например «яблоко» или «мясо»', en: 'Try another word, e.g. «apple» or «meat»' },
  clear: { uz: 'Qidiruvni tozalash', ru: 'Очистить поиск', en: 'Clear search' },
};

export default function SearchResults({ query, products, stores, onClear, onSelectStore, onAddToCart, onOpenMediaModal, savedProductIds, onToggleSave }) {
  const { language, getLocalized } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (k) => T[k][lang];
  const found = searchBazaar(query, products, stores);

  if (!found.products.length && !found.stores.length) {
    return (
      <div data-testid="search-results" className="med-no-products py-12 text-center animate-fade">
        <div className="text-4xl mb-3">🔍</div>
        <h4 className="text-base font-extrabold text-slate-900 mb-1">{t('none')}</h4>
        <p style={{ fontSize: 13, color: '#64748b' }}>{t('none_hint')}</p>
        <button type="button" onClick={onClear} className="med-carousel-cta mt-4">{t('clear')}</button>
      </div>
    );
  }

  return (
    <div data-testid="search-results" className="animate-fade pb-20 pt-2">
      <div style={{ fontSize: 13, color: '#64748b', margin: '4px 2px 10px' }}>
        {t('found')}: <b style={{ color: '#0f172a' }}>{found.products.length}</b>
      </div>
      {found.stores.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>🏪 {t('stalls')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {found.stores.map((s) => (
              <button key={s.id} type="button" data-testid="search-store" onClick={() => onSelectStore(s)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: 10, borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                <img src={s.avatar_url || '/img/p/da60021c8357.jpg'} alt="" width="40" height="40" style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getLocalized(s, 'name')}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>📍 {stallLabel(s.stall_number, language)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {found.products.length > 0 && (
        <>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>🛒 {t('products')}</div>
          <div className="med-products-grid">
            {found.products.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} onOpenMediaModal={onOpenMediaModal}
                isSaved={savedProductIds.includes(p.id)} onToggleSave={onToggleSave} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
