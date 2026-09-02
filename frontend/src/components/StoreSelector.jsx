import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Star, ChevronRight, User, MapPin } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function StoreSelector({ stores, onSelectStore }) {
  const { getLocalized, t } = useLanguage();

  return (
    <section className="med-stores-section">
      <div className="med-section-header">
        <div>
          <h2 className="med-section-title">
            🏪 {t('stores.title')}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {t('stores.subtitle')}
          </p>
        </div>
      </div>

      <div className="med-stores-grid">
        {stores.map((store) => (
          <div 
            key={store.id} 
            className="med-store-card animate-fade"
            onClick={() => {
              triggerHaptic('medium');
              onSelectStore(store);
            }}
          >
            {/* Store Banner Image */}
            <div className="med-store-banner-wrap">
              <img 
                src={store.banner_url || "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=600&auto=format&fit=crop&q=80"} 
                alt={getLocalized(store, 'name')} 
                loading="lazy"
                className="med-store-banner-img"
              />
              <div className="med-store-stall-badge">
                📍 {store.stall_number}
              </div>
              <div className={`med-store-open-badge ${store.is_open ? 'open' : 'closed'}`}>
                {store.is_open ? t('stores.open') : t('stores.closed')}
              </div>
            </div>

            {/* Store Body */}
            <div className="med-store-body">
              <div className="med-store-header-row">
                <img 
                  src={store.avatar_url || "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=120&auto=format&fit=crop&q=80"} 
                  alt={store.owner_name}
                  className="med-store-avatar"
                />
                <div className="med-store-title-wrap">
                  <h3 className="med-store-name">{getLocalized(store, 'name')}</h3>
                  <div className="med-store-owner">
                    <User size={13} />
                    <span>{store.owner_name}</span>
                  </div>
                </div>
              </div>

              <p className="med-store-desc">{getLocalized(store, 'description')}</p>

              <div className="med-store-footer">
                <div className="med-store-rating">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span className="font-bold text-slate-900">{store.rating.toFixed(1)}</span>
                  <span className="text-slate-400">({store.total_orders})</span>
                </div>

                <div className="med-enter-store-btn">
                  <span>{t('stores.enter_store')}</span>
                  <ChevronRight size={15} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
