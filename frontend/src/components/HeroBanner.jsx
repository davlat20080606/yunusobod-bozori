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
    desc_ru: 'Говядина, баранина, фрукты и овощи прямо с прилавков базара — к вашей двери.',
    desc_en: 'Grass-fed lamb, fresh vegetables and sweet melons delivered right to your door.',
    image: '/img/p/b2fb288e8c9b.jpg',
    cta_category: 'meat',
    tag: ''
  },
  {
    id: 2,
    badge: 'Hammasi bitta buyurtmada',
    badge_ru: 'Всё одним заказом',
    badge_en: 'Everything in one order',
    title_uz: "Go'sht, sabzavot va non — turli rastalardan bitta buyurtma",
    title_ru: 'Мясо, овощи и хлеб с разных раст — одним заказом',
    title_en: 'Meat, vegetables and bread from different stalls — one order',
    desc_uz: "Aravachi hamma rastalarni aylanib, xaridlaringizni birga olib keladi.",
    desc_ru: 'Аравачи обойдёт все расты и привезёт покупки вместе.',
    desc_en: 'A bazaar porter visits every stall and brings it all together.',
    image: '/img/p/d8695acbd883.jpg',
    cta_category: 'combos',
    tag: ''
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
    image: '/img/p/f3cdfa490b92.jpg',
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
              {getSlideText(slide, 'tag') && <span className="med-carousel-tag">{getSlideText(slide, 'tag')}</span>}
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
