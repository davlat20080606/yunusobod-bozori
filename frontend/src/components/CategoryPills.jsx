import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../services/telegram';
import { ChevronRight } from 'lucide-react';

const CATEGORY_META = {
  all: { icon: '🛒', color: '#059669', bg: '#ecfdf5', uz: 'Barchasi', ru: 'Все товары', en: 'All' },
  bakery: { icon: '🥖', color: '#d97706', bg: '#fef3c7', uz: 'Non & Tandir', ru: 'Выпечка & Нон', en: 'Bakery' },
  fruits: { icon: '🍇', color: '#db2777', bg: '#fce7f3', uz: 'Mevalar', ru: 'Фрукты & Ягоды', en: 'Fruits' },
  meat: { icon: '🥩', color: '#dc2626', bg: '#fee2e2', uz: 'Go\'sht & Qazi', ru: 'Мясо & Казы', en: 'Fresh Meat' },
  vegetables: { icon: '🍅', color: '#16a34a', bg: '#dcfce7', uz: 'Sabzavotlar', ru: 'Овощи & Зелень', en: 'Vegetables' },
  dairy: { icon: '🧀', color: '#ca8a04', bg: '#fef9c3', uz: 'Sut & Qatiq', ru: 'Молочка & Сыр', en: 'Dairy' },
  dry_fruits: { icon: '🥜', color: '#ea580c', bg: '#ffedd5', uz: 'Quruq meva', ru: 'Сухофрукты', en: 'Dried Fruits' },
  combos: { icon: '👑', color: '#7c3aed', bg: '#f3e8ff', uz: 'To\'plamlar', ru: 'Сеты & Наборы', en: 'Family Sets' }
};

export default function CategoryPills({ categories, activeCategory, onSelectCategory, products = [] }) {
  const { getLocalized, t, language } = useLanguage();

  const getProductCount = (slug) => {
    if (!products || !products.length) return null;
    if (slug === '' || slug === 'all') return products.length;
    return products.filter((p) => p.category_slug === slug).length;
  };

  const getShortName = (slug, cat) => {
    if (CATEGORY_META[slug]) {
      return CATEGORY_META[slug][language] || CATEGORY_META[slug].uz;
    }
    return getLocalized(cat, 'name');
  };

  return (
    <section className="med-categories-section">
      <div className="med-section-header">
        <h2 className="med-section-title">
          {t('sections.categories_title') || (language === 'ru' ? 'Разделы базара' : 'Bozor bo\'limlari')}
        </h2>
        {activeCategory && (
          <button 
            type="button" 
            className="med-see-all-link"
            onClick={() => {
              triggerHaptic('light');
              onSelectCategory('');
            }}
          >
            <span>{t('sections.see_all')} ({products.length})</span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* 1. Mobile Squircle Horizontal Carousel (Matching MoboSELL / Uzum benchmark) */}
      <div className="med-cat-mobile-wrap">
        <div className="med-cat-mobile-strip">
          
          {/* All / Barchasi */}
          <div
            className={`med-cat-squircle-item ${activeCategory === '' ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('light');
              onSelectCategory('');
            }}
          >
            <div className="med-cat-squircle-box" style={{ background: CATEGORY_META.all.bg }}>
              <span className="med-cat-squircle-icon">{CATEGORY_META.all.icon}</span>
            </div>
            <span className="med-cat-squircle-label">
              {CATEGORY_META.all[language] || CATEGORY_META.all.uz}
            </span>
          </div>

          {/* Categories */}
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat.slug] || { icon: '🥬', bg: '#f1f5f9', color: '#059669' };
            const isSelected = activeCategory === cat.slug;
            const shortTitle = getShortName(cat.slug, cat);

            return (
              <div
                key={cat.id || cat.slug}
                className={`med-cat-squircle-item ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  triggerHaptic('light');
                  onSelectCategory(cat.slug);
                }}
              >
                <div className="med-cat-squircle-box" style={{ background: meta.bg }}>
                  <span className="med-cat-squircle-icon">{meta.icon}</span>
                </div>
                <span className="med-cat-squircle-label">
                  {shortTitle}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Desktop Grid (Matching MedBaza desktop layout) */}
      <div className="med-categories-desktop-grid">
        {/* All Tile */}
        <div
          className={`med-category-tile ${activeCategory === '' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic('light');
            onSelectCategory('');
          }}
        >
          <div className="med-cat-icon-wrap" style={{ background: CATEGORY_META.all.bg }}>
            <span className="med-cat-emoji">{CATEGORY_META.all.icon}</span>
          </div>
          <div className="med-cat-info">
            <span className="med-cat-name">{t('stores.all')}</span>
            <span className="med-cat-count">{products.length} {t('stores.products_count')}</span>
          </div>
        </div>

        {/* Dynamic Categories */}
        {categories.map((cat) => {
          const count = getProductCount(cat.slug);
          const meta = CATEGORY_META[cat.slug] || { icon: '🥬', bg: '#f1f5f9' };
          const isSelected = activeCategory === cat.slug;

          return (
            <div
              key={cat.id || cat.slug}
              className={`med-category-tile ${isSelected ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic('light');
                onSelectCategory(cat.slug);
              }}
            >
              <div className="med-cat-icon-wrap" style={{ background: meta.bg }}>
                <span className="med-cat-emoji">{meta.icon}</span>
              </div>
              <div className="med-cat-info">
                <span className="med-cat-name">{getLocalized(cat, 'name')}</span>
                <span className="med-cat-count">
                  {count !== null ? `${count} ${t('stores.products_count')}` : t('stores.enter_store')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
