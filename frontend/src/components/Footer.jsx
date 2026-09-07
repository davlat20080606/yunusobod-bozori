import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Phone, Clock, MapPin, Send, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { ClickLogo, PaymeLogo, UzcardBadge, HumoBadge } from './PaymentLogos';

export default function Footer({ onNavigateCatalog, onNavigateSaved, onNavigateSeller, onNavigateOrders }) {
  const { t, language } = useLanguage();

  return (
    <footer className="med-footer-container">
      <div className="bozor-container">
        
        {/* Main Footer 4-Column Grid */}
        <div className="med-footer-grid">
          
          {/* Column 1: Brand & Guarantee */}
          <div className="med-footer-col">
            <div className="med-footer-brand-row">
              <div className="med-footer-logo-badge">
                <ShoppingBag size={18} />
              </div>
              <div className="med-footer-brand-wrap">
                <span className="med-footer-brand-name">
                  {t('brand.name')}
                </span>
                <span className="med-footer-brand-status">
                  {language === 'ru' ? '● 06:00 – 20:00 Открыто' : (language === 'en' ? '● 06:00 – 20:00 Open' : '● 06:00 – 20:00 Ochiq')}
                </span>
              </div>
            </div>
            
            <p className="med-footer-desc">
              {t('footer.about_desc')}
            </p>
            
            <div className="med-footer-halal-badge">
              <ShieldCheck size={16} />
              <span>
                {language === 'ru' ? '100% Халяль и гарантия качества' : (language === 'en' ? '100% Halal & Quality Guaranteed' : '100% Halol & Sifat Kafolati')}
              </span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="med-footer-col">
            <h4 className="med-footer-heading">{t('footer.quick_links')}</h4>
            <ul className="med-footer-links">
              <li>
                <button type="button" onClick={onNavigateCatalog} className="med-footer-link">
                  <span>📁</span>
                  <span>{t('nav.catalog')}</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={onNavigateSaved} className="med-footer-link">
                  <span>❤️</span>
                  <span>{t('nav.saved')}</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={onNavigateOrders} className="med-footer-link">
                  <span>📦</span>
                  <span>{t('nav.my_orders')}</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={onNavigateSeller} className="med-footer-link">
                  <span>👤</span>
                  <span>{t('nav.seller_mode')}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Contacts & Schedule */}
          <div className="med-footer-col">
            <h4 className="med-footer-heading">{t('footer.support')}</h4>
            <div className="med-footer-info-list">
              <div className="med-footer-info-item">
                <div className="med-footer-info-icon">
                  <Clock size={14} />
                </div>
                <span>{t('footer.schedule')}</span>
              </div>
              
              <div className="med-footer-info-item">
                <div className="med-footer-info-icon">
                  <MapPin size={14} />
                </div>
                <span>
                  {language === 'ru' ? 'г. Ташкент, Юнусабадский р-н, 1-й дехканский базар' : (language === 'en' ? 'Tashkent, Yunusabad district, Dehqon Bazaar #1' : 'Toshkent sh., Yunusobod tumani, 1-dehqon bozori')}
                </span>
              </div>

              <div className="med-footer-info-item">
                <div className="med-footer-info-icon">
                  <Send size={14} />
                </div>
                <a 
                  href="https://t.me/yunusobod_dehqon_bozori_bot" 
                  target="_blank" 
                  rel="noreferrer"
                  className="med-footer-tg-link"
                >
                  @yunusobod_dehqon_bozori_bot
                </a>
              </div>
            </div>
          </div>

          {/* Column 4: Payment Methods */}
          <div className="med-footer-col">
            <h4 className="med-footer-heading">{t('footer.payments')}</h4>
            <div className="med-footer-pay-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <div style={{ background: '#ffffff', borderRadius: '8px', padding: '4px 8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                <ClickLogo height={16} color="blue" />
              </div>
              <div style={{ background: '#ffffff', borderRadius: '8px', padding: '4px 8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                <PaymeLogo height={16} />
              </div>
              <UzcardBadge height={14} />
              <HumoBadge height={14} />
              <span className="med-pay-pill" style={{ margin: 0 }}>
                💵 {language === 'ru' ? 'Наличные' : (language === 'en' ? 'Cash' : 'Naqd pul')}
              </span>
            </div>
            <p className="med-footer-pay-hint">
              {language === 'ru' ? 'Безопасная онлайн оплата или оплата курьеру при получении.' : (language === 'en' ? 'Secure online payment or cash upon delivery.' : 'Xavfsiz to\'lov va kuryerga qabul qilganda to\'lash imkoniyati.')}
            </p>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Location */}
        <div className="med-footer-bottom">
          <p className="med-footer-copyright">
            {t('footer.copyright')}
          </p>
          
          <div className="med-footer-bottom-meta">
            <span>{language === 'ru' ? 'Ташкент, Узбекистан' : (language === 'en' ? 'Tashkent, Uzbekistan' : 'Toshkent, O\'zbekiston')}</span>
            <span className="med-dot-sep">•</span>
            <span className="med-online-badge">Online 24/7</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
