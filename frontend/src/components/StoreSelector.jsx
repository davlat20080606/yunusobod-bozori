import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Star, ChevronRight, User, MapPin } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { stallLabel, itemName } from '../services/stall';

export default function StoreSelector({ stores, onSelectStore }) {
  const { getLocalized, t, language } = useLanguage();

  return (
    <section className="med-stores-section">
      <div className="med-section-header">
        <div>
          <h2 className="med-section-title">
            🏪 {t('stores.title')}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
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
                src={store.banner_url || "/img/p/628eb6dfa087.jpg"} 
                alt={getLocalized(store, 'name')} 
                loading="lazy"
                className="med-store-banner-img"
              />
              <div className="med-store-stall-badge">
                📍 {stallLabel(store.stall_number, language)}
              </div>
              <div className={`med-store-open-badge ${store.is_open ? 'open' : 'closed'}`}>
                {store.is_open ? t('stores.open') : t('stores.closed')}
              </div>
            </div>

            {/* Store Body */}
            <div className="med-store-body">
              <div className="med-store-header-row">
                <img 
                  src={store.avatar_url || "/img/p/da60021c8357.jpg"} 
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
                  {store.reviews_count > 0 && (
                    <>
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      <span className="font-bold text-slate-900">{store.rating.toFixed(1)}</span>
                      <span className="text-slate-400">({store.reviews_count})</span>
                    </>
                  )}
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
