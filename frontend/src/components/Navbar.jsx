import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  ShoppingBag, 
  Store, 
  Package, 
  Lock, 
  Heart, 
  LayoutGrid, 
  Search, 
  User, 
  X,
  Sparkles
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  cartItemsCount, 
  savedItemsCount = 0,
  onOpenCart, 
  onBackToStores,
  searchQuery,
  setSearchQuery,
  onOpenCatalogDrawer
}) {
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
    <header className="med-header sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="bozor-container">
        <div className="med-header-inner">
          
          {/* 1. Brand Logo */}
          <div 
            className="med-brand-wrap cursor-pointer select-none" 
            onClick={() => {
              onBackToStores();
              handleTabChange('market');
            }}
          >
            <div className="med-brand-icon">
              <Store size={20} className="text-white" />
            </div>
            <div className="med-brand-titles">
              <h1 className="med-brand-name">{t('brand.name')}</h1>
              <span className="med-brand-badge">{t('brand.open_hours')}</span>
            </div>
          </div>

          {/* 2. Katalog Button */}
          <button 
            type="button"
            className={`med-catalog-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('light');
              if (onOpenCatalogDrawer) onOpenCatalogDrawer();
              else handleTabChange('market');
            }}
          >
            <LayoutGrid size={18} />
            <span className="med-catalog-label">{t('nav.catalog')}</span>
          </button>

          {/* 3. Search Bar */}
          <div className="med-search-wrap">
            <div className="med-search-box">
              <Search size={17} className="med-search-icon" />
              <input 
                type="search"
                className="med-search-input"
                placeholder={t('products.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  type="button" 
                  className="med-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 4. Desktop Navigation & Action Icons */}
          <div className="med-header-actions">
            
            {/* Wishlist / Saved Items */}
            <button 
              type="button"
              className={`med-action-btn ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => handleTabChange('saved')}
            >
              <div className="relative">
                <Heart size={18} className={savedItemsCount > 0 ? "fill-rose-500 text-rose-500" : ""} />
                {savedItemsCount > 0 && (
                  <span className="med-badge-count bg-rose-500">{savedItemsCount}</span>
                )}
              </div>
              <span className="med-action-label">{t('nav.saved')}</span>
            </button>

            {/* Cart Button */}
            <button 
              type="button"
              className="med-action-btn med-cart-btn"
              onClick={() => {
                triggerHaptic('medium');
                onOpenCart();
              }}
            >
              <div className="relative">
                <ShoppingBag size={18} />
                {cartItemsCount > 0 && (
                  <span className="med-badge-count bg-emerald-600">{cartItemsCount}</span>
                )}
              </div>
              <span className="med-action-label">{t('nav.cart')}</span>
            </button>

            {/* My Orders / Orders Tracker */}
            <button 
              type="button"
              className={`med-action-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => handleTabChange('orders')}
            >
              <Package size={18} />
              <span className="med-action-label">{t('nav.my_orders')}</span>
            </button>

            {/* Seller Login / Portal */}
            <button 
              type="button"
              className={`med-action-btn med-seller-btn ${activeTab === 'seller' ? 'active' : ''}`}
              onClick={() => handleTabChange('seller')}
            >
              <Lock size={16} />
              <span className="med-action-label">{t('nav.seller_mode')}</span>
            </button>

            {/* Language Switcher */}
            <div className="med-lang-pills">
              {['uz', 'ru', 'en'].map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`med-lang-pill ${lang === l ? 'active' : ''}`}
                  onClick={() => handleLangChange(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
