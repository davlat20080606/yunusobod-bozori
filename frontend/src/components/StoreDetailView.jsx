import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ArrowLeft, MapPin, Phone, Star, ShoppingBag, Search } from 'lucide-react';
import ProductCard from './ProductCard';
import { triggerHaptic } from '../services/telegram';

export default function StoreDetailView({ store, onBack, onAddToCart, onOpenMediaModal }) {
  const { getLocalized, t } = useLanguage();
  const [storeSearch, setStoreSearch] = useState('');

  const products = store.products || [];
  const filteredProducts = products.filter(p => {
    if (!storeSearch) return true;
    const term = storeSearch.toLowerCase();
    return (
      (p.name_uz && p.name_uz.toLowerCase().includes(term)) ||
      (p.name_ru && p.name_ru.toLowerCase().includes(term)) ||
      (p.name_en && p.name_en.toLowerCase().includes(term))
    );
  });

  return (
    <div className="animate-fade">
      {/* Top Bar with Back Button */}
      <button 
        className="nav-btn" 
        onClick={() => {
          triggerHaptic('light');
          onBack();
        }}
        style={{ marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        <ArrowLeft size={18} />
        <span>Barcha rastalarga qaytish / Назад к растам</span>
      </button>

      {/* Store Header Banner */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #064e3b, #0f766e)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          color: '#ffffff',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ height: '140px', position: 'relative' }}>
          <img 
            src={store.banner_url || "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1000&auto=format&fit=crop&q=80"} 
            alt={getLocalized(store, 'name')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }}
          />
          <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px' }}>
            <span style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700 }}>
              📍 {store.stall_number}
            </span>
            <span style={{ background: store.is_open ? '#10b981' : '#ef4444', padding: '4px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700 }}>
              {store.is_open ? t('stores.open') : t('stores.closed')}
            </span>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <img 
            src={store.avatar_url || "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=150&auto=format&fit=crop&q=80"}
            alt={store.owner_name}
            style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover', border: '3px solid #ffffff', marginTop: '-40px', position: 'relative', zIndex: 2 }}
          />
          
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{getLocalized(store, 'name')}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: '#cbd5e1', marginTop: '4px', flexWrap: 'wrap' }}>
              <span>👤 {store.owner_name}</span>
              <span>📞 {store.owner_phone}</span>
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>★ {store.rating?.toFixed(2)} ({store.total_orders} zakaz)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search inside store */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="search-input-box" style={{ flex: 1, height: '44px' }}>
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder={`${getLocalized(store, 'name')}dan qidirish...`}
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Product list */}
      <div className="products-grid">
        {filteredProducts.map((product) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onAddToCart={onAddToCart} 
            onOpenMediaModal={onOpenMediaModal}
          />
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
          <p>Mahsulotlar topilmadi.</p>
        </div>
      )}
    </div>
  );
}
