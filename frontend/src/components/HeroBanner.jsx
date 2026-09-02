import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ChevronLeft, ChevronRight, Sparkles, ShieldCheck, Clock, Zap, ArrowRight } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

const BANNER_SLIDES = [
  {
    id: 1,
    badge: '45 daqiqada tezyurar yetkazish',
    badge_ru: 'Экспресс-доставка за 45–60 минут',
    badge_en: 'Express Delivery in 45 Mins',
    title_uz: "Yunusobod Bozoridan Yangi Saralangan Go'sht & Mevalar",
    title_ru: 'Свежие продукты и парное мясо с Юнусабадского Базара',
    title_en: 'Fresh Farm Produce & Tender Meat from Yunusabad Bazaar',
    desc_uz: "Xarid qilingan go'sht va sabzavotlar 45 daqiqada to'g'ridan-to'g'ri rastadan uyingizga!",
    desc_ru: 'Отборная говядина, баранина, фрукты и овощи с гарантией 100% свежести.',
    desc_en: 'Grass-fed lamb, fresh vegetables and sweet melons delivered right to your door.',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80',
    cta_category: 'meat',
    tag: '-20%'
  },
  {
    id: 2,
    badge: 'Haftalik Katta To\'plamlar',
    badge_ru: 'Королевские семейные наборы',
    badge_en: 'Mega Family Weekly Boxes',
    title_uz: "Butun Oila Uchun 1 Haftalik Tayyor Go'sht & Oziq-ovqat",
    title_ru: 'Большой Семейный Набор: 5 кг мяса, казы, овощи и патиры',
    title_en: 'Mega Family Weekly Box: Prime Beef, Lamb, Fresh Veggies & Bread',
    desc_uz: "Bozorga borib vaqt sarflamang, 25% chegirma va bepul yetkazib berish bilan oling!",
    desc_ru: 'Экономьте до 25% и получайте бесплатную доставку при заказе сета!',
    desc_en: 'Save up to 25% and get free express delivery on all weekly combo boxes.',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop&q=80',
    cta_category: 'combos',
    tag: '-25%'
  },
  {
    id: 3,
    badge: 'Issiq Tandir & Oshxonasi',
    badge_ru: 'Горячая выпечка из тандыра',
    badge_en: 'Fresh Tandoor Bread & Samsa',
    title_uz: "Samarqand Patirlari va Qarsildoq Shirin Qovunlar",
    title_ru: 'Самаркандские патиры, сочная самса и сахарные мирзачульские дыни',
    title_en: 'Authentic Samarkand Flatbreads, Crispy Samsa & Honey Melons',
    desc_uz: "Qaynoq tandirdan endigina uzilgan shohona nonlar va xushbo'y pishiriqlar.",
    desc_ru: 'Хрустящая корочка, натуральное сливочное масло и неповторимый аромат.',
    desc_en: 'Steaming hot from the tandoor clay oven straight to your dining table.',
    image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=1200&auto=format&fit=crop&q=80',
    cta_category: 'bakery',
    tag_uz: 'YANGI',
    tag_ru: 'НОВИНКА',
    tag_en: 'NEW',
    tag: 'YANGI'
  }
];

export default function HeroBanner({ onSelectCategory }) {
  const { lang, t, language } = useLanguage();
  const activeLang = language || lang;
  const [currentSlide, setCurrentSlide] = useState(0);

  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  // Auto slide interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % BANNER_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    setCurrentSlide((prev) => (prev - 1 + BANNER_SLIDES.length) % BANNER_SLIDES.length);
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    setCurrentSlide((prev) => (prev + 1) % BANNER_SLIDES.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 45) {
      handleNext();
    } else if (distance < -45) {
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const slide = BANNER_SLIDES[currentSlide];

  const getSlideText = (slide, field) => {
    if (activeLang === 'ru') return slide[`${field}_ru`] || slide[`${field}_uz`] || slide[field];
    if (activeLang === 'en') return slide[`${field}_en`] || slide[`${field}_uz`] || slide[field];
    return slide[`${field}_uz`] || slide[field];
  };

  const badgeText = getSlideText(slide, 'badge').replace(/^[⚡️👑🥖\s]+/, '');

  return (
    <section className="med-carousel-wrap">
      <div 
        className="med-carousel-card"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          triggerHaptic('medium');
          if (onSelectCategory && slide.cta_category) {
            onSelectCategory(slide.cta_category);
          }
        }}
      >
        {/* Background Image with Smooth Transition */}
        {BANNER_SLIDES.map((s, idx) => (
          <div 
            key={s.id}
            className={`med-carousel-bg ${idx === currentSlide ? 'active' : ''}`}
            style={{ backgroundImage: `url(${s.image})` }}
          >
            <div className="med-carousel-overlay" />
          </div>
        ))}

        {/* Content Container */}
        <div className="med-carousel-content">
          <div className="med-carousel-pill">
            <Zap size={13} className="text-amber-300" />
            <span>{badgeText}</span>
          </div>

          <h2 className="med-carousel-title animate-fade">
            {getSlideText(slide, 'title')}
          </h2>

          <p className="med-carousel-desc animate-fade">
            {getSlideText(slide, 'desc')}
          </p>

          <div className="med-carousel-footer">
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                className="med-carousel-cta"
              >
                <span>{activeLang === 'ru' ? 'Смотреть каталог' : (activeLang === 'en' ? 'Shop Now' : 'Xarid qilish')}</span>
                <ArrowRight size={15} />
              </button>
              <span className="med-carousel-tag">{getSlideText(slide, 'tag')}</span>
            </div>

            {/* Seamless right-aligned indicator dots */}
            <div className="med-carousel-dots-inline">
              {BANNER_SLIDES.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Slide ${idx + 1}`}
                  className={`med-dot ${idx === currentSlide ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setCurrentSlide(idx);
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Nav Chevrons */}
        <button 
          type="button" 
          aria-label="Oldingi banner"
          className="med-carousel-nav med-carousel-prev"
          onClick={handlePrev}
        >
          <ChevronLeft size={18} />
        </button>

        <button 
          type="button" 
          aria-label="Keyingi banner"
          className="med-carousel-nav med-carousel-next"
          onClick={handleNext}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Quick Trust Badges Strip below Carousel */}
      <div className="med-trust-strip">
        <div className="med-trust-item">
          <ShieldCheck size={18} className="text-emerald-600" />
          <span>{t('hero.feature_halal')}</span>
        </div>
        <div className="med-trust-item">
          <Clock size={18} className="text-emerald-600" />
          <span>{t('hero.feature_delivery')}</span>
        </div>
        <div className="med-trust-item">
          <Sparkles size={18} className="text-emerald-600" />
          <span>{t('hero.feature_direct_price')}</span>
        </div>
      </div>
    </section>
  );
}
