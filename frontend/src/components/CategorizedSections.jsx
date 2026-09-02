import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../services/telegram';
import { ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';

const CATEGORY_BANNERS = {
  bakery: {
    bg: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #0f766e 100%)',
    icon: '🥖',
    badge_uz: 'Issiq & Yangi',
    badge_ru: 'Свежая выпечка',
    badge_en: 'Hot & Fresh',
    title_uz: 'NON VA TANDIR MAHSULOTLARI',
    title_ru: 'ХЛЕБ, ВЫПЕЧКА И САМСА',
    title_en: 'TANDOOR BREAD & BAKERY',
    subtitle_uz: 'Yunusobodning eng mazali tandir patirlari',
    subtitle_ru: 'Ароматные горячие патыры и лепешки',
    subtitle_en: 'Authentic warm tandoor bazaar breads'
  },
  fruits: {
    bg: 'linear-gradient(135deg, #831843 0%, #be185d 50%, #9d174d 100%)',
    icon: '🍇',
    badge_uz: 'Bog\'dan uzilgan',
    badge_ru: 'Спелый урожай',
    badge_en: 'Garden Fresh',
    title_uz: 'MEVALAR VA REZAVORLAR',
    title_ru: 'ФРУКТЫ, ЯГОДЫ И БАХЧЕВЫЕ',
    title_en: 'FRESH FRUITS & BERRIES',
    subtitle_uz: 'Asaldek shirin sara mevalar',
    subtitle_ru: 'Сладкие спелые фрукты прямо с садов',
    subtitle_en: 'Sweet and juicy seasonal harvest'
  },
  meat: {
    bg: 'linear-gradient(135deg, #881337 0%, #b91c1c 50%, #991b1b 100%)',
    icon: '🥩',
    badge_uz: '100% Halol & Nazorat',
    badge_ru: '100% Халяль контроль',
    badge_en: '100% Halal Certified',
    title_uz: 'YANGI GO\'SHT VA QAZILAR',
    title_ru: 'СВЕЖЕЕ ХАЛЯЛЬ МЯСО И ДЕЛИКАТЕСЫ',
    title_en: 'FRESH MEAT & DELICACIES',
    subtitle_uz: 'Fermerlardan sara mol va qo\'y go\'shti',
    subtitle_ru: 'Отборная говядина, баранина и конина',
    subtitle_en: 'Premium halal cuts from local farms'
  },
  vegetables: {
    bg: 'linear-gradient(135deg, #14532d 0%, #15803d 50%, #166534 100%)',
    icon: '🍅',
    badge_uz: 'Dala hosili',
    badge_ru: 'С грядки',
    badge_en: 'Farm Fresh',
    title_uz: 'SABZAVOTLAR VA KO\'KATLAR',
    title_ru: 'ОТБОРНЫЕ ОВОЩИ И ЗЕЛЕНЬ',
    title_en: 'FRESH VEGETABLES & GREENS',
    subtitle_uz: 'Har kuni ertalabki yangi terim',
    subtitle_ru: 'Сочные томаты, огурцы и свежая зелень',
    subtitle_en: 'Crisp vegetables harvested daily'
  }
};

export default function CategorizedSections({
  products = [],
  categories = [],
  onAddToCart,
  onOpenMediaModal,
  savedProductIds = [],
  onToggleSave
}) {
  const { language, t } = useLanguage();

  // Top popular products for "Mashhur" section
  const popularProducts = products.filter(p => p.badge || p.old_price || p.rating >= 4.8).slice(0, 6);
  const featuredList = popularProducts.length > 0 ? popularProducts : products.slice(0, 6);

  // Group products by category
  const categoriesToShow = ['bakery', 'fruits', 'meat', 'vegetables'];

  return (
    <div className="med-categorized-flow my-6 space-y-10">
      
      {/* 1. MASHHUR / POPULAR PRODUCTS SECTION */}
      <section className="med-section-block">
        <div className="med-section-header">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛍</span>
            <h2 className="med-section-title">
              {language === 'ru' ? 'Популярные товары' : (language === 'en' ? 'Popular Produce' : 'Mashhur mahsulotlar')}
            </h2>
          </div>
        </div>

        <div className="med-products-grid">
          {featuredList.map((prod) => (
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
      </section>

      {/* 2. THEMED CATEGORY SECTIONS WITH BANNERS (NO REDUNDANT BUTTONS) */}
      {categoriesToShow.map((catSlug) => {
        const bannerInfo = CATEGORY_BANNERS[catSlug];
        if (!bannerInfo) return null;

        const catProducts = products.filter((p) => p.category_slug === catSlug);
        if (catProducts.length === 0) return null;

        return (
          <section key={catSlug} className="med-category-block">
            
            {/* Visual Category Themed Banner Header */}
            <div 
              className="med-category-banner-card"
              style={{ background: bannerInfo.bg, cursor: 'default' }}
            >
              <div className="med-cat-banner-content" style={{ maxWidth: '100%' }}>
                <div className="med-cat-banner-badge">
                  <span>{bannerInfo[`badge_${language}`] || bannerInfo.badge_uz}</span>
                </div>
                <h3 className="med-cat-banner-title">
                  {bannerInfo.icon} {bannerInfo[`title_${language}`] || bannerInfo.title_uz}
                </h3>
                <p className="med-cat-banner-sub">
                  {bannerInfo[`subtitle_${language}`] || bannerInfo.subtitle_uz}
                </p>
              </div>
            </div>

            {/* Products Grid for this Category */}
            <div className="med-products-grid mt-4">
              {catProducts.map((prod) => (
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

          </section>
        );
      })}

    </div>
  );
}
