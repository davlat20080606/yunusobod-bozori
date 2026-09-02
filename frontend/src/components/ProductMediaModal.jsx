import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  X, 
  Play, 
  Pause,
  Volume2, 
  VolumeX, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Truck, 
  Star, 
  Store, 
  Heart,
  Share2,
  Clock,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { formatUnit } from './ProductCard';

export default function ProductMediaModal({ 
  isOpen, 
  onClose, 
  product, 
  onAddToCart,
  isSaved = false,
  onToggleSave,
  onSelectStore
}) {
  const { getLocalized, t, language } = useLanguage();
  const [activeMedia, setActiveMedia] = useState('photo');
  const [videoError, setVideoError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [quantity, setQuantity] = useState(1.0);
  const [isAdded, setIsAdded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (product) {
      setQuantity(product.min_weight || 1.0);
      setActiveMedia('photo');
      setVideoError(false);
      setIsAdded(false);
    }
  }, [product]);

  if (!isOpen || !product) return null;

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

  const savingsAmount = product.old_price && product.old_price > product.price
    ? Math.round((product.old_price - product.price) * quantity)
    : 0;

  const rating = product.rating || 4.8;
  const reviewsCount = product.reviews_count || 24;
  const ordersCount = 45 + (product.id * 7) % 80;

  const stallWord = language === 'ru' ? 'Прилавок' : (language === 'en' ? 'Stall' : 'Rasta');
  const storeLabel = product.store_name 
    ? product.store_name 
    : (product.store_id === 2 ? `Karen Aka (${stallWord} #14)` 
      : (product.store_id === 1 ? `Dilshod Ota (${stallWord} #1)` 
      : (product.store_id === 5 ? `Botir Aka (${stallWord} #8)` 
      : (product.store_id === 4 ? `Zuxra Opa (${stallWord} #7)` 
      : (product.store_id === 6 ? `Akmal (${stallWord} #9)` 
      : `Nodira Opa (${stallWord} #10)`)))));

  return (
    <div className="modal-center-backdrop" onClick={onClose}>
      <div 
        className="med-uzum-modal animate-scale" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button Top Right */}
        <button 
          type="button" 
          onClick={onClose}
          className="med-modal-close-btn"
          aria-label="Yopish"
        >
          <X size={20} />
        </button>

        {/* 2-Column Responsive Layout (Uzum Market Style) */}
        <div className="med-uzum-grid">
          
          {/* =========================================
              LEFT COLUMN: MEDIA GALLERY (PHOTO / VIDEO)
              ========================================= */}
          <div className="med-uzum-media-col">
            
            <div className="med-uzum-main-media">
              {activeMedia === 'video' && product.video_url && !videoError ? (
                <div className="med-uzum-video-wrap">
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
                    className="med-uzum-video"
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
                  className="med-uzum-img"
                />
              )}

              {/* Discount Tag */}
              {discountPercent && (
                <span className="med-uzum-discount-tag">
                  −{discountPercent}%
                </span>
              )}
            </div>

            {/* Thumbnails Row */}
            <div className="med-uzum-thumbs-row">
              <button
                type="button"
                className={`med-uzum-thumb-btn ${activeMedia === 'photo' ? 'active' : ''}`}
                onClick={() => setActiveMedia('photo')}
              >
                <img 
                  src={product.image_url} 
                  alt="Rasm" 
                  className="med-uzum-thumb-img" 
                />
                <span>{language === 'ru' ? 'Фото' : (language === 'en' ? 'Photo' : 'Rasm')}</span>
              </button>

              {product.video_url && !videoError && (
                <button
                  type="button"
                  className={`med-uzum-thumb-btn ${activeMedia === 'video' ? 'active' : ''}`}
                  onClick={() => setActiveMedia('video')}
                >
                  <div className="med-uzum-thumb-video-icon">
                    <Play size={14} fill="#ffffff" />
                  </div>
                  <span>Video Reel</span>
                </button>
              )}
            </div>

            {/* Trust highlights under gallery */}
            <div className="med-uzum-trust-box">
              <div className="med-uzum-trust-row">
                <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-slate-700 font-bold">
                  {language === 'ru' ? '100% Халяль и санитарный контроль' : (language === 'en' ? '100% Halal & State Inspected' : '100% Halol va Davlat Sanitariya Nazorati')}
                </span>
              </div>
              <div className="med-uzum-trust-row mt-2">
                <RotateCcw size={16} className="text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-slate-700 font-medium">
                  {language === 'ru' ? 'Гарантия возврата: не понравится — заменим или вернем деньги' : (language === 'en' ? 'Money back guarantee if not satisfied' : 'Sifat kafolati: yoqmasa almashtirib beramiz')}
                </span>
              </div>
            </div>

          </div>

          {/* =========================================
              RIGHT COLUMN: PRODUCT DETAILS & PURCHASE
              ========================================= */}
          <div className="med-uzum-info-col">
            
            {/* Header: Seller & Stall */}
            <div className="med-uzum-store-badge">
              <Store size={14} className="text-emerald-600" />
              <span className="font-bold">{storeLabel}</span>
              <span className="med-dot-sep">•</span>
              <span className="text-emerald-700 font-semibold">
                {language === 'ru' ? 'Юнусабадский Базар' : (language === 'en' ? 'Yunusabad Bazaar' : 'Yunusobod Bozori')}
              </span>
            </div>

            {/* Title */}
            <h2 className="med-uzum-title">
              {getLocalized(product, 'name')}
            </h2>

            {/* Rating & Social Row */}
            <div className="med-uzum-meta-row">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 text-amber-500 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  <Star size={12} className="fill-amber-400" />
                  <span>{rating}</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  ({reviewsCount} {language === 'ru' ? 'отзывов' : (language === 'en' ? 'reviews' : 'ta sharh')})
                </span>
              </div>

              <span className="med-dot-sep">•</span>
              <span className="text-xs text-slate-500 font-medium">
                {ordersCount}+ {language === 'ru' ? 'заказов' : (language === 'en' ? 'sold' : 'xarid qilingan')}
              </span>

              <div className="ml-auto flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => onToggleSave && onToggleSave(product.id)}
                  className={`med-uzum-icon-btn ${isSaved ? 'saved' : ''}`}
                  title="Saqlash"
                >
                  <Heart size={16} className={isSaved ? "fill-rose-500 text-rose-500" : "text-slate-500"} />
                </button>
                <button 
                  type="button" 
                  onClick={handleShare}
                  className="med-uzum-icon-btn"
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

            {/* Big Price Box (Uzum Style) */}
            <div className="med-uzum-price-card">
              <div className="flex items-baseline gap-3">
                <span className="med-uzum-price-main">
                  {totalItemPrice.toLocaleString()} {currencyLabel}
                </span>
                {product.old_price && (
                  <span className="med-uzum-price-old">
                    {(product.old_price * quantity).toLocaleString()} {currencyLabel}
                  </span>
                )}
              </div>

              {savingsAmount > 0 && (
                <div className="med-uzum-savings-badge mt-1.5">
                  <span>
                    {language === 'ru' ? 'Экономия:' : (language === 'en' ? 'You save:' : 'Tejamkorlik:')} {savingsAmount.toLocaleString()} {currencyLabel} (−{discountPercent}%)
                  </span>
                </div>
              )}
            </div>

            {/* Delivery Banner */}
            <div className="med-uzum-delivery-box">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
                  <Truck size={17} />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    {language === 'ru' ? 'Быстрая доставка за 45 минут' : (language === 'en' ? 'Express 45-min Delivery' : '45 daqiqada tezyurar yetkazib berish')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {language === 'ru' ? 'Прямо с прилавка Юнусабадского базара к вашей двери' : 'To\'g\'ridan-to\'g\'ri rastadan eshigingizgacha'}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="med-uzum-desc-section">
              <h4 className="med-uzum-desc-title">
                {language === 'ru' ? 'Описание и состав' : (language === 'en' ? 'Description' : 'Mahsulot tavsifi')}
              </h4>
              <p className="med-uzum-desc-text">
                {getLocalized(product, 'description') || product.description_uz}
              </p>
            </div>

            {/* Characteristics table */}
            <div className="med-uzum-specs-table">
              <div className="med-uzum-spec-row">
                <span className="med-uzum-spec-label">{language === 'ru' ? 'Единица измерения' : 'O\'lchov birligi'}</span>
                <span className="med-uzum-spec-val">{displayUnit}</span>
              </div>
              <div className="med-uzum-spec-row">
                <span className="med-uzum-spec-label">{language === 'ru' ? 'Страна происхождения' : 'Kelib chiqishi'}</span>
                <span className="med-uzum-spec-val">O'zbekiston (Toshkent)</span>
              </div>
              <div className="med-uzum-spec-row">
                <span className="med-uzum-spec-label">{language === 'ru' ? 'Свежесть' : 'Sifat nazorati'}</span>
                <span className="med-uzum-spec-val text-emerald-700 font-bold">100% Halol & Yangi</span>
              </div>
            </div>

            {/* Action Bar (Stepper + Full Add to Cart Button) */}
            <div className="med-uzum-actions-bar">
              <div className="med-uzum-stepper">
                <button 
                  type="button" 
                  onClick={handleDecrement}
                  disabled={quantity <= min}
                  className="med-uzum-step-btn"
                >
                  <Minus size={14} />
                </button>
                <span className="med-uzum-step-value">
                  {quantity} {displayUnit}
                </span>
                <button 
                  type="button" 
                  onClick={handleIncrement}
                  className="med-uzum-step-btn"
                >
                  <Plus size={14} />
                </button>
              </div>

              <button 
                type="button"
                onClick={handleAdd}
                className={`med-uzum-add-btn ${isAdded ? 'added' : ''}`}
              >
                {isAdded ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>{language === 'ru' ? 'Добавлено в корзину!' : (language === 'en' ? 'Added to Cart!' : 'Savatga qo\'shildi!')}</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    <span>
                      {language === 'ru' ? 'Добавить в корзину' : (language === 'en' ? 'Add to Cart' : 'Savatga qo\'shish')} • {totalItemPrice.toLocaleString()} {currencyLabel}
                    </span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
