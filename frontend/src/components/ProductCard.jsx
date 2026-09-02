import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ShoppingCart, Check, Plus, Minus, Heart, Star, Play, ShieldCheck } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export function formatUnit(unit, language) {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();

  if (language === 'ru') {
    if (u === 'dona' || u.includes('dona') || u.includes('штук')) return 'шт.';
    if (u === 'kg' || u === 'кг') return 'кг';
    if (u.includes("bog'lam") || u.includes('boglam') || u.includes('dasta') || u.includes('пучок')) return 'пучок';
    if (u.includes("to'plam") || u.includes("to`plam") || u.includes("сет") || u.includes("set")) return 'набор';
    if (u === 'litr' || u === 'литр') return 'л.';
    return unit;
  }

  if (language === 'en') {
    if (u === 'dona' || u.includes('dona')) return 'pcs';
    if (u === 'kg') return 'kg';
    if (u.includes("bog'lam") || u.includes('boglam') || u.includes('dasta')) return 'bunch';
    if (u.includes("to'plam") || u.includes("set")) return 'set';
    if (u === 'litr') return 'L';
    return unit;
  }

  // UZ (default)
  if (u === 'kg' || u === 'кг') return 'kg';
  if (u === 'dona' || u.includes('штук')) return 'dona';
  if (u.includes("bog'lam") || u.includes('boglam') || u.includes('dasta') || u.includes('пучок')) return 'dasta';
  if (u.includes("to'plam") || u.includes("сет") || u.includes("set")) return "to'plam";
  if (u === 'litr' || u === 'литр') return 'litr';
  return unit;
}


export default function ProductCard({ 
  product, 
  onAddToCart, 
  onOpenMediaModal,
  isSaved = false,
  onToggleSave
}) {
  const { getLocalized, t, language } = useLanguage();
  const [quantity, setQuantity] = useState(product.min_weight || 1.0);
  const [isAdded, setIsAdded] = useState(false);

  const step = product.step_weight || 0.5;
  const min = product.min_weight || 0.5;
  const displayUnit = formatUnit(product.unit, language);

  const handleIncrement = (e) => {
    e.stopPropagation();
    triggerHaptic('light');
    setQuantity((prev) => +(prev + step).toFixed(2));
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    if (quantity > min) {
      triggerHaptic('light');
      setQuantity((prev) => +(prev - step).toFixed(2));
    }
  };

  const handleAdd = (e) => {
    e.stopPropagation();
    triggerHaptic('medium');
    onAddToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1200);
  };

  const handleHeartClick = (e) => {
    e.stopPropagation();
    triggerHaptic('selection');
    if (onToggleSave) onToggleSave(product.id);
  };

  const BADGE_MAP = {
    halal: { ru: '100% Халяль', uz: '100% Halol', en: '100% Halal' },
    fresh: { ru: 'Свежий сбор', uz: 'Yangi uzilgan', en: 'Fresh' },
    fresh_hot: { ru: 'Из тандыра', uz: 'Issiq tandir', en: 'Hot Tandoor' },
    top_seller: { ru: 'Хит продаж', uz: 'Eng xaridorgir', en: 'Top Seller' },
    bestseller: { ru: 'Хит продаж', uz: 'Eng xaridorgir', en: 'Top Seller' },
    top_rated: { ru: 'Высший сорт', uz: 'Oliy nav', en: 'Top Rated' },
    sweet: { ru: 'Сахарный вкус', uz: 'Asaldek shirin', en: 'Extra Sweet' },
    premium: { ru: 'Премиум', uz: 'Premium', en: 'Premium' },
    organic: { ru: 'Эко ферма', uz: 'Tabiiy', en: 'Organic' },
    tea_house: { ru: 'Чайханский', uz: 'Choyxona', en: 'Tea House' },
    barbecue: { ru: 'Шашлычный', uz: 'Shashlikbop', en: 'Barbecue' },
    hot: { ru: 'Хит', uz: 'Mashhur', en: 'Hot' }
  };

  const getBadgeLabel = (badgeKey) => {
    if (!badgeKey) return null;
    const key = badgeKey.toLowerCase().trim();
    if (BADGE_MAP[key]) {
      return BADGE_MAP[key][language] || BADGE_MAP[key].uz;
    }
    const directT = t(`products.badge_${key}`);
    if (directT && !directT.startsWith('products.badge')) return directT;
    return null;
  };

  // Calculate discount percentage if old price exists
  const discountPercent = product.old_price && product.old_price > product.price
    ? Math.round(((product.old_price - product.price) / product.old_price) * 100)
    : null;

  // Seller store name dynamically translated
  const stallWord = language === 'ru' ? 'ПРИЛАВОК' : (language === 'en' ? 'STALL' : 'RASTA');
  const storeLabel = product.store_name 
    ? product.store_name.toUpperCase()
    : (product.store_id === 2 ? `KAREN AKA • ${stallWord} #14` 
      : (product.store_id === 1 ? `DILSHOD OTA • ${stallWord} #1` 
      : (product.store_id === 5 ? `BOTIR AKA • ${stallWord} #8` 
      : (product.store_id === 4 ? `ZUXRA OPA • ${stallWord} #7`
      : (product.store_id === 6 ? `AKMAL • ${stallWord} #9`
      : (product.store_id === 3 ? `NODIRA OPA • ${stallWord} #10`
      : (language === 'ru' ? 'ЮНУСАБАДСКИЙ БАЗАР' : (language === 'en' ? 'YUNUSABAD BAZAAR' : 'YUNUSOBOD BOZORI'))))))));

  // Mock rating
  const rating = product.rating || (4.6 + ((product.id * 3) % 4) / 10).toFixed(1);
  const reviewsCount = product.reviews_count || (8 + (product.id * 4) % 25);

  // Currency label based on selected language
  const currencyLabel = language === 'ru' ? 'сум' : (language === 'en' ? 'UZS' : 'so\'m');

  return (
    <article className="med-product-card group">
      
      {/* 1. Image Container */}
      <div 
        className="med-product-img-box"
        onClick={() => {
          triggerHaptic('light');
          if (onOpenMediaModal) onOpenMediaModal(product);
        }}
      >
        <img 
          src={product.image_url || "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80"} 
          alt={getLocalized(product, 'name')}
          loading="lazy"
          className="med-product-img"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "https://images.unsplash.com/photo-1595855759920-86582396756a?w=500&auto=format&fit=crop&q=80";
          }}
        />

        {/* Wishlist Heart Button */}
        <button 
          type="button"
          aria-label="Saqlash"
          className={`med-heart-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleHeartClick}
        >
          <Heart 
            size={18} 
            style={{
              fill: isSaved ? '#ef4444' : 'none',
              stroke: isSaved ? '#ef4444' : '#94a3b8',
              transition: 'all 0.2s ease'
            }}
          />
        </button>

        {/* Badges on Bottom Left of Image */}
        <div className="med-img-badges">
          {discountPercent && (
            <span className="med-badge-discount">−{discountPercent}%</span>
          )}
          {product.badge && (
            <span className="med-badge-tag">{getBadgeLabel(product.badge)}</span>
          )}
        </div>

        {/* Video Reel Trigger Badge */}
        {product.video_url && (
          <div className="med-video-reel-pill">
            <Play size={10} fill="#ffffff" />
            <span>Video Reel</span>
          </div>
        )}
      </div>

      {/* 2. Product Information Content */}
      <div className="med-product-info">
        
        {/* Prices Row */}
        <div className="med-price-row">
          <span className="med-current-price">
            {product.price.toLocaleString()} {currencyLabel}
          </span>
          {product.old_price && (
            <span className="med-old-price">
              {product.old_price.toLocaleString()} {currencyLabel}
            </span>
          )}
        </div>

        {/* Store / Stall name */}
        <p className="med-store-label">
          {storeLabel}
        </p>

        {/* Product Title */}
        <h3 
          className="med-product-title"
          onClick={() => {
            if (onOpenMediaModal) onOpenMediaModal(product);
          }}
        >
          {getLocalized(product, 'name')}
        </h3>

        {/* Rating & Reviews */}
        <div className="med-rating-row">
          <div className="med-star-wrap">
            <Star size={13} className="fill-amber-400 text-amber-400" />
            <span className="med-rating-score">{rating}</span>
            <span className="med-reviews-count">({reviewsCount})</span>
          </div>
          <span className="med-unit-tag">/ {displayUnit}</span>
        </div>

        {/* 3. Stepper & Add to Cart Button */}
        <div className="med-card-actions">
          
          {/* Weight Stepper */}
          <div className="med-stepper">
            <button 
              type="button"
              className="med-step-btn" 
              onClick={handleDecrement}
              disabled={quantity <= min}
            >
              <Minus size={13} />
            </button>
            <span className="med-step-value">
              {quantity} {displayUnit}
            </span>
            <button 
              type="button"
              className="med-step-btn" 
              onClick={handleIncrement}
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button 
            type="button" 
            className={`med-add-btn ${isAdded ? 'added' : ''}`}
            onClick={handleAdd}
          >
            {isAdded ? (
              <>
                <Check size={16} />
                <span>{t('products.added')}</span>
              </>
            ) : (
              <>
                <ShoppingCart size={15} />
                <span>{t('products.add_to_cart')}</span>
              </>
            )}
          </button>

        </div>

      </div>

    </article>
  );
}
