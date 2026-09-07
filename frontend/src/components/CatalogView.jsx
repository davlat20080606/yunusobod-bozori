import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import ProductCard from './ProductCard';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

const CATEGORY_META = {
  all: { icon: '🛒', bg: '#ecfdf5', uz: 'Barchasi', ru: 'Все', en: 'All' },
  bakery: { icon: '🥖', bg: '#fef3c7', uz: 'Non & Tandir', ru: 'Выпечка', en: 'Bakery' },
  fruits: { icon: '🍇', bg: '#fce7f3', uz: 'Mevalar', ru: 'Фрукты', en: 'Fruits' },
  meat: { icon: '🥩', bg: '#fee2e2', uz: 'Go\'sht', ru: 'Мясо', en: 'Fresh Meat' },
  vegetables: { icon: '🍅', bg: '#dcfce7', uz: 'Sabzavotlar', ru: 'Овощи', en: 'Vegetables' },
  dairy: { icon: '🧀', bg: '#fef9c3', uz: 'Sut mahsulotlari', ru: 'Молочка', en: 'Dairy' },
  dry_fruits: { icon: '🥜', bg: '#ffedd5', uz: 'Quruq mevalar', ru: 'Сухофрукты', en: 'Dried Fruits' },
  combos: { icon: '👑', bg: '#f3e8ff', uz: 'To\'plamlar', ru: 'Сеты', en: 'Sets' }
};

export default function CatalogView({
  categories,
  products,
  activeCategory,
  onSelectCategory,
  onAddToCart,
  onOpenMediaModal,
  savedProductIds,
  onToggleSave
}) {
  const { getLocalized, language } = useLanguage();

  const currentCategory = categories.find((c) => c.slug === activeCategory);
  
  // Filter products by category
  const filteredProducts = activeCategory
    ? products.filter((p) => p.category_slug === activeCategory)
    : products;

  const getCategoryTitle = () => {
    if (!activeCategory) {
      return language === 'ru' ? 'Все продукты базара' : (language === 'en' ? 'All Bazaar Produce' : 'Barcha bozor mahsulotlari');
    }
    if (CATEGORY_META[activeCategory]) {
      return CATEGORY_META[activeCategory][language] || CATEGORY_META[activeCategory].uz;
    }
    return currentCategory ? getLocalized(currentCategory, 'name') : (language === 'ru' ? 'Каталог' : 'Katalog');
  };

  return (
    <div className="med-catalog-page animate-fade pb-20 pt-2">
      
      {/* 1. Header & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button 
          type="button" 
          onClick={() => onSelectCategory('')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#1e293b',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}
        >
          <ArrowLeft size={16} />
          <span>{language === 'ru' ? 'Главная' : (language === 'en' ? 'Home' : 'Bosh sahifa')}</span>
        </button>

        <span style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: '#64748b',
          background: '#f1f5f9',
          padding: '5px 12px',
          borderRadius: '999px'
        }}>
          {filteredProducts.length} {language === 'ru' ? 'товаров' : (language === 'en' ? 'items' : 'ta mahsulot')}
        </span>
      </div>

      {/* 2. Category Switcher Horizontal Pills (Modern Mobile-First) */}
      <div className="med-cat-mobile-wrap mb-5">
        <div className="med-cat-mobile-strip">
          
          {/* All / Barchasi */}
          <button
            type="button"
            className={`med-cat-squircle-item ${activeCategory === '' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', padding: 0 }}
            onClick={() => {
              triggerHaptic('light');
              onSelectCategory('');
            }}
          >
            <div className="med-cat-squircle-box" style={{ background: '#ecfdf5' }}>
              <span className="med-cat-squircle-icon">🛒</span>
            </div>
            <span className="med-cat-squircle-label">
              {language === 'ru' ? 'Все' : (language === 'en' ? 'All' : 'Barchasi')}
            </span>
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat.slug] || { icon: '🥬', uz: cat.name_uz, ru: cat.name_ru, en: cat.name_en };
            const isSelected = activeCategory === cat.slug;
            const label = meta[language] || meta.uz;

            return (
              <button
                key={cat.id || cat.slug}
                type="button"
                className={`med-cat-squircle-item ${isSelected ? 'active' : ''}`}
                style={{ background: 'transparent', border: 'none', padding: 0 }}
                onClick={() => {
                  triggerHaptic('light');
                  onSelectCategory(cat.slug);
                }}
              >
                <div className="med-cat-squircle-box" style={{ background: meta.bg || '#f1f5f9' }}>
                  <span className="med-cat-squircle-icon">{meta.icon}</span>
                </div>
                <span className="med-cat-squircle-label">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Section Title */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
          {getCategoryTitle()}
        </h1>
      </div>

      {/* 4. Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="med-no-products py-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h4 className="text-base font-extrabold text-slate-900 mb-1">
            {language === 'ru' ? 'Товары не найдены' : 'Mos mahsulot topilmadi'}
          </h4>
          <button
            type="button"
            onClick={() => onSelectCategory('')}
            className="med-carousel-cta mt-4"
          >
            {language === 'ru' ? 'Смотреть все продукты' : 'Barcha mahsulotlarni ko\'rish'}
          </button>
        </div>
      ) : (
        <div className="med-products-grid">
          {filteredProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              onAddToCart={onAddToCart}
              onOpenMediaModal={onOpenMediaModal}
              isSaved={savedProductIds.includes(prod.id)}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}

    </div>
  );
}
