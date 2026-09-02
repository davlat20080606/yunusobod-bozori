import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  Home, 
  LayoutGrid, 
  Heart, 
  ShoppingBag, 
  Store,
  Package
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function MobileBottomNav({ 
  activeTab, 
  setActiveTab, 
  cartItemsCount, 
  savedItemsCount = 0,
  onOpenCart,
  onBackToStores,
  onGoHome
}) {
  const { t, language } = useLanguage();

  const handleNavClick = (tab) => {
    triggerHaptic('selection');
    if (tab === 'market') {
      if (onGoHome) {
        onGoHome();
      } else if (onBackToStores) {
        onBackToStores();
      }
      setActiveTab('market');
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <nav className="med-bottom-nav">
      <div className="med-bottom-nav-inner">
        
        {/* 1. Asosiy / Home */}
        <button
          type="button"
          className={`med-nav-item ${activeTab === 'market' ? 'active' : ''}`}
          onClick={() => handleNavClick('market')}
        >
          <div className="med-nav-icon-box">
            <Home size={21} />
          </div>
          <span className="med-nav-text">{t('nav.home')}</span>
        </button>

        {/* 2. Katalog / Categories */}
        <button
          type="button"
          className={`med-nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => handleNavClick('catalog')}
        >
          <div className="med-nav-icon-box">
            <LayoutGrid size={21} />
          </div>
          <span className="med-nav-text">{t('nav.catalog')}</span>
        </button>

        {/* 3. Buyurtmalar / Orders */}
        <button
          type="button"
          className={`med-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => handleNavClick('orders')}
        >
          <div className="med-nav-icon-box relative">
            <Package size={21} />
          </div>
          <span className="med-nav-text">
            {language === 'ru' ? 'Заказы' : (language === 'en' ? 'Orders' : 'Buyurtmalar')}
          </span>
        </button>

        {/* 4. Saralangan / Saved */}
        <button
          type="button"
          className={`med-nav-item ${activeTab === 'saved' ? 'active' : ''}`}
          onClick={() => handleNavClick('saved')}
        >
          <div className="med-nav-icon-box relative">
            <Heart size={21} className={savedItemsCount > 0 ? "fill-rose-500 text-rose-500" : ""} />
            {savedItemsCount > 0 && (
              <span className="med-nav-badge bg-rose-500">{savedItemsCount}</span>
            )}
          </div>
          <span className="med-nav-text">{t('nav.saved')}</span>
        </button>

        {/* 5. Sotuvchi kabineti / Seller Panel */}
        <button
          type="button"
          className={`med-nav-item ${activeTab === 'seller' ? 'active' : ''}`}
          onClick={() => handleNavClick('seller')}
        >
          <div className="med-nav-icon-box">
            <Store size={21} />
          </div>
          <span className="med-nav-text">
            {language === 'ru' ? 'Продавец' : (language === 'en' ? 'Seller' : 'Sotuvchi')}
          </span>
        </button>

      </div>
    </nav>
  );
}
