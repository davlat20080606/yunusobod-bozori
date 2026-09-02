import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { Store, DollarSign, CheckCircle2, ToggleLeft, ToggleRight, RefreshCw, Package, Check, Save, PlusCircle, X, Image, Video, Sparkles, Upload, Lock, ShieldCheck, Camera, LogOut, Settings, Edit3 } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { formatUnit } from './ProductCard';

const PHOTO_PRESETS = [
  { name: '🥩 Go\'sht / Мясо', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&auto=format&fit=crop&q=80', video: 'https://assets.mixkit.co/videos/preview/mixkit-meat-skewers-sizzling-over-a-grill-42996-large.mp4' },
  { name: '🍅 Pomidor / Овощи', image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80', video: 'https://assets.mixkit.co/videos/preview/mixkit-slicing-a-ripe-red-tomato-41712-large.mp4' },
  { name: '🍈 Qovun / Фрукты', image: 'https://images.unsplash.com/photo-1595855759920-86582396756a?w=600&auto=format&fit=crop&q=80', video: 'https://assets.mixkit.co/videos/preview/mixkit-hands-cutting-a-cantaloupe-melon-into-slices-41714-large.mp4' },
  { name: '🥖 Non / Выпечка', image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&auto=format&fit=crop&q=80', video: 'https://assets.mixkit.co/videos/preview/mixkit-steam-rising-from-freshly-baked-bread-41724-large.mp4' },
  { name: '🥜 Quruq meva / Орехи', image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&auto=format&fit=crop&q=80', video: 'https://assets.mixkit.co/videos/preview/mixkit-pouring-mixed-nuts-into-a-wooden-bowl-41720-large.mp4' },
  { name: '🧀 Qaymoq / Молочка', image: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=600&auto=format&fit=crop&q=80', video: 'https://assets.mixkit.co/videos/preview/mixkit-pouring-fresh-milk-into-a-glass-41722-large.mp4' },
];

export default function SellerPanel({ onProductPriceUpdated, onBackToMarket }) {
  const { getLocalized, t, language } = useLanguage();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [incomingOrders, setIncomingOrders] = useState([]);

  // Seller Authentication (PIN Security)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('seller_auth_status') === 'true';
  });
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Monetization Modals
  const [showSubModal, setShowSubModal] = useState(false);
  const [showCommModal, setShowCommModal] = useState(false);

  // Store Edit Settings Modal
  const [showEditStoreModal, setShowEditStoreModal] = useState(false);
  const [editStoreForm, setEditStoreForm] = useState({
    name_uz: '',
    owner_name: '',
    owner_phone: '',
    stall_number: '',
    pin: ''
  });
  const [editStoreLoading, setEditStoreLoading] = useState(false);

  // Add Product Modal & Media Upload
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [productForm, setProductForm] = useState({
    name_uz: '',
    name_ru: '',
    category_slug: 'meat',
    price: '',
    unit: 'kg',
    min_weight: 0.5,
    step_weight: 0.5,
    image_url: PHOTO_PRESETS[0].image,
    video_url: PHOTO_PRESETS[0].video,
    description_uz: '',
    description_ru: ''
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [addProductLoading, setAddProductLoading] = useState(false);

  // New Store Registration Modal
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm, setRegForm] = useState({
    name_uz: '',
    name_ru: '',
    stall_number: '',
    owner_name: '',
    owner_phone: '+998 ',
    category_slug: 'meat',
    pin: '1234'
  });
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const list = await api.getAvailableSellerStores();
      setStores(list);
      const karenStore = list.find(s => s.owner_name?.toLowerCase().includes('karen') || s.slug?.includes('karen'));
      if (karenStore) {
        selectStore(karenStore.id);
      } else if (list.length > 0) {
        selectStore(list[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectStore = async (storeId) => {
    setSelectedStoreId(storeId);
    setLoading(true);
    try {
      const data = await api.getMyStoreDashboard(storeId);
      setStoreData(data);
      
      // Pre-fill edit form
      setEditStoreForm({
        name_uz: data.store.name_uz || '',
        owner_name: data.store.owner_name || '',
        owner_phone: data.store.owner_phone || '',
        stall_number: data.store.stall_number || '',
        pin: ''
      });

      const initialPrices = {};
      data.products.forEach(p => {
        initialPrices[p.id] = p.price;
      });
      setEditingPrices(initialPrices);

      const orders = await api.getStoreOrders(storeId);
      setIncomingOrders(orders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    const pin = enteredPin.trim();
    
    // Master admin pins or store-specific pins
    const matchedStore = stores.find(s => s.pin === pin);
    const isMasterPin = ['2222', '1234', '0000', '2026'].includes(pin);

    if (matchedStore) {
      triggerHaptic('success');
      setIsAuthenticated(true);
      localStorage.setItem('seller_auth_status', 'true');
      selectStore(matchedStore.id);
      setPinError('');
    } else if (isMasterPin) {
      triggerHaptic('success');
      setIsAuthenticated(true);
      localStorage.setItem('seller_auth_status', 'true');
      setPinError('');
    } else {
      triggerHaptic('error');
      setPinError('Noto\'g\'ri PIN-kod! (Неверный PIN-код)');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('seller_auth_status');
    if (onBackToMarket) onBackToMarket();
  };

  // Direct Gallery / Camera Image Upload Handler
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    try {
      const res = await api.uploadMedia(file);
      triggerHaptic('light');
      setProductForm(prev => ({ ...prev, image_url: res.url }));
    } catch (err) {
      const reader = new FileReader();
      reader.onload = () => {
        setProductForm(prev => ({ ...prev, image_url: reader.result }));
      };
      reader.readAsDataURL(file);
    } finally {
      setImageUploading(false);
    }
  };

  // Direct Gallery / Camera Video Upload Handler
  const handleVideoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoUploading(true);
    try {
      const res = await api.uploadMedia(file);
      triggerHaptic('light');
      setProductForm(prev => ({ ...prev, video_url: res.url }));
    } catch (err) {
      alert('Video yuklashda xatolik yuz berdi');
    } finally {
      setVideoUploading(false);
    }
  };

  const handlePriceChange = (productId, newPrice) => {
    setEditingPrices(prev => ({
      ...prev,
      [productId]: Number(newPrice)
    }));
  };

  const handleSavePrice = async (productId) => {
    triggerHaptic('medium');
    const newPrice = editingPrices[productId];
    try {
      await api.updateProductPrice(productId, newPrice);
      setSuccessMsg(`${t('seller.price_updated_success')} (${newPrice.toLocaleString()} UZS)`);
      setTimeout(() => setSuccessMsg(''), 2500);
      if (onProductPriceUpdated) onProductPriceUpdated();
    } catch (e) {
      alert('Narxni saqlashda xatolik');
    }
  };

  const handleToggleStock = async (product) => {
    triggerHaptic('light');
    try {
      const res = await api.toggleProductAvailability(product.id, !product.is_available);
      setStoreData(prev => ({
        ...prev,
        products: prev.products.map(p => p.id === product.id ? { ...p, is_available: res.is_available } : p)
      }));
      if (onProductPriceUpdated) onProductPriceUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleStoreStatus = async () => {
    triggerHaptic('medium');
    try {
      const res = await api.toggleStoreStatus(selectedStoreId);
      setStoreData(prev => ({
        ...prev,
        store: { ...prev.store, is_open: res.is_open }
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditStoreSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStoreId) return;
    setEditStoreLoading(true);
    try {
      const payload = {
        name_uz: editStoreForm.name_uz,
        name_ru: editStoreForm.name_uz,
        owner_name: editStoreForm.owner_name,
        owner_phone: editStoreForm.owner_phone,
        stall_number: editStoreForm.stall_number
      };
      if (editStoreForm.pin) payload.pin = editStoreForm.pin;

      const res = await api.updateStoreProfile(selectedStoreId, payload);
      triggerHaptic('success');
      setShowEditStoreModal(false);
      setStoreData(prev => ({ ...prev, store: res.store }));
      await loadStores();
      setSuccessMsg(`✅ Ma'lumotlar saqlandi: ${res.store.owner_name} (${res.store.owner_phone})`);
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      alert(err.message || 'Xatolik');
    } finally {
      setEditStoreLoading(false);
    }
  };

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStoreId) return;
    setAddProductLoading(true);
    try {
      const res = await api.createProduct(selectedStoreId, {
        ...productForm,
        price: Number(productForm.price),
        min_weight: Number(productForm.min_weight),
        step_weight: Number(productForm.step_weight)
      });
      triggerHaptic('success');
      setShowAddProductModal(false);
      await selectStore(selectedStoreId);
      setSuccessMsg(`🎉 "${res.product.name_uz}" muvaffaqiyatli qo'shildi!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      if (onProductPriceUpdated) onProductPriceUpdated();
    } catch (err) {
      alert(err.message || 'Xatolik');
    } finally {
      setAddProductLoading(false);
    }
  };

  const handleRegisterStoreSubmit = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    try {
      const res = await api.registerStore(regForm);
      triggerHaptic('success');
      setShowRegModal(false);
      await loadStores();
      selectStore(res.store.id);
      setSuccessMsg(`🎉 ${res.store.name_uz} muvaffaqiyatli qo'shildi!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Xatolik');
    } finally {
      setRegLoading(false);
    }
  };

  // 1. PIN PROTECTION SCREEN FOR BUYER PRIVACY
  if (!isAuthenticated) {
    return (
      <div className="bozor-container animate-fade" style={{ paddingTop: '40px', paddingBottom: '60px', maxWidth: '420px', margin: '0 auto' }}>
        <div 
          style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 24px',
            boxShadow: 'var(--shadow-md)',
            textAlign: 'center',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={28} />
          </div>

          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            {t('seller.login_title')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '24px' }}>
            {t('seller.login_desc')}
          </p>

          <form onSubmit={handlePinSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="password"
                maxLength="4"
                className="form-input"
                placeholder="• • • •"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                autoFocus
                style={{
                  textAlign: 'center',
                  fontSize: '1.6rem',
                  letterSpacing: '12px',
                  fontWeight: 800,
                  height: '54px'
                }}
              />
              {pinError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '6px', fontWeight: 600 }}>{pinError}</div>}
            </div>

            <button 
              type="submit" 
              className="add-cart-btn" 
              style={{ height: '48px', marginBottom: '12px' }}
            >
              <ShieldCheck size={18} />
              <span>{t('seller.login_btn')} (PIN: 1234)</span>
            </button>

            {/* Quick 1-click select for bazaar vendors */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '8px', fontWeight: 700 }}>
                {language === 'ru' ? '⚡️ Или выберите свой прилавок:' : '⚡️ Yoki rastangizni tanlang:'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                {stores.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('success');
                      setIsAuthenticated(true);
                      localStorage.setItem('seller_auth_status', 'true');
                      selectStore(s.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <span>🏪 {getLocalized(s, 'name')} ({s.stall_number})</span>
                    <span style={{ color: '#059669', fontSize: '0.75rem' }}>{language === 'ru' ? 'Войти →' : 'Kirish →'}</span>
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="button" 
              onClick={onBackToMarket}
              style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer', padding: '12px 8px 0', marginTop: '8px' }}
            >
              {t('seller.back_to_market_btn')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATED SELLER DASHBOARD
  return (
    <div className="bozor-container animate-fade" style={{ paddingTop: '20px' }}>
      {/* Seller Header */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          color: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f59e0b', color: '#000', padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>
              🏪 {t('seller.title')}
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>{t('seller.panel_title')}</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t('seller.desc')}</p>
          </div>

          {/* Quick Actions & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowRegModal(true)}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <PlusCircle size={16} />
              <span>{t('seller.add_stall')}</span>
            </button>

            <select 
              className="form-select"
              value={selectedStoreId || ''}
              onChange={(e) => selectStore(Number(e.target.value))}
              style={{ background: '#334155', color: '#ffffff', borderColor: '#475569', minWidth: '220px' }}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  {s.stall_number} — {getLocalized(s, 'name')}
                </option>
              ))}
            </select>

            <button 
              onClick={handleLogout}
              style={{ background: '#475569', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
              title={t('seller.logout')}
            >
              <LogOut size={16} />
              <span>{t('seller.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {successMsg && (
        <div style={{ padding: '12px 18px', background: '#dcfce7', color: '#15803d', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ─── SUBSCRIPTION & COMMISSION INFO CARD ─── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Subscription card — clickable */}
        <div
          onClick={() => { triggerHaptic('light'); setShowSubModal(true); }}
          style={{
            background: '#ffffff',
            borderRadius: '16px', padding: '16px',
            border: '2px solid #3b82f6',
            boxShadow: '0 2px 8px rgba(59,130,246,0.1)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='scale(1.02)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(59,130,246,0.18)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(59,130,246,0.1)'; }}
        >
          <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>📅</div>
          <div style={{ fontSize: '0.68rem', color: '#3b82f6', fontWeight: 800, marginBottom: '4px', letterSpacing: '0.03em' }}>
            {language === 'ru' ? 'АБОНЕНТСКАЯ ПЛАТА' : (language === 'en' ? 'SUBSCRIPTION' : 'OBUNA TO\'LOV')}
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e40af', lineHeight: 1.2 }}>
            50 000 UZS
          </div>
          <div style={{ fontSize: '0.71rem', color: '#64748b', marginTop: '4px' }}>
            {language === 'ru' ? '/ месяц за размещение' : (language === 'en' ? '/ month for listing' : '/ oyiga joylashuv')}
          </div>
          <div style={{
            marginTop: '10px',
            background: '#dcfce7', color: '#15803d',
            borderRadius: '8px', padding: '5px 10px',
            fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex',
            alignItems: 'center', gap: '4px'
          }}>
            ✓ {language === 'ru' ? 'Активна' : (language === 'en' ? 'Active' : 'Faol')}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#3b82f6', marginTop: '6px', fontWeight: 600 }}>
            {language === 'ru' ? 'Подробнее →' : 'Batafsil →'}
          </div>
        </div>

        {/* Commission card — clickable */}
        <div
          onClick={() => { triggerHaptic('light'); setShowCommModal(true); }}
          style={{
            background: '#ffffff',
            borderRadius: '16px', padding: '16px',
            border: '2px solid #f59e0b',
            boxShadow: '0 2px 8px rgba(245,158,11,0.1)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='scale(1.02)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(245,158,11,0.18)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(245,158,11,0.1)'; }}
        >
          <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>💰</div>
          <div style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 800, marginBottom: '4px', letterSpacing: '0.03em' }}>
            {language === 'ru' ? 'КОМИССИЯ С ПРОДАЖ' : (language === 'en' ? 'SALES COMMISSION' : 'SAVDO KOMISSIYASI')}
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#92400e', lineHeight: 1.2 }}>
            5%
          </div>
          <div style={{ fontSize: '0.71rem', color: '#64748b', marginTop: '4px' }}>
            {language === 'ru' ? 'с каждого заказа' : (language === 'en' ? 'per each order' : 'har bir buyurtmadan')}
          </div>
          <div style={{
            marginTop: '10px',
            background: '#fef3c7', color: '#92400e',
            borderRadius: '8px', padding: '5px 10px',
            fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex',
            alignItems: 'center', gap: '4px'
          }}>
            {language === 'ru' ? 'Авто-расчёт' : (language === 'en' ? 'Auto-calculated' : 'Avtomatik')}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#d97706', marginTop: '6px', fontWeight: 600 }}>
            {language === 'ru' ? 'Подробнее →' : 'Batafsil →'}
          </div>
        </div>
      </div>

      {/* ─── SUBSCRIPTION MODAL ─── */}
      {showSubModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowSubModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#ffffff', borderRadius: '24px 24px 0 0', padding: '28px 20px 36px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Handle */}
            <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '4px', margin: '0 auto 20px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ fontSize: '2.4rem' }}>📅</div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>
                  {language === 'ru' ? 'Абонентская плата' : 'Obuna to\'lov'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {language === 'ru' ? 'Тарифы и условия размещения' : 'Narxlar va shartlar'}
                </div>
              </div>
            </div>

            {/* Plans */}
            {[
              { period: language === 'ru' ? '1 месяц' : '1 oy', price: '50 000', badge: null, color: '#3b82f6' },
              { period: language === 'ru' ? '3 месяца' : '3 oy', price: '140 000', badge: language === 'ru' ? '-7%' : '-7%', color: '#059669' },
              { period: language === 'ru' ? '6 месяцев' : '6 oy', price: '270 000', badge: language === 'ru' ? '-10%' : '-10%', color: '#7c3aed' },
              { period: language === 'ru' ? '12 месяцев' : '12 oy', price: '500 000', badge: language === 'ru' ? '-17% 🔥' : '-17% 🔥', color: '#dc2626' },
            ].map((plan, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: '14px', marginBottom: '10px',
                background: '#f8fafc', border: `1.5px solid ${plan.color}20`
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>{plan.period}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    {language === 'ru' ? 'за размещение расты' : 'rasta joylashuvi'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {plan.badge && (
                    <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: '8px', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 800 }}>
                      {plan.badge}
                    </span>
                  )}
                  <div style={{ fontWeight: 900, fontSize: '1rem', color: plan.color }}>{plan.price} UZS</div>
                </div>
              </div>
            ))}

            {/* What's included */}
            <div style={{ background: '#f0fdf4', borderRadius: '14px', padding: '16px', marginTop: '8px', marginBottom: '20px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#15803d', marginBottom: '10px' }}>
                ✅ {language === 'ru' ? 'Что входит в план:' : 'Plan ichida nima bor:'}
              </div>
              {[
                language === 'ru' ? '🏪 Размещение расты в каталоге' : '🏪 Katalogda rasta joylashuvi',
                language === 'ru' ? '📸 До 30 фото/видео товаров' : '📸 30 tagacha foto/video mahsulot',
                language === 'ru' ? '🛒 Приём заказов через Telegram' : '🛒 Telegram orqali buyurtma qabul qilish',
                language === 'ru' ? '📊 Статистика продаж в личном кабинете' : '📊 Shaxsiy kabinetda savdo statistikasi',
                language === 'ru' ? '📞 Приоритетная поддержка' : '📞 Ustuvor yordam',
              ].map((item, i) => (
                <div key={i} style={{ fontSize: '0.82rem', color: '#1e293b', marginBottom: '6px' }}>{item}</div>
              ))}
            </div>

            <button
              onClick={() => setShowSubModal(false)}
              style={{
                width: '100%', padding: '14px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff', border: 'none', borderRadius: '14px',
                fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer'
              }}
            >
              {language === 'ru' ? 'Понятно, спасибо!' : 'Tushunarli, rahmat!'}
            </button>
          </div>
        </div>
      )}

      {/* ─── COMMISSION MODAL ─── */}
      {showCommModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowCommModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#ffffff', borderRadius: '24px 24px 0 0', padding: '28px 20px 36px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Handle */}
            <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '4px', margin: '0 auto 20px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ fontSize: '2.4rem' }}>💰</div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>
                  {language === 'ru' ? 'Комиссия с продаж' : 'Savdo komissiyasi'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {language === 'ru' ? 'Как рассчитывается' : 'Qanday hisoblanadi'}
                </div>
              </div>
            </div>

            {/* Big rate */}
            <div style={{ textAlign: 'center', padding: '20px', background: '#fffbeb', borderRadius: '16px', marginBottom: '16px', border: '2px solid #fde68a' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#92400e', lineHeight: 1 }}>5%</div>
              <div style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 700, marginTop: '6px' }}>
                {language === 'ru' ? 'с каждого выполненного заказа' : 'har bir bajarilgan buyurtmadan'}
              </div>
            </div>

            {/* Examples */}
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e293b', marginBottom: '12px' }}>
              {language === 'ru' ? '📊 Примеры расчёта:' : '📊 Hisob-kitob misollari:'}
            </div>
            {[
              { order: '50 000', comm: '2 500' },
              { order: '100 000', comm: '5 000' },
              { order: '200 000', comm: '10 000' },
              { order: '500 000', comm: '25 000' },
            ].map((ex, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 14px', borderRadius: '12px', marginBottom: '8px',
                background: i % 2 === 0 ? '#f8fafc' : '#fffbeb'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  <span style={{ color: '#64748b' }}>{language === 'ru' ? 'Заказ:' : 'Buyurtma:'}</span>{' '}
                  <strong>{ex.order} UZS</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 800 }}>
                  {language === 'ru' ? 'Комиссия:' : 'Komissiya:'}{' '}{ex.comm} UZS
                </div>
              </div>
            ))}

            <div style={{ background: '#f0fdf4', borderRadius: '14px', padding: '14px', margin: '16px 0' }}>
              <div style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 700, marginBottom: '6px' }}>
                ℹ️ {language === 'ru' ? 'Важно знать:' : 'Muhim:'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#1e293b', lineHeight: 1.5 }}>
                {language === 'ru'
                  ? 'Комиссия снимается автоматически при выплате. Отменённые заказы не считаются. Расчёт ведётся автоматически.'
                  : 'Komissiya to\'lov paytida avtomatik olinadi. Bekor qilingan buyurtmalar hisoblanmaydi. Hisob-kitob avtomatik.'}
              </div>
            </div>

            <button
              onClick={() => setShowCommModal(false)}
              style={{
                width: '100%', padding: '14px', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff', border: 'none', borderRadius: '14px',
                fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer'
              }}
            >
              {language === 'ru' ? 'Понятно!' : 'Tushunarli!'}
            </button>
          </div>
        </div>
      )}


      {storeData && (
        <div>
          {/* Store Info Banner, Settings Button & Open/Close Switch */}
          <div 
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{getLocalized(storeData.store, 'name')}</h3>
                <button
                  onClick={() => setShowEditStoreModal(true)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#475569',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                  title={t('seller.edit_profile')}
                >
                  <Edit3 size={13} />
                  <span>{t('seller.edit_profile')}</span>
                </button>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                📍 {storeData.store.stall_number} | 👤 <strong>{storeData.store.owner_name}</strong> ({storeData.store.owner_phone})
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                onClick={() => setShowAddProductModal(true)}
                style={{
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <PlusCircle size={16} />
                <span>{t('seller.add_product')}</span>
              </button>

              <button 
                onClick={handleToggleStoreStatus}
                style={{
                  background: storeData.store.is_open ? '#10b981' : '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                {storeData.store.is_open ? t('seller.store_open') : t('seller.store_closed')}
              </button>
            </div>
          </div>

          {/* Products & Real-time Price Management */}
          <div className="section-header">
            <h3>{t('seller.my_products')} ({storeData.products.length})</h3>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{t('seller.price_hint')}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginBottom: '36px' }}>
            {storeData.products.map(product => {
              const currentEditPrice = editingPrices[product.id] ?? product.price;
              const hasChanged = currentEditPrice !== product.price;

              return (
                <div 
                  key={product.id}
                  style={{
                    background: '#ffffff',
                    border: `1.5px solid ${hasChanged ? '#f59e0b' : '#e2e8f0'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <img 
                      src={product.image_url} 
                      alt={getLocalized(product, 'name')}
                      style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{getLocalized(product, 'name')}</h4>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {t('seller.current_price')}: <strong style={{ color: '#064e3b' }}>{product.price.toLocaleString()} UZS</strong> / {formatUnit(product.unit, language)}
                      </div>
                    </div>
                  </div>

                  {/* Price input field & Quick Controls */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('seller.new_price')} / {formatUnit(product.unit, language)}:</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="number"
                        className="form-input"
                        value={currentEditPrice}
                        onChange={(e) => handlePriceChange(product.id, e.target.value)}
                        style={{ fontWeight: 800, color: '#064e3b', fontSize: '1.05rem' }}
                      />

                      <button 
                        className="add-cart-btn"
                        onClick={() => handleSavePrice(product.id)}
                        style={{
                          width: 'auto',
                          padding: '0 16px',
                          background: hasChanged ? '#f59e0b' : '#047857',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Save size={16} />
                        <span>{t('seller.save')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Stock Availability Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: product.is_available ? '#059669' : '#94a3b8' }}>
                      {product.is_available ? `✅ ${t('seller.status_in_stock')}` : `❌ ${t('seller.status_out_of_stock')}`}
                    </span>
                    <button 
                      onClick={() => handleToggleStock(product)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 700 }}
                    >
                      {product.is_available ? t('seller.mark_out_of_stock') : t('seller.mark_in_stock')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Incoming Orders Section */}
          <div className="section-header">
            <h3>{t('seller.incoming_orders')} ({incomingOrders.length})</h3>
          </div>

          {incomingOrders.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', color: '#64748b' }}>
              <Package size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
              <p>Hozircha yangi zakazlar yo'q. Mijozlar buyurtma berishi bilan bu yerda va Telegramda ko'rinadi!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {incomingOrders.map(order => (
                <div 
                  key={order.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>Zakaz #{order.order_number}</strong>
                    <span style={{ color: '#059669', fontWeight: 700 }}>{order.status}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '10px' }}>
                    👤 {order.customer_name} ({order.customer_phone}) | 📍 {order.delivery_district}, {order.delivery_address}
                  </div>
                  <div style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '10px' }}>
                    <strong>Sizning mahsulotlaringiz:</strong>
                    {order.items.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span>• {item.product_name} ({item.quantity} {item.unit})</span>
                        <span style={{ fontWeight: 700 }}>{item.total_price.toLocaleString()} UZS</span>
                      </div>
                    ))}
                  </div>

                  {/* 1-Tap Yandex Go Courier Action */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a 
                      href={`https://yandex.uz/maps/?rtext=41.3655,69.2885~${encodeURIComponent(order.delivery_district + ' ' + order.delivery_address)}&rtt=auto`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nav-btn"
                      style={{
                        background: '#fc3f1d',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.82rem',
                        padding: '6px 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none'
                      }}
                    >
                      🚕 Яндекс Доставка (Маршрут)
                    </a>

                    <a 
                      href={`tel:${order.customer_phone}`}
                      className="nav-btn"
                      style={{
                        background: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.82rem',
                        padding: '6px 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none'
                      }}
                    >
                      📞 Позвонить клиенту
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Store Profile Modal (Change Name, Phone, Stall, PIN) */}
      {showEditStoreModal && (
        <div className="modal-center-backdrop" onClick={() => setShowEditStoreModal(false)}>
          <div className="modal-center-card animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="#064e3b" />
                <h3>Do'kon / Sotuvchi ma'lumotlarini tahrirlash</h3>
              </div>
              <button className="close-btn" onClick={() => setShowEditStoreModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditStoreSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Sotuvchi ismi (Имя продавца) *</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="Masalan: Karen / Jasur"
                    value={editStoreForm.owner_name}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, owner_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Telefon raqam (Номер телефона) *</label>
                  <input 
                    type="tel" 
                    className="form-input"
                    placeholder="+998 90 987-65-43"
                    value={editStoreForm.owner_phone}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, owner_phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Do'kon / Rasta nomi (Название прилавка) *</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="Masalan: Karen Aka — Saralangan Go'sht"
                    value={editStoreForm.name_uz}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, name_uz: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Rasta & Joy (Место) *</label>
                    <input 
                      type="text" 
                      className="form-input"
                      placeholder="Rasta 14, Joy №2"
                      value={editStoreForm.stall_number}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, stall_number: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Yangi PIN-kod (необязательно)</label>
                    <input 
                      type="password"
                      maxLength="4" 
                      className="form-input"
                      placeholder="Masalan: 2222"
                      value={editStoreForm.pin}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, pin: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="submit" 
                  className="add-cart-btn"
                  disabled={editStoreLoading}
                  style={{ height: '46px' }}
                >
                  {editStoreLoading ? 'Saqlanmoqda...' : '💾 O\'zgarishlarni saqlash (Сохранить)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Product Modal with Direct Gallery Upload */}
      {showAddProductModal && (
        <div className="modal-center-backdrop" onClick={() => setShowAddProductModal(false)}>
          <div className="modal-center-card animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} color="#064e3b" />
                <h3>Yangi mahsulot qo'shish / Добавить товар</h3>
              </div>
              <button className="close-btn" onClick={() => setShowAddProductModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Mahsulot nomi (O'zbekcha / Русский) *</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="Masalan: Yosh Qo'y Go'shti / Молодая баранина"
                    value={productForm.name_uz}
                    onChange={(e) => setProductForm({ ...productForm, name_uz: e.target.value, name_ru: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Narxi (UZS) *</label>
                    <input 
                      type="number" 
                      className="form-input"
                      placeholder="105000"
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">O'lchov birligi *</label>
                    <select 
                      className="form-select"
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    >
                      <option value="kg">kg (Kilogramm)</option>
                      <option value="dona">dona (Штука)</option>
                      <option value="bog'lam">bog'lam (Связка / Пучок)</option>
                      <option value="litr">litr (Литр)</option>
                    </select>
                  </div>
                </div>

                {/* 1. PHOTO SELECTION: Gallery Upload or 1-Click Preset */}
                <div className="form-group">
                  <label className="form-label">📸 Mahsulot fotosi (Фото товара):</label>
                  
                  {/* Gallery / Camera Input */}
                  <label 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      border: '2px dashed #059669',
                      borderRadius: '10px',
                      background: '#ecfdf5',
                      color: '#064e3b',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      marginBottom: '10px'
                    }}
                  >
                    <Camera size={20} />
                    <span>{imageUploading ? 'Rasm yuklanmoqda...' : '📁 Galereyadan rasm tanlash / Снять на камеру'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>

                  {/* Photo Preview & 1-Click Presets */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <img 
                      src={productForm.image_url} 
                      alt="Tanlangan rasm"
                      style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', border: '2px solid #059669' }}
                    />
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Yoki tayyor shablonni tanlang:
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {PHOTO_PRESETS.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setProductForm({ ...productForm, image_url: preset.image, video_url: preset.video })}
                        style={{
                          border: productForm.image_url === preset.image ? '2px solid #059669' : '1px solid #e2e8f0',
                          background: productForm.image_url === preset.image ? '#ecfdf5' : '#ffffff',
                          padding: '6px',
                          borderRadius: '8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. VIDEO REEL SELECTION: Gallery Upload */}
                <div className="form-group">
                  <label className="form-label">🎥 Video Reel (Видео товара):</label>
                  
                  <label 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px',
                      border: '1.5px dashed #3b82f6',
                      borderRadius: '10px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Video size={18} />
                    <span>{videoUploading ? 'Video yuklanmoqda...' : '📁 Galereyadan video tanlash (MP4)'}</span>
                    <input 
                      type="file" 
                      accept="video/*" 
                      onChange={handleVideoFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="submit" 
                  className="add-cart-btn"
                  disabled={addProductLoading || imageUploading || videoUploading}
                  style={{ height: '46px' }}
                >
                  {addProductLoading ? 'Qo\'shilmoqda...' : '✅ Mahsulotni saqlash va chiqarish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register New Store Modal */}
      {showRegModal && (
        <div className="modal-center-backdrop" onClick={() => setShowRegModal(false)}>
          <div className="modal-center-card animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={20} color="#064e3b" />
                <h3>Yangi do'kon / прилавок qo'shish</h3>
              </div>
              <button className="close-btn" onClick={() => setShowRegModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterStoreSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Do'kon / Rasta nomi (O'zbekcha / Русский) *</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="Masalan: Jasur — Qashqadaryo Tandir Go'shti"
                    value={regForm.name_uz}
                    onChange={(e) => setRegForm({ ...regForm, name_uz: e.target.value, name_ru: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Rasta & Joy raqami *</label>
                    <input 
                      type="text" 
                      className="form-input"
                      placeholder="Rasta 12, Joy №5"
                      value={regForm.stall_number}
                      onChange={(e) => setRegForm({ ...regForm, stall_number: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Kategoriya *</label>
                    <select 
                      className="form-select"
                      value={regForm.category_slug}
                      onChange={(e) => setRegForm({ ...regForm, category_slug: e.target.value })}
                    >
                      <option value="meat">🥩 Go'sht & Qazi</option>
                      <option value="vegetables">🍅 Sabzavotlar</option>
                      <option value="fruits">🍇 Mevalar</option>
                      <option value="bakery">🥖 Non & Somsa</option>
                      <option value="dry_fruits">🥜 Quruq mevalar</option>
                      <option value="dairy">🧀 Sut & Qaymoq</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Sotuvchi ismi *</label>
                    <input 
                      type="text" 
                      className="form-input"
                      placeholder="Masalan: Jasur"
                      value={regForm.owner_name}
                      onChange={(e) => setRegForm({ ...regForm, owner_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">PIN-kod (4 raqam) *</label>
                    <input 
                      type="password" 
                      maxLength="4"
                      className="form-input"
                      placeholder="1234"
                      value={regForm.pin}
                      onChange={(e) => setRegForm({ ...regForm, pin: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Telefon raqam *</label>
                  <input 
                    type="tel" 
                    className="form-input"
                    placeholder="+998 90 123-45-67"
                    value={regForm.owner_phone}
                    onChange={(e) => setRegForm({ ...regForm, owner_phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="submit" 
                  className="add-cart-btn"
                  disabled={regLoading}
                  style={{ height: '46px' }}
                >
                  {regLoading ? 'Qo\'shilmoqda...' : '✅ Do\'konni ro\'yxatdan o\'tkazish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
