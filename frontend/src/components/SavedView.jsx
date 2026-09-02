import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import ProductCard from './ProductCard';
import { Heart, ShoppingBag, ArrowLeft } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function SavedView({ 
  savedProducts, 
  onAddToCart, 
  onOpenMediaModal,
  savedProductIds,
  onToggleSave,
  onBackToMarket 
}) {
  const { t } = useLanguage();

  if (!savedProducts || savedProducts.length === 0) {
    return (
      <div className="med-empty-state animate-fade">
        <div className="med-empty-icon-wrap">
          <Heart size={36} className="text-rose-400" />
        </div>
        <h3 className="med-empty-title">{t('sections.saved_empty_title')}</h3>
        <p className="med-empty-desc">{t('sections.saved_empty_desc')}</p>
        <button 
          type="button" 
          className="med-empty-cta-btn"
          onClick={() => {
            triggerHaptic('medium');
            onBackToMarket();
          }}
        >
          <ShoppingBag size={18} />
          <span>{t('tracker.back_to_market')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="med-saved-page animate-fade">
      <div className="med-page-header">
        <button 
          type="button" 
          className="med-back-link"
          onClick={onBackToMarket}
        >
          <ArrowLeft size={18} />
          <span>{t('tracker.back_to_market')}</span>
        </button>
        <h2 className="med-page-title">
          ❤️ {t('sections.saved_title')} ({savedProducts.length})
        </h2>
      </div>

      <div className="med-products-grid">
        {savedProducts.map((prod) => (
          <ProductCard 
            key={prod.id}
            product={prod}
            onAddToCart={onAddToCart}
            onOpenMediaModal={onOpenMediaModal}
            isSaved={true}
            onToggleSave={onToggleSave}
          />
        ))}
      </div>
    </div>
  );
}
