import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Star, ChevronRight, MapPin, User, ShoppingBag } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function StoreSelector({ stores, onSelectStore }) {
  const { getLocalized, t } = useLanguage();

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>{t('stores.title')}</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('stores.subtitle')}</p>
        </div>
      </div>

      <div className="stores-grid">
        {stores.map((store) => (
          <div 
            key={store.id} 
            className="store-card animate-fade"
            onClick={() => {
              triggerHaptic('medium');
              onSelectStore(store);
            }}
          >
            <div className="store-banner-wrap">
              <img 
                src={store.banner_url || "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=600&auto=format&fit=crop&q=80"} 
                alt={getLocalized(store, 'name')} 
                loading="lazy"
              />
              <div className="store-stall-badge">
                📍 {store.stall_number}
              </div>
              <div className={`store-open-badge ${store.is_open ? 'open' : 'closed'}`}>
                {store.is_open ? t('stores.open') : t('stores.closed')}
              </div>
            </div>

            <div className="store-body">
              <div className="store-header-row">
                <img 
                  src={store.avatar_url || "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=120&auto=format&fit=crop&q=80"} 
                  alt={store.owner_name}
                  className="store-avatar"
                />
                <div className="store-title-wrap">
                  <h3>{getLocalized(store, 'name')}</h3>
                  <div className="store-owner-label">
                    <User size={13} style={{ display: 'inline', marginRight: '3px' }} />
                    {store.owner_name}
                  </div>
                </div>
              </div>

              <p className="store-desc">{getLocalized(store, 'description')}</p>

              <div className="store-footer">
                <div className="rating-badge">
                  <Star size={15} fill="#f59e0b" color="#f59e0b" />
                  <span>{store.rating.toFixed(2)}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 400 }}>({store.total_orders})</span>
                </div>

                <div className="enter-store-btn">
                  <span>{t('stores.enter_store')}</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
