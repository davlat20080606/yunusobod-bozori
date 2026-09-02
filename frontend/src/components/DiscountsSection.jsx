import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import ProductCard from './ProductCard';
import { ChevronRight, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function DiscountsSection({ 
  products, 
  onAddToCart, 
  onOpenMediaModal,
  savedProductIds,
  onToggleSave,
  onSeeAllDiscounts
}) {
  const { t } = useLanguage();

  // Filter discounted or featured items
  const discountedProducts = products.filter(
    (p) => p.old_price || p.is_featured || p.badge
  );

  if (!discountedProducts.length) return null;

  return (
    <section className="med-discounts-section">
      <div className="med-section-header">
        <div className="flex items-center gap-2">
          <h2 className="med-section-title">
            {t('sections.discounts_title')}
          </h2>
          <span className="med-fire-badge">🔥 HOT</span>
        </div>

        <button 
          type="button" 
          className="med-see-all-link"
          onClick={() => {
            triggerHaptic('light');
            if (onSeeAllDiscounts) onSeeAllDiscounts();
          }}
        >
          <span>{t('sections.see_all')}</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Horizontal Scroll Reel with snap */}
      <div className="med-horizontal-reel">
        {discountedProducts.map((prod) => (
          <div key={prod.id} className="med-reel-item">
            <ProductCard 
              product={prod}
              onAddToCart={onAddToCart}
              onOpenMediaModal={onOpenMediaModal}
              isSaved={savedProductIds.includes(prod.id)}
              onToggleSave={onToggleSave}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
