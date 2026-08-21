import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../services/telegram';

export default function CategoryPills({ categories, activeCategory, onSelectCategory }) {
  const { getLocalized, t } = useLanguage();

  return (
    <div className="category-scroll">
      <button 
        className={`category-pill-btn ${activeCategory === '' ? 'active' : ''}`}
        onClick={() => {
          triggerHaptic('light');
          onSelectCategory('');
        }}
      >
        <span>🌟</span>
        <span>{t('stores.all')}</span>
      </button>

      {categories.map((cat) => (
        <button
          key={cat.slug}
          className={`category-pill-btn ${activeCategory === cat.slug ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic('light');
            onSelectCategory(cat.slug);
          }}
        >
          <span>{cat.icon}</span>
          <span>{getLocalized(cat, 'name')}</span>
        </button>
      ))}
    </div>
  );
}
