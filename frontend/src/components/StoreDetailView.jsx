import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ArrowLeft, Search } from 'lucide-react';
import ProductCard from './ProductCard';
import { triggerHaptic } from '../services/telegram';

export default function StoreDetailView({ store, products: propProducts, onBack, onAddToCart, onOpenMediaModal, savedProductIds, onToggleSave }) {
  const { getLocalized, t, language } = useLanguage();
  const [storeSearch, setStoreSearch] = useState('');

  // Use store.products if passed, else propProducts
  const allProducts = propProducts || store.products || [];

  const filteredProducts = allProducts.filter(p => {
    if (!storeSearch) return true;
    const term = storeSearch.toLowerCase();
    return (
      (p.name_uz && p.name_uz.toLowerCase().includes(term)) ||
      (p.name_ru && p.name_ru.toLowerCase().includes(term)) ||
      (p.name_en && p.name_en.toLowerCase().includes(term))
    );
  });

  const backLabel = language === 'ru' ? 'Все магазины' : (language === 'en' ? 'All Stores' : 'Barcha rastalar');
  const searchPlaceholder = language === 'ru'
    ? `Поиск в ${getLocalized(store, 'name')}...`
    : (language === 'en' ? `Search in ${getLocalized(store, 'name')}...` : `${getLocalized(store, 'name')}da qidirish...`);
  const notFoundText = language === 'ru' ? 'Товары не найдены' : (language === 'en' ? 'No products found' : 'Mahsulotlar topilmadi');
  const notFoundSub = language === 'ru' ? 'Попробуйте другой запрос' : (language === 'en' ? 'Try a different search' : 'Boshqa so\'z kiriting');
  const openText = language === 'ru' ? 'Открыт' : (language === 'en' ? 'Open' : 'Ochiq');
  const closedText = language === 'ru' ? 'Закрыт' : (language === 'en' ? 'Yopiq' : 'Yopiq');
  const productsLabel = language === 'ru' ? 'товаров' : (language === 'en' ? 'items' : 'ta mahsulot');

  return (
    <div className="animate-fade">
      {/* Top Bar with Back Button */}
      <button 
        type="button"
        onClick={() => { triggerHaptic('light'); onBack(); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: '#ffffff', border: '1px solid #e2e8f0',
          borderRadius: '12px', padding: '8px 14px',
          fontSize: '0.85rem', fontWeight: 700, color: '#1e293b',
          cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          marginBottom: '16px'
        }}
      >
        <ArrowLeft size={16} />
        <span>{backLabel}</span>
      </button>

      {/* Store Header Banner */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #064e3b, #0f766e)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          color: '#ffffff',
          marginBottom: '20px',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ height: '140px', position: 'relative' }}>
          <img 
            src={store.banner_url || "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1000&auto=format&fit=crop&q=80"} 
            alt={getLocalized(store, 'name')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }}
          />
          <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px' }}>
            <span style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
              📍 {store.stall_number}
            </span>
            <span style={{ background: store.is_open ? '#10b981' : '#ef4444', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
              {store.is_open ? openText : closedText}
            </span>
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <img 
            src={store.avatar_url || "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=150&auto=format&fit=crop&q=80"}
            alt={store.owner_name}
            style={{ width: '60px', height: '60px', borderRadius: '14px', objectFit: 'cover', border: '3px solid #ffffff', marginTop: '-38px', position: 'relative', zIndex: 2 }}
          />
          
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{getLocalized(store, 'name')}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px', flexWrap: 'wrap' }}>
              <span>👤 {store.owner_name}</span>
              <span>📞 {store.owner_phone}</span>
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>★ {store.rating?.toFixed(1)} ({store.total_orders})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Products count + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 14px' }}>
          <Search size={16} color="#94a3b8" />
          <input 
            type="text"
            placeholder={searchPlaceholder}
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            style={{ border: 'none', background: 'transparent', flex: 1, fontSize: '0.88rem', color: '#1e293b', outline: 'none' }}
          />
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '5px 12px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
          {allProducts.length} {productsLabel}
        </span>
      </div>

      {/* Product list */}
      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔍</div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b', marginBottom: '6px' }}>{notFoundText}</div>
          <div style={{ fontSize: '0.85rem' }}>{notFoundSub}</div>
          {storeSearch && (
            <button
              type="button"
              onClick={() => setStoreSearch('')}
              style={{ marginTop: '16px', background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '0.85rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
            >
              {language === 'ru' ? 'Сбросить поиск' : (language === 'en' ? 'Clear search' : 'Qidiruvni tozalash')}
            </button>
          )}
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onAddToCart={onAddToCart} 
              onOpenMediaModal={onOpenMediaModal}
              isSaved={savedProductIds?.includes(product.id)}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
