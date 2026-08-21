import React, { useState, useEffect } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { api } from './services/api';
import { initTelegramApp } from './services/telegram';

import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import CategoryPills from './components/CategoryPills';
import StoreSelector from './components/StoreSelector';
import StoreDetailView from './components/StoreDetailView';
import ProductCard from './components/ProductCard';
import ProductMediaModal from './components/ProductMediaModal';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import SellerPanel from './components/SellerPanel';
import OrderTracker from './components/OrderTracker';
import TelegramBotSimulator from './components/TelegramBotSimulator';
import MobileBottomNav from './components/MobileBottomNav';

import { Search, Sparkles, AlertCircle } from 'lucide-react';

export default function App() {
  const { getLocalized, t } = useLanguage();

  // App State
  const [activeTab, setActiveTab] = useState('market'); // 'market', 'orders', 'seller', 'bot_sim'
  const [selectedStore, setSelectedStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Media Inspection Modal
  const [selectedMediaProduct, setSelectedMediaProduct] = useState(null);

  // Cart & Checkout
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('yunusobod_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [pickerNotes, setPickerNotes] = useState('');
  const [activeOrderNumber, setActiveOrderNumber] = useState('');

  // Initialize Telegram WebApp SDK
  useEffect(() => {
    initTelegramApp();
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['market', 'orders', 'seller', 'bot_sim'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  // Save Cart to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('yunusobod_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  // Load Data from API
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [catList, storeList, prodList] = await Promise.all([
        api.getCategories(),
        api.getStores(),
        api.getProducts()
      ]);
      setCategories(catList);
      setStores(storeList);
      setProducts(prodList);
    } catch (err) {
      console.warn('API error, using local fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  // When seller updates price, refresh data
  const handleRefreshData = async () => {
    try {
      const [storeList, prodList] = await Promise.all([
        api.getStores(),
        api.getProducts()
      ]);
      setStores(storeList);
      setProducts(prodList);
      if (selectedStore) {
        const updatedDetail = await api.getStoreDetail(selectedStore.slug);
        setSelectedStore(updatedDetail);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Select Store Action
  const handleSelectStore = async (store) => {
    try {
      const fullStore = await api.getStoreDetail(store.slug);
      setSelectedStore(fullStore);
    } catch {
      setSelectedStore(store);
    }
  };

  // Cart Operations
  const handleAddToCart = (product, quantity) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: +(item.quantity + quantity).toFixed(2) }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const handleUpdateCartQty = (productId, newQty) => {
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const handleRemoveCartItem = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleProceedCheckout = () => {
    setCartDrawerOpen(false);
    setCheckoutModalOpen(true);
  };

  const handleSubmitOrder = async (orderPayload) => {
    const order = await api.createOrder(orderPayload);
    setActiveOrderNumber(order.order_number);
    setCart([]);
    localStorage.removeItem('yunusobod_cart');
    setActiveTab('orders');
    return order;
  };

  // Filter stores & products
  const filteredStores = stores.filter(s => {
    if (activeCategory && s.category_slug !== activeCategory) return false;
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      return (
        (s.name_uz && s.name_uz.toLowerCase().includes(term)) ||
        (s.name_ru && s.name_ru.toLowerCase().includes(term)) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const featuredProducts = products.filter(p => p.is_featured);

  const cartTotalItems = cart.reduce((count, item) => count + 1, 0);
  const itemsTotalSum = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const grandTotal = itemsTotalSum + (cart.length > 0 ? 15000 : 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartItemsCount={cartTotalItems}
        onOpenCart={() => setCartDrawerOpen(true)}
        selectedStore={selectedStore}
        onBackToStores={() => setSelectedStore(null)}
      />

      <main style={{ flex: 1 }}>
        {/* TAB 1: BAZAAR MARKETPLACE */}
        {activeTab === 'market' && (
          <div className="bozor-container">
            {/* If inside specific store */}
            {selectedStore ? (
              <div style={{ paddingTop: '20px' }}>
                <StoreDetailView 
                  store={selectedStore}
                  onBack={() => setSelectedStore(null)}
                  onAddToCart={handleAddToCart}
                  onOpenMediaModal={(prod) => setSelectedMediaProduct(prod)}
                />
              </div>
            ) : (
              <div>
                {/* Hero Banner */}
                <HeroBanner 
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />

                {/* Global Search Bar */}
                <div className="search-wrapper">
                  <div className="search-input-box">
                    <Search size={20} color="#047857" />
                    <input 
                      type="text" 
                      placeholder={t('products.search_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Categories Scrollbar */}
                <CategoryPills 
                  categories={categories}
                  activeCategory={activeCategory}
                  onSelectCategory={setActiveCategory}
                />

                {/* Bazaar Stores Grid */}
                <StoreSelector 
                  stores={filteredStores}
                  onSelectStore={handleSelectStore}
                />

                {/* Featured Products of the Bazaar */}
                {!searchQuery && !activeCategory && featuredProducts.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div className="section-header">
                      <div>
                        <h2>🔥 {t('products.featured')}</h2>
                        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Har tong saralangan va eng ko'p xarid qilinadigan mahsulotlar</p>
                      </div>
                    </div>

                    <div className="products-grid">
                      {featuredProducts.slice(0, 8).map(product => (
                        <ProductCard 
                          key={product.id}
                          product={product}
                          onAddToCart={handleAddToCart}
                          onOpenMediaModal={(prod) => setSelectedMediaProduct(prod)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY ORDERS & LIVE TRACKER */}
        {activeTab === 'orders' && (
          <OrderTracker 
            activeOrderNumber={activeOrderNumber}
            onBackToShopping={() => {
              setSelectedStore(null);
              setActiveTab('market');
            }}
          />
        )}

        {/* TAB 3: SELLER PORTAL & PRICE CONTROL */}
        {activeTab === 'seller' && (
          <SellerPanel onProductPriceUpdated={handleRefreshData} />
        )}
      </main>

      {/* Product Video / Photo Media Modal */}
      <ProductMediaModal 
        isOpen={!!selectedMediaProduct}
        onClose={() => setSelectedMediaProduct(null)}
        product={selectedMediaProduct}
        onAddToCart={handleAddToCart}
      />

      {/* Cart Drawer */}
      <CartDrawer 
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        cart={cart}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onProceedCheckout={handleProceedCheckout}
        notes={pickerNotes}
        setNotes={setPickerNotes}
      />

      {/* Checkout Modal */}
      <CheckoutModal 
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        cart={cart}
        notes={pickerNotes}
        grandTotal={grandTotal}
        onSubmitOrder={handleSubmitOrder}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartItemsCount={cartTotalItems}
        onOpenCart={() => setCartDrawerOpen(true)}
      />
    </div>
  );
}
