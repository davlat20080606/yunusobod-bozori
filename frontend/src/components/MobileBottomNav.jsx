import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Store, ShoppingBag, Package, UserCheck, Bot } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function MobileBottomNav({ activeTab, setActiveTab, cartItemsCount, onOpenCart }) {
  const { t } = useLanguage();

  const handleTab = (tab) => {
    triggerHaptic('light');
    setActiveTab(tab);
  };

  return (
    <nav className="mobile-bottom-nav">
      <div className="mobile-nav-items">
        <button 
          className={`mobile-nav-btn ${activeTab === 'market' ? 'active' : ''}`}
          onClick={() => handleTab('market')}
        >
          <Store size={20} />
          <span>{t('nav.bazaar')}</span>
        </button>

        <button 
          className={`mobile-nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => handleTab('orders')}
        >
          <Package size={20} />
          <span>{t('nav.my_orders')}</span>
        </button>

        <button 
          className={`mobile-nav-btn ${activeTab === 'seller' ? 'active' : ''}`}
          onClick={() => handleTab('seller')}
        >
          <UserCheck size={20} />
          <span>{t('nav.seller_mode')}</span>
        </button>

        <button 
          className="mobile-nav-btn"
          onClick={() => {
            triggerHaptic('medium');
            onOpenCart();
          }}
        >
          <div style={{ position: 'relative' }}>
            <ShoppingBag size={20} />
            {cartItemsCount > 0 && (
              <span 
                className="cart-badge animate-scale" 
                style={{ position: 'absolute', top: '-6px', right: '-10px', fontSize: '0.65rem', padding: '1px 5px' }}
              >
                {cartItemsCount}
              </span>
            )}
          </div>
          <span>{t('nav.cart')}</span>
        </button>
      </div>
    </nav>
  );
}
