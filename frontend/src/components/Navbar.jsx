import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ShoppingBag, Store, Package, UserCheck, Bot, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function Navbar({ activeTab, setActiveTab, cartItemsCount, onOpenCart, selectedStore, onBackToStores }) {
  const { lang, setLang, t } = useLanguage();

  const handleTabChange = (tab) => {
    triggerHaptic('light');
    setActiveTab(tab);
  };

  const handleLangChange = (newLang) => {
    triggerHaptic('selection');
    setLang(newLang);
  };

  return (
    <header className="navbar-header">
      <div className="bozor-container">
        <div className="navbar-inner">
          {/* Brand Logo */}
          <div 
            className="brand-logo" 
            onClick={() => {
              onBackToStores();
              handleTabChange('market');
            }}
          >
            <img 
              src="/logo.jpg" 
              alt="Yunusobod Bozori" 
              style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 4px 10px rgba(6, 78, 59, 0.25)' }} 
            />
            <div className="brand-info">
              <h1 className="font-heading">Yunusobod Bozori</h1>
              <span>{t('brand.open_hours')}</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="desktop-nav-links" style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`nav-btn ${activeTab === 'market' ? 'nav-btn-primary' : ''}`}
              onClick={() => handleTabChange('market')}
            >
              <Store size={18} />
              <span>{t('nav.bazaar')}</span>
            </button>

            <button 
              className={`nav-btn ${activeTab === 'orders' ? 'nav-btn-primary' : ''}`}
              onClick={() => handleTabChange('orders')}
            >
              <Package size={18} />
              <span>{t('nav.my_orders')}</span>
            </button>

            <button 
              className={`nav-btn ${activeTab === 'seller' ? 'nav-btn-primary' : ''}`}
              onClick={() => handleTabChange('seller')}
              style={{ borderColor: '#f59e0b', color: activeTab === 'seller' ? '#fff' : '#b45309' }}
            >
              <UserCheck size={18} />
              <span>{t('nav.seller_mode')}</span>
            </button>
          </nav>

          {/* Right Actions: Lang Switcher & Cart */}
          <div className="nav-actions">
            <div className="lang-switcher">
              <button 
                className={`lang-btn ${lang === 'uz' ? 'active' : ''}`}
                onClick={() => handleLangChange('uz')}
              >
                UZ
              </button>
              <button 
                className={`lang-btn ${lang === 'ru' ? 'active' : ''}`}
                onClick={() => handleLangChange('ru')}
              >
                RU
              </button>
              <button 
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => handleLangChange('en')}
              >
                EN
              </button>
            </div>

            <button 
              className="nav-btn nav-btn-primary" 
              onClick={() => {
                triggerHaptic('medium');
                onOpenCart();
              }}
              style={{ position: 'relative' }}
            >
              <ShoppingBag size={20} />
              <span className="desktop-nav-links">{t('nav.cart')}</span>
              {cartItemsCount > 0 && (
                <span className="cart-badge animate-scale">{cartItemsCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
