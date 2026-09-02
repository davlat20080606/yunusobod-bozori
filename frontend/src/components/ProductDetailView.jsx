import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  ChevronRight, 
  ArrowLeft, 
  Star, 
  ShieldCheck, 
  Truck, 
  ShoppingCart, 
  Plus, 
  Minus, 
  CheckCircle2, 
  RotateCcw, 
  Heart, 
  Share2, 
  Check, 
  Store,
  Play,
  Volume2,
  VolumeX
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { formatUnit } from './ProductCard';
import ProductCard from './ProductCard';

export default function ProductDetailView({ 
  product, 
  onBack, 
  onAddToCart, 
  onSelectCategory,
  onSelectStore,
  isSaved = false,
  onToggleSave,
  relatedProducts = [],
  onSelectProduct
}) {
  const { getLocalized, t, language } = useLanguage();
  const [quantity, setQuantity] = useState(product?.min_weight || 1.0);
  const [isAdded, setIsAdded] = useState(false);
  const [activeMedia, setActiveMedia] = useState('photo');
  const [videoError, setVideoError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (product) {
      setQuantity(product.min_weight || 1.0);
      setActiveMedia('photo');
      setVideoError(false);
      setIsAdded(false);
    }
  }, [product]);

  if (!product) return null;

  const step = product.step_weight || 0.5;
  const min = product.min_weight || 0.5;
  const displayUnit = formatUnit(product.unit, language);
  const currencyLabel = language === 'ru' ? 'сум' : (language === 'en' ? 'UZS' : 'so\'m');

  const handleIncrement = () => {
    triggerHaptic('light');
    setQuantity((prev) => +(prev + step).toFixed(2));
  };

  const handleDecrement = () => {
    if (quantity > min) {
      triggerHaptic('light');
      setQuantity((prev) => +(prev - step).toFixed(2));
    }
  };

  const handleAdd = () => {
    triggerHaptic('medium');
    onAddToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  };

  const handleShare = () => {
    triggerHaptic('light');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalItemPrice = Math.round(product.price * quantity);
  const discountPercent = product.old_price && product.old_price > product.price
    ? Math.round(((product.old_price - product.price) / product.old_price) * 100)
    : null;

  const rating = product.rating || (4.6 + ((product.id * 3) % 4) / 10).toFixed(1);
  const reviewsCount = product.reviews_count || (8 + (product.id * 4) % 25);
  const stockAvailable = Math.round(product.stock_quantity || 45);

  const stallWord = language === 'ru' ? 'Прилавок' : (language === 'en' ? 'Stall' : 'Rasta');
  const storeLabel = product.store_name 
    ? product.store_name 
    : (product.store_id === 2 ? `KAREN AKA (${stallWord} #14)` 
      : (product.store_id === 1 ? `DILSHOD OTA (${stallWord} #1)` 
      : (product.store_id === 5 ? `BOTIR AKA (${stallWord} #8)` 
      : (product.store_id === 4 ? `ZUXRA OPA (${stallWord} #7)` 
      : (product.store_id === 6 ? `AKMAL (${stallWord} #9)` 
      : `NODIRA OPA (${stallWord} #10)`)))));

  const CATEGORY_NAMES = {
    meat: { ru: 'Свежее мясо и деликатесы', uz: 'Yangi go\'sht va qazilar', en: 'Fresh Meats & Cuts' },
    combos: { ru: 'Семейные наборы и сеты', uz: 'Oila uchun to\'plamlar', en: 'Family Combos & Sets' },
    vegetables: { ru: 'Овощи и зелень', uz: 'Sabzavot va ko\'katlar', en: 'Fresh Vegetables & Greens' },
    fruits: { ru: 'Фрукты и ягоды', uz: 'Meva va rezavorlar', en: 'Fresh Fruits & Berries' },
    dairy: { ru: 'Молочные продукты и сыры', uz: 'Sut mahsulotlari va pishloqlar', en: 'Dairy & Farm Cheese' },
    bread: { ru: 'Лепешки и выпечка', uz: 'Issiq non va patirlar', en: 'Bazaar Bread & Bakery' },
    spices: { ru: 'Специи и сухофрукты', uz: 'Ziravorlar va quruq mevalar', en: 'Spices & Dried Fruits' }
  };

  const currentCategoryTitle = CATEGORY_NAMES[product.category_slug]?.[language] || 
    (product.category_slug ? product.category_slug.toUpperCase() : (language === 'ru' ? 'Каталог' : 'Katalog'));

  const regionText = language === 'ru' 
    ? 'Узбекистан (Ташкент / Ферганская долина)' 
    : (language === 'en' ? 'Uzbekistan (Tashkent / Fergana Valley)' : 'O\'zbekiston (Toshkent / Vodiy)');

  const qualityText = language === 'ru' 
    ? '100% Халяль и Санитарный контроль' 
    : (language === 'en' ? '100% Halal & Sanitary Inspection' : '100% Halol va Sanitariya Nazorati');

  const storageText = language === 'ru' 
    ? 'от +2°C до +6°C (В прохладном месте)' 
    : (language === 'en' ? '+2°C to +6°C (Keep in cool place)' : '+2°C dan +6°C gacha (Sovuq joyda)');

  return (
    <div className="med-pdp-page animate-fade pb-16">
      
      {/* 1. Breadcrumbs & Back Button */}
      <div className="med-pdp-nav-bar">
        <button 
          type="button" 
          onClick={onBack}
          className="med-pdp-back-btn"
        >
          <ArrowLeft size={16} />
          <span>{language === 'ru' ? 'Назад в каталог' : (language === 'en' ? 'Back to Catalog' : 'Katalogga qaytish')}</span>
        </button>

        <nav className="med-breadcrumbs">
          <span 
            className="med-breadcrumb-link"
            onClick={onBack}
          >
            {language === 'ru' ? 'Главная' : (language === 'en' ? 'Home' : 'Bosh sahifa')}
          </span>
          <ChevronRight size={13} className="text-slate-400" />
          <span 
            className="med-breadcrumb-link"
            onClick={onBack}
          >
            {currentCategoryTitle}
          </span>
          <ChevronRight size={13} className="text-slate-400" />
          <span className="med-breadcrumb-current">
            {getLocalized(product, 'name')}
          </span>
        </nav>
      </div>

      {/* 2. Main 3-Column MedBaza Exact Layout */}
      <div className="med-pdp-main-grid">
        
        {/* =========================================
            COLUMN 1: PRODUCT IMAGE / VIDEO GALLERY
            ========================================= */}
        <div className="med-pdp-gallery-col">
          <div className="med-pdp-image-card">
            {activeMedia === 'video' && product.video_url && !videoError ? (
              <div className="med-pdp-video-wrap">
                <video 
                  src={product.video_url}
                  poster={product.image_url}
                  autoPlay
                  loop
                  playsInline
                  muted={isMuted}
                  onError={() => {
                    setVideoError(true);
                    setActiveMedia('photo');
                  }}
                  className="med-pdp-video"
                />
                <button 
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="med-uzum-sound-btn"
                  title={isMuted ? "Ovozni yoqish" : "Ovozni o'chirish"}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            ) : (
              <img 
                src={product.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80"} 
                alt={getLocalized(product, 'name')}
                className="med-pdp-main-img"
              />
            )}

            {/* Discount Tag */}
            {discountPercent && (
              <span className="med-pdp-discount-badge">
                −{discountPercent}%
              </span>
            )}
          </div>

          {/* Media Switcher Thumbnails */}
          <div className="med-pdp-thumbs-row">
            <button
              type="button"
              className={`med-pdp-thumb-btn ${activeMedia === 'photo' ? 'active' : ''}`}
              onClick={() => setActiveMedia('photo')}
            >
              <img 
                src={product.image_url} 
                alt="Rasm" 
                className="med-pdp-thumb-img" 
              />
              <span>{language === 'ru' ? 'Фото' : (language === 'en' ? 'Photo' : 'Rasm')}</span>
            </button>

            {product.video_url && !videoError && (
              <button
                type="button"
                className={`med-pdp-thumb-btn ${activeMedia === 'video' ? 'active' : ''}`}
                onClick={() => setActiveMedia('video')}
              >
                <div className="med-pdp-thumb-video-icon">
                  <Play size={13} fill="#ffffff" />
                </div>
                <span>Video Reel</span>
              </button>
            )}
          </div>
        </div>

        {/* =========================================
            COLUMN 2: MIDDLE DETAILS & DESCRIPTION
            ========================================= */}
        <div className="med-pdp-details-col">
          
          {/* Seller / Brand Title */}
          <div className="med-pdp-vendor-tag">
            {storeLabel.toUpperCase()}
          </div>

          {/* Product Main Title */}
          <h1 className="med-pdp-title">
            {getLocalized(product, 'name')}
          </h1>

          {/* Rating Row */}
          <div className="med-pdp-rating-row">
            <div className="flex items-center gap-1 text-amber-500 font-bold text-xs bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
              <Star size={13} className="fill-amber-400" />
              <span>{rating}</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              ({reviewsCount} {language === 'ru' ? 'отзывов' : (language === 'en' ? 'reviews' : 'sharh')})
            </span>

            <div className="ml-auto flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => onToggleSave && onToggleSave(product.id)}
                className={`med-pdp-icon-btn ${isSaved ? 'saved' : ''}`}
                title="Saqlash"
              >
                <Heart size={16} className={isSaved ? "fill-rose-500 text-rose-500" : "text-slate-500"} />
              </button>
              <button 
                type="button" 
                onClick={handleShare}
                className="med-pdp-icon-btn"
                title="Ulashish"
              >
                <Share2 size={16} className="text-slate-500" />
              </button>
            </div>
          </div>

          {copied && (
            <div className="text-xs text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-200 mb-2">
              ✓ {language === 'ru' ? 'Ссылка скопирована в буфер обмена!' : 'Havola nusxalandi!'}
            </div>
          )}

          {/* Verified Seller Pill (Matching MedBaza) */}
          <div className="med-pdp-verified-badge">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>
              {language === 'ru' ? 'Проверенный продавец базара' : (language === 'en' ? 'Verified Bazaar Merchant' : 'Tasdiqlangan sotuvchi')}
            </span>
          </div>

          {/* Description Section (Mahsulot haqida) */}
          <div className="med-pdp-about-box">
            <h3 className="med-pdp-about-title">
              {language === 'ru' ? 'О товаре' : (language === 'en' ? 'About Product' : 'Mahsulot haqida')}
            </h3>
            <p className="med-pdp-about-text">
              {getLocalized(product, 'description') || product.description_uz}
            </p>
          </div>

        </div>

        {/* =========================================
            COLUMN 3: RIGHT PURCHASE STICKY CARD
            ========================================= */}
        <div className="med-pdp-buy-col">
          
          {/* 1. Main Price & Purchase Card */}
          <div className="med-pdp-buy-card">
            
            {/* Price Row */}
            <div className="med-pdp-price-header">
              <div>
                <span className="med-pdp-big-price">
                  {totalItemPrice.toLocaleString()} {currencyLabel}
                </span>
                <span className="med-pdp-unit-label">
                  / {displayUnit}
                </span>
              </div>

              {product.old_price && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="med-pdp-old-price">
                    {(product.old_price * quantity).toLocaleString()} {currencyLabel}
                  </span>
                  <span className="med-pdp-discount-chip">
                    −{discountPercent}%
                  </span>
                </div>
              )}
            </div>

            {/* Quantity Stepper (Miqdor) */}
            <div className="med-pdp-qty-wrap">
              <label className="med-pdp-qty-label">
                {language === 'ru' ? 'Количество / Вес' : (language === 'en' ? 'Quantity' : 'Miqdor')}
              </label>
              
              <div className="med-pdp-stepper-box">
                <button 
                  type="button" 
                  onClick={handleDecrement}
                  disabled={quantity <= min}
                  className="med-pdp-step-btn"
                >
                  <Minus size={14} />
                </button>
                <span className="med-pdp-step-val">
                  {quantity} {displayUnit}
                </span>
                <button 
                  type="button" 
                  onClick={handleIncrement}
                  className="med-pdp-step-btn"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Add to Cart Button (Savatga qo'shish) */}
            <button 
              type="button"
              onClick={handleAdd}
              className={`med-pdp-add-btn ${isAdded ? 'added' : ''}`}
            >
              {isAdded ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>{language === 'ru' ? 'Добавлено в корзину!' : (language === 'en' ? 'Added to Cart!' : 'Savatga qo\'shildi!')}</span>
                </>
              ) : (
                <>
                  <ShoppingCart size={18} />
                  <span>{language === 'ru' ? 'Добавить в корзину' : (language === 'en' ? 'Add to Cart' : 'Savatga qo\'shish')}</span>
                </>
              )}
            </button>

            {/* Bullet Points Benefits (Matching MedBaza) */}
            <div className="med-pdp-benefits-list">
              <div className="med-pdp-benefit-item">
                <Check size={15} className="text-emerald-600 flex-shrink-0" />
                <span>
                  {stockAvailable} {displayUnit} {language === 'ru' ? 'доступно для заказа' : (language === 'en' ? 'available in stock' : 'xarid qilish mumkin')}
                </span>
              </div>

              <div className="med-pdp-benefit-item">
                <Truck size={15} className="text-emerald-600 flex-shrink-0" />
                <span>
                  {language === 'ru' ? 'Быстрая экспресс-доставка за 45 минут по Ташкенту' : (language === 'en' ? 'Express 45-min delivery across Tashkent' : '45 daqiqada eshikkacha tezyurar yetkazish')}
                </span>
              </div>

              <div className="med-pdp-benefit-item">
                <ShieldCheck size={15} className="text-emerald-600 flex-shrink-0" />
                <span>
                  {language === 'ru' ? '100% Гарантия качества: не понравится — заменим или вернем деньги' : (language === 'en' ? '100% Money back guarantee if not satisfied' : 'Sifat kafolati: yoqmasa almashtirish yoki 100% pulni qaytarish')}
                </span>
              </div>
            </div>

          </div>

          {/* 2. Mini Seller Info Box (Matching MedBaza) */}
          <div className="med-pdp-seller-box">
            <div className="text-xs text-slate-700 font-bold">
              <span>{language === 'ru' ? 'Продавец:' : (language === 'en' ? 'Seller:' : 'Sotuvchi:')} </span>
              <span className="text-emerald-700 underline font-extrabold cursor-pointer">
                {storeLabel}
              </span>
              <span className="text-slate-400 font-normal"> • SKU YB-{1000 + product.id}</span>
            </div>
            <div className="text-xs text-emerald-700 font-extrabold mt-1">
              ● {language === 'ru' ? 'В наличии' : (language === 'en' ? 'In Stock' : 'Mavjud')}
            </div>
          </div>

        </div>

      </div>

      {/* 3. Bottom Full-Width Specifications Card (Xususiyatlar) */}
      <div className="med-pdp-specs-section">
        <h3 className="med-pdp-specs-title">
          {language === 'ru' ? 'Характеристики и свойства' : (language === 'en' ? 'Specifications' : 'Xususiyatlar')}
        </h3>

        <div className="med-pdp-specs-grid">
          <div className="med-pdp-spec-cell">
            <span className="med-pdp-cell-label">{language === 'ru' ? 'Категория' : (language === 'en' ? 'Category' : 'Kategoriya')}</span>
            <span className="med-pdp-cell-val">{currentCategoryTitle}</span>
          </div>

          <div className="med-pdp-spec-cell">
            <span className="med-pdp-cell-label">{language === 'ru' ? 'Единица фасовки' : (language === 'en' ? 'Unit' : 'O\'lchov birligi')}</span>
            <span className="med-pdp-cell-val">{displayUnit}</span>
          </div>

          <div className="med-pdp-spec-cell">
            <span className="med-pdp-cell-label">{language === 'ru' ? 'Регион сбора / ферма' : (language === 'en' ? 'Region / Origin' : 'Kelib chiqishi')}</span>
            <span className="med-pdp-cell-val">{regionText}</span>
          </div>

          <div className="med-pdp-spec-cell">
            <span className="med-pdp-cell-label">{language === 'ru' ? 'Контроль качества' : (language === 'en' ? 'Quality Inspection' : 'Sertifikat & Nazorat')}</span>
            <span className="med-pdp-cell-val text-emerald-700 font-bold">{qualityText}</span>
          </div>

          <div className="med-pdp-spec-cell">
            <span className="med-pdp-cell-label">{language === 'ru' ? 'Условия хранения' : (language === 'en' ? 'Storage condition' : 'Saqlash sharoiti')}</span>
            <span className="med-pdp-cell-val">{storageText}</span>
          </div>

          <div className="med-pdp-spec-cell">
            <span className="med-pdp-cell-label">{language === 'ru' ? 'Минимальный заказ' : (language === 'en' ? 'Minimum order' : 'Minimal buyurtma')}</span>
            <span className="med-pdp-cell-val">{min} {displayUnit}</span>
          </div>
        </div>
      </div>

      {/* 4. Other Bazaar Recommendations */}
      {relatedProducts.length > 0 && (
        <div className="mt-14 pt-8 border-t border-slate-200/80">
          <div className="med-section-header mb-6">
            <div>
              <h2 className="med-section-title">
                {language === 'ru' ? 'Похожие предложения базара' : (language === 'en' ? 'Similar Bazaar Produce' : 'O\'xshash bozor mahsulotlari')}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {language === 'ru' ? 'Свежие продукты из этой же категории' : 'Ushbu bo\'limdagi sara mahsulotlar'}
              </p>
            </div>
          </div>

          <div className="med-products-exact-grid">
            {relatedProducts.slice(0, 4).map((p) => (
              <ProductCard 
                key={p.id}
                product={p}
                onAddToCart={onAddToCart}
                onOpenMediaModal={() => onSelectProduct && onSelectProduct(p)}
                isSaved={false}
                onToggleSave={onToggleSave}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
