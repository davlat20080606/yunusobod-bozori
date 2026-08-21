import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Search, Sparkles, Zap, ShieldCheck, Clock } from 'lucide-react';

export default function HeroBanner({ searchQuery, setSearchQuery, selectedCategoryName }) {
  const { t } = useLanguage();

  return (
    <div className="hero-banner animate-fade">
      <div className="hero-pattern">🍉</div>
      
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div className="hero-pill">
          <Zap size={14} color="#fef08a" />
          <span>{t('hero.badge')}</span>
        </div>

        <h1 className="hero-title">{t('hero.title')}</h1>
        <p className="hero-subtitle">{t('hero.subtitle')}</p>

        {/* Quick Highlights */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#a7f3d0' }}>
            <ShieldCheck size={16} />
            <span>100% Halol & Saralangan</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#a7f3d0' }}>
            <Clock size={16} />
            <span>Bugun yetkazish (45 daqiqa)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#a7f3d0' }}>
            <Sparkles size={16} />
            <span>Sotuvchilar bilan to'g'ridan-to'g'ri narx</span>
          </div>
        </div>
      </div>
    </div>
  );
}
