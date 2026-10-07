import React, { useState, useEffect } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { api } from './services/api';
import { initTelegramApp, triggerHaptic } from './services/telegram';

import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import CategoryPills from './components/CategoryPills';
import DiscountsSection from './components/DiscountsSection';
import CategorizedSections from './components/CategorizedSections';
import CatalogView from './components/CatalogView';
import SavedView from './components/SavedView';
import StoreSelector from './components/StoreSelector';
import StoreDetailView from './components/StoreDetailView';
import ProductCard from './components/ProductCard';
import ProductDetailView from './components/ProductDetailView';
import ProductMediaModal from './components/ProductMediaModal';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import SellerPanel from './components/SellerPanel';
import SellerPinGate from './components/SellerPinGate';
import PorterPanel from './components/PorterPanel';
import OrderTracker from './components/OrderTracker';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';

import { Search, Sparkles, ChevronRight, Store, ShoppingBag, X } from 'lucide-react';

export default function App() {
  const { getLocalized, t } = useLanguage();

  // Active Navigation Tab: 'market' | 'catalog' | 'saved' | 'orders' | 'seller' | 'porter'
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (tab && ['market', 'catalog', 'saved', 'orders', 'seller', 'porter'].includes(tab)) return tab;
    } catch {}
    return 'market';
  });

  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Media Inspection Modal
  const [selectedMediaProduct, setSelectedMediaProduct] = useState(null);

  // Cart State (In-session only, resets when user closes and re-enters the bot)
  const [cart, setCart] = useState(() => {
    try {
      // Clear any legacy persistent localStorage cart
      localStorage.removeItem('yunusobod_cart');
      localStorage.removeItem('yunusobod_cart_time');
      const saved = sessionStorage.getItem('yunusobod_session_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Saved / Wishlist State (Local Storage)
  const [savedProductIds, setSavedProductIds] = useState(() => {
    try {
      const saved = localStorage.getItem('yunusobod_saved');
      return saved ? JSON.parse(saved) : [5, 11]; // default heart on lamb & melon
    } catch {
      return [5, 11];
    }
  });

  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [pickerNotes, setPickerNotes] = useState('');
  const [activeOrderNumber, setActiveOrderNumber] = useState(() => {
    try {
      return localStorage.getItem('yunusobod_last_order') || '';
    } catch {
      return '';
    }
  });
  const [sellerUnlocked, setSellerUnlocked] = useState(false);

  // Initialize Telegram WebApp SDK
  useEffect(() => {
    initTelegramApp();

    const updateDimensions = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.onEvent?.('viewportChanged', updateDimensions);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, []);

  // Save Cart to SessionStorage only (erased on bot exit/reopen)
  useEffect(() => {
    try {
      sessionStorage.setItem('yunusobod_session_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  // Save Wishlist to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('yunusobod_saved', JSON.stringify(savedProductIds));
    } catch (e) {
      console.error(e);
    }
  }, [savedProductIds]);

  // Validate active order with backend on startup (auto-remove ghost/stale orders)
  useEffect(() => {
    if (!activeOrderNumber) return;
    api.getOrder(activeOrderNumber)
      .then((order) => {
        if (!order || order.status === 'delivered') {
          setActiveOrderNumber('');
          try { localStorage.removeItem('yunusobod_last_order'); } catch {}
        }
      })
      .catch(() => {
        // Order does not exist on server -> purge ghost banner immediately
        setActiveOrderNumber('');
        try { localStorage.removeItem('yunusobod_last_order'); } catch {}
      });
  }, [activeOrderNumber]);

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

  // Toggle Wishlist
  const handleToggleSave = (productId) => {
    setSavedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  // Cart Actions
  const handleAddToCart = (product, quantity) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: +(item.quantity + quantity).toFixed(2) }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const handleUpdateCartQuantity = (productId, delta) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const step = item.product.step_weight || 0.5;
            const newQty = +(item.quantity + delta * step).toFixed(2);
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const handleRemoveFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Filter Products by Category & Search
  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory ? product.category_slug === activeCategory : true;
    const matchesSearch = searchQuery
      ? (product.name_uz + product.name_ru + product.name_en + product.description_uz + product.description_ru)
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      : true;
    return matchesCategory && matchesSearch;
  });

  const savedProducts = products.filter((p) => savedProductIds.includes(p.id));
  const cartItemsCount = cart.reduce((sum, item) => sum + (item.quantity > 0 ? 1 : 0), 0);
  const cartTotal = cart.reduce((sum, item) => sum + ((item.product?.price || 0) * (item.quantity || 1)), 0);

  // Global Home reset handler (closes product view, store view, search and resets to main market)
  const handleGoHome = () => {
    triggerHaptic('selection');
    setSelectedProduct(null);
    setSelectedStore(null);
    setActiveCategory('');
    setSearchQuery('');
    setActiveTab('market');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      
      {/* 1. TOP NAVBAR (Pixel-Perfect MedBaza Style) */}
      <Navbar 
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setSelectedProduct(null);
          if (tab === 'market') {
            handleGoHome();
          } else {
            setActiveTab(tab);
          }
        }}
        cartItemsCount={cartItemsCount}
        savedItemsCount={savedProductIds.length}
        onOpenCart={() => setCartDrawerOpen(true)}
        selectedStore={selectedStore}
        onBackToStores={handleGoHome}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenCatalogDrawer={() => {
          setSelectedProduct(null);
          setActiveTab('catalog');
        }}
      />

      {/* 2. MAIN APP CONTENT CONTAINER */}
      {/* ACTIVE ORDER LIVE TRACKER BANNER */}
      {activeOrderNumber && activeTab !== 'orders' && !selectedProduct && (
        <div className="bozor-container" style={{ paddingTop: '8px', paddingBottom: '0' }}>
          <div 
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('orders');
            }}
            style={{
              background: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
              color: '#ffffff',
              padding: '10px 14px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
              border: '1px solid #10b981'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem'
              }}>
                🛵
              </div>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 800 }}>
                  {t('tracker.title')}: #{activeOrderNumber}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#a7f3d0' }}>
                  {t('tracker.status_on_the_way')} — {t('tracker.back_to_market')} →
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ChevronRight size={18} color="#a7f3d0" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveOrderNumber('');
                  try { localStorage.removeItem('yunusobod_last_order'); } catch {}
                }}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0
                }}
                title="Скрыть"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full">
        <div className="bozor-container">
          
          {selectedProduct ? (
            /* FULL PRODUCT DETAIL VIEW (MEDBAZA / UZUM STYLE) */
            <ProductDetailView 
              product={selectedProduct}
              onBack={() => setSelectedProduct(null)}
              onAddToCart={handleAddToCart}
              onSelectCategory={(slug) => {
                setSelectedProduct(null);
                setActiveCategory(slug);
                setActiveTab('catalog');
              }}
              isSaved={savedProductIds.includes(selectedProduct.id)}
              onToggleSave={handleToggleSave}
              relatedProducts={products.filter((p) => p.category_slug === selectedProduct.category_slug && p.id !== selectedProduct.id)}
              onSelectProduct={setSelectedProduct}
            />
          ) : (
            <>
              {/* VIEW A: SELLER MANAGEMENT PANEL (PIN-protected) */}
              {activeTab === 'seller' && !sellerUnlocked && (
                <SellerPinGate
                  onUnlock={() => setSellerUnlocked(true)}
                  onCancel={() => setActiveTab('market')}
                  onOpenPorter={() => setActiveTab('porter')}
                />
              )}
              {activeTab === 'seller' && sellerUnlocked && (
                <SellerPanel 
                  onProductPriceUpdated={loadInitialData}
                  onBackToMarket={() => {
                    setSellerUnlocked(false);
                    setActiveTab('market');
                  }}
                />
              )}

              {/* VIEW A2: ARAVACHI (BAZAAR PORTER) PANEL */}
              {activeTab === 'porter' && (
                <PorterPanel onBackToMarket={() => setActiveTab('market')} />
              )}

              {/* VIEW B: ORDER TRACKER */}
              {activeTab === 'orders' && (
                <OrderTracker 
                  initialOrderNumber={activeOrderNumber}
                  onBackToMarket={() => setActiveTab('market')}
                  onOrderNotFound={() => {
                    setActiveOrderNumber('');
                    try { localStorage.removeItem('yunusobod_last_order'); } catch {}
                  }}
                />
              )}

              {/* VIEW C: SAVED / WISHLIST ITEMS */}
              {activeTab === 'saved' && (
                <SavedView 
                  savedProducts={savedProducts}
                  onAddToCart={handleAddToCart}
                  onOpenMediaModal={setSelectedProduct}
                  savedProductIds={savedProductIds}
                  onToggleSave={handleToggleSave}
                  onBackToMarket={() => setActiveTab('market')}
                />
              )}

              {/* VIEW D: FULL CATALOG VIEW */}
              {activeTab === 'catalog' && (
                <CatalogView 
                  categories={categories}
                  products={products}
                  activeCategory={activeCategory}
                  onSelectCategory={setActiveCategory}
                  onAddToCart={handleAddToCart}
                  onOpenMediaModal={setSelectedProduct}
                  savedProductIds={savedProductIds}
                  onToggleSave={handleToggleSave}
                  onSelectStore={(store) => {
                    setSelectedStore(store);
                    setActiveTab('market');
                    window.scrollTo(0, 0);
                  }}
                />
              )}

              {/* VIEW E: MAIN BAZAAR HOMEPAGE */}
              {activeTab === 'market' && (
                <>
                  {selectedStore ? (
                    /* STORE DETAIL VIEW (e.g. Karen Aka Meat Stall) */
                    <StoreDetailView 
                      store={selectedStore}
                      products={selectedStore.products?.length > 0 ? selectedStore.products : products.filter((p) => p.store_id === selectedStore.id)}
                      onBack={() => {
                        setSelectedStore(null);
                        window.scrollTo(0, 0);
                      }}
                      onAddToCart={handleAddToCart}
                      onOpenMediaModal={setSelectedProduct}
                    />
                  ) : (
                    /* BAZAAR MAIN STOREFRONT */
                    <div className="animate-fade">
                      
                      {/* 1. Modern Hero Banner Carousel */}
                      <HeroBanner 
                        onSelectCategory={(slug) => {
                          setActiveCategory(slug);
                          setActiveTab('catalog');
                        }}
                      />

                      {/* 2. Category Quick Squircle Strip (Bo'limlar) */}
                      <CategoryPills 
                        categories={categories}
                        activeCategory={activeCategory}
                        onSelectCategory={(slug) => {
                          setActiveCategory(slug);
                          setActiveTab('catalog');
                        }}
                        products={products}
                      />

                      {/* 3. Categorized Sections with Themed Banners (MoboSELL / Uzum layout) */}
                      <CategorizedSections 
                        products={products}
                        categories={categories}
                        onAddToCart={handleAddToCart}
                        onOpenMediaModal={setSelectedProduct}
                        savedProductIds={savedProductIds}
                        onToggleSave={handleToggleSave}
                      />

                      {/* 4. Trusted Bazaar Stalls / Stores Grid */}
                      <StoreSelector 
                        stores={stores}
                        selectedStore={selectedStore}
                        onSelectStore={(store) => {
                          setSelectedStore(store);
                          window.scrollTo(0, 0);
                        }}
                      />

                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </main>

      {/* Modern E-Commerce Enterprise Footer */}
      <Footer 
        onNavigateCatalog={() => setActiveTab('catalog')}
        onNavigateSaved={() => setActiveTab('saved')}
        onNavigateSeller={() => setActiveTab('seller')}
        onNavigatePorter={() => setActiveTab('porter')}
        onNavigateOrders={() => setActiveTab('orders')}
      />

      {/* Floating Quick Checkout Bar when Cart has Items */}
      {cartItemsCount > 0 && !cartDrawerOpen && !checkoutModalOpen && (
        <div 
          className="floating-cart-bar animate-fade"
          onClick={() => {
            triggerHaptic('medium');
            setCartDrawerOpen(true);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="floating-cart-badge">
              <ShoppingBag size={15} />
              <span>{cartItemsCount}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                {cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toLocaleString()} UZS
              </span>
              <span style={{ fontSize: '0.7rem', color: '#a7f3d0', fontWeight: 600 }}>
                {t('cart.title')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 800, color: '#ffffff' }}>
            <span>{t('cart.checkout_btn')}</span>
            <ChevronRight size={16} />
          </div>
        </div>
      )}

      {/* 3. MOBILE BOTTOM NAV (Floating Blur Bar) */}
      <MobileBottomNav 
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setSelectedProduct(null);
          if (tab === 'market') {
            handleGoHome();
          } else {
            setActiveTab(tab);
          }
        }}
        cartItemsCount={cartItemsCount}
        savedItemsCount={savedProductIds.length}
        onOpenCart={() => setCartDrawerOpen(true)}
        onBackToStores={handleGoHome}
        onGoHome={handleGoHome}
      />

      {/* 4. CART DRAWER */}
      <CartDrawer 
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onCheckout={() => {
          setCartDrawerOpen(false);
          setCheckoutModalOpen(true);
        }}
        pickerNotes={pickerNotes}
        setPickerNotes={setPickerNotes}
      />

      {/* 5. CHECKOUT MODAL */}
      <CheckoutModal 
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        cart={cart}
        pickerNotes={pickerNotes}
        grandTotal={cartTotal + (cartTotal > 0 ? 15000 : 0)}
        onOrderSuccess={(orderNum) => {
          setCheckoutModalOpen(false);
          setActiveOrderNumber(orderNum);
          try {
            localStorage.setItem('yunusobod_last_order', orderNum);
          } catch {}
          handleClearCart();
          setActiveTab('orders');
        }}
      />

      {/* 6. PRODUCT DETAILS (UZUM MARKET STYLE) MODAL */}
      <ProductMediaModal 
        isOpen={Boolean(selectedMediaProduct)}
        product={selectedMediaProduct}
        onClose={() => setSelectedMediaProduct(null)}
        onAddToCart={(p, qty) => {
          handleAddToCart(p, qty);
        }}
        isSaved={selectedMediaProduct ? savedProductIds.includes(selectedMediaProduct.id) : false}
        onToggleSave={handleToggleSave}
      />

    </div>
  );
}
