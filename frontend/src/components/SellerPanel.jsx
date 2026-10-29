import React, { useState, useEffect } from 'react';
import SellerPromos from './SellerPromos';
import SellerOrderBody from './SellerOrderBody';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { api, getSellerSession, setSellerSession } from '../services/api';
import { Store, DollarSign, CheckCircle2, ToggleLeft, ToggleRight, RefreshCw, Package, Check, Save, PlusCircle, X, Image, Video, Sparkles, Upload, Lock, ShieldCheck, Camera, LogOut, Settings, Edit3 } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { formatUnit } from './ProductCard';
import { ClickLogo, PaymeLogo } from './PaymentLogos';

const PHOTO_PRESETS = [
  { name: '🥩 Go\'sht / Мясо', image: '/img/p/ef38b94878f0.jpg', video: '' },
  { name: '🍅 Pomidor / Овощи', image: '/img/p/66ff63f3f334.jpg', video: '' },
  { name: '🍈 Qovun / Фрукты', image: '/img/p/d2ef82ecd095.jpg', video: '' },
  { name: '🥖 Non / Выпечка', image: '/img/p/f3cdfa490b92.jpg', video: '' },
  { name: '🥜 Quruq meva / Орехи', image: '/img/p/4474d3c91c5b.jpg', video: '' },
  { name: '🧀 Qaymoq / Молочка', image: '/img/p/1b2087837e43.jpg', video: '' },
];

export default function SellerPanel({ onProductPriceUpdated, onBackToMarket, onSignOut }) {
  const { getLocalized, t, language } = useLanguage();
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [incomingOrders, setIncomingOrders] = useState([]);

  // Monetization Modals

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

  // The signed-in seller only ever sees their own stall
  useEffect(() => {
    const session = getSellerSession();
    if (session?.store?.id) selectStore(session.store.id);
  }, []);

  const selectStore = async (storeId) => {
    setSelectedStoreId(storeId);
    setLoading(true);
    try {
      const data = await api.getMyStoreDashboard();
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

      const orders = await api.getStoreOrders();
      setIncomingOrders(orders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const reloadOrders = () => api.getStoreOrders().then(setIncomingOrders).catch(() => {});

  // New orders and other stalls' progress arrive while the cabinet is open
  useEffect(() => {
    if (!selectedStoreId) return undefined;
    const timer = setInterval(reloadOrders, 20000);
    return () => clearInterval(timer);
  }, [selectedStoreId]);

  const handleLogout = () => {
    setSellerSession(null);
    if (onSignOut) onSignOut();
    else if (onBackToMarket) onBackToMarket();
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
      const res = await api.toggleStoreStatus();
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

      const res = await api.updateStoreProfile(payload);
      triggerHaptic('success');
      setShowEditStoreModal(false);
      setStoreData(prev => ({ ...prev, store: res.store }));
      // A new PIN comes with a new session token
      const session = getSellerSession();
      setSellerSession({ ...session, store: res.store, token: res.token || session?.token });
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
      const res = await api.createProduct({
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

  // SELLER DASHBOARD (shown after SellerLogin)

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
            {storeData?.store && (
              <span style={{ background: '#334155', color: '#ffffff', padding: '8px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}>
                {storeData.store.stall_number} — {getLocalized(storeData.store, 'name')}
              </span>
            )}

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

          <SellerPromos language={language} products={storeData?.products || []} />

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
                  <SellerOrderBody order={order} language={language} onChanged={reloadOrders} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Store Profile Modal (Change Name, Phone, Stall, PIN) */}
      {/* Edit Store Profile Modal (Change Name, Phone, Stall, PIN) */}
      {showEditStoreModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: '#ffffff', zIndex: 99999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }} onClick={() => setShowEditStoreModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', width: '100%', maxWidth: '480px', paddingTop: '10px' }}>
            <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '4px', margin: '0 auto 20px' }} />
            <div className="modal-header" style={{ padding: '0 0 16px 0', background: 'transparent', borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="#064e3b" />
                <h3>{language === 'ru' ? 'Редактировать магазин / продавца' : (language === 'en' ? 'Edit Store / Seller' : 'Do\'kon / Sotuvchi ma\'lumotlarini tahrirlash')}</h3>
              </div>
              <button className="close-btn" onClick={() => setShowEditStoreModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditStoreSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{language === 'ru' ? 'Имя продавца *' : (language === 'en' ? 'Seller Name *' : 'Sotuvchi ismi *')}</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder={language === 'ru' ? 'Например: Карен / Жасур' : (language === 'en' ? 'E.g. Karen / Jasur' : 'Masalan: Karen / Jasur')}
                    value={editStoreForm.owner_name}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, owner_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{language === 'ru' ? 'Номер телефона *' : (language === 'en' ? 'Phone Number *' : 'Telefon raqam *')}</label>
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
                  <label className="form-label">{language === 'ru' ? 'Название прилавка *' : (language === 'en' ? 'Stall Name *' : 'Do\'kon / Rasta nomi *')}</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder={language === 'ru' ? 'Например: Карен Ака — Отборное мясо' : (language === 'en' ? 'E.g. Karen Aka — Premium Meat' : 'Masalan: Karen Aka — Saralangan Go\'sht')}
                    value={editStoreForm.name_uz}
                    onChange={(e) => setEditStoreForm({ ...editStoreForm, name_uz: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">{language === 'ru' ? 'Ряд & Место *' : (language === 'en' ? 'Stall & Place *' : 'Rasta & Joy *')}</label>
                    <input 
                      type="text" 
                      className="form-input"
                      placeholder={language === 'ru' ? 'Ряд 14, Место №2' : (language === 'en' ? 'Stall 14, Place №2' : 'Rasta 14, Joy №2')}
                      value={editStoreForm.stall_number}
                      onChange={(e) => setEditStoreForm({ ...editStoreForm, stall_number: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{language === 'ru' ? 'Новый PIN-код (необязательно)' : (language === 'en' ? 'New PIN-code (optional)' : 'Yangi PIN-kod (ixtiyoriy)')}</label>
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
                  {editStoreLoading ? (language === 'ru' ? 'Сохранение...' : (language === 'en' ? 'Saving...' : 'Saqlanmoqda...')) : (language === 'ru' ? '💾 Сохранить изменения' : (language === 'en' ? '💾 Save changes' : '💾 O\'zgarishlarni saqlash'))}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add New Product Modal with Direct Gallery Upload */}
      {/* Add New Product Modal with Direct Gallery Upload */}
      {showAddProductModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: '#ffffff', zIndex: 99999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }} onClick={() => setShowAddProductModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', width: '100%', maxWidth: '480px', paddingTop: '10px' }}>
            <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '4px', margin: '0 auto 20px' }} />
            <div className="modal-header" style={{ padding: '0 0 16px 0', background: 'transparent', borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} color="#064e3b" />
                <h3>{language === 'ru' ? 'Добавить товар' : (language === 'en' ? 'Add product' : 'Yangi mahsulot qo\'shish')}</h3>
              </div>
              <button className="close-btn" onClick={() => setShowAddProductModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{language === 'ru' ? 'Название товара *' : (language === 'en' ? 'Product Name *' : 'Mahsulot nomi *')}</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder={language === 'ru' ? 'Например: Молодая баранина' : (language === 'en' ? 'E.g. Young Mutton' : 'Masalan: Yosh Qo\'y Go\'shti')}
                    value={productForm.name_uz}
                    onChange={(e) => setProductForm({ ...productForm, name_uz: e.target.value, name_ru: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">{language === 'ru' ? 'Цена (UZS) *' : (language === 'en' ? 'Price (UZS) *' : 'Narxi (UZS) *')}</label>
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
                    <label className="form-label">{language === 'ru' ? 'Ед. измерения *' : (language === 'en' ? 'Unit *' : 'O\'lchov birligi *')}</label>
                    <select 
                      className="form-select"
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    >
                      <option value="kg">{language === 'ru' ? 'кг' : (language === 'en' ? 'kg' : 'kg')}</option>
                      <option value="dona">{language === 'ru' ? 'шт.' : (language === 'en' ? 'pcs' : 'dona')}</option>
                      <option value="bog'lam">{language === 'ru' ? 'пучок' : (language === 'en' ? 'bunch' : 'bog\'lam')}</option>
                      <option value="litr">{language === 'ru' ? 'литр' : (language === 'en' ? 'liter' : 'litr')}</option>
                    </select>
                  </div>
                </div>

                {/* 1. PHOTO SELECTION: Gallery Upload or 1-Click Preset */}
                <div className="form-group">
                  <label className="form-label">{language === 'ru' ? '📸 Фото товара:' : (language === 'en' ? '📸 Product Photo:' : '📸 Mahsulot fotosi:')}</label>
                  
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
                    <span>{imageUploading ? (language === 'ru' ? 'Загрузка...' : (language === 'en' ? 'Uploading...' : 'Rasm yuklanmoqda...')) : (language === 'ru' ? '📁 Выбрать из галереи / Снять' : (language === 'en' ? '📁 Choose from gallery / Capture' : '📁 Galereyadan rasm tanlash'))}</span>
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
                      {language === 'ru' ? 'Или выберите готовый шаблон:' : (language === 'en' ? 'Or choose a ready template:' : 'Yoki tayyor shablonni tanlang:')}
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
                  <label className="form-label">{language === 'ru' ? '🎥 Видео товара (Reel):' : (language === 'en' ? '🎥 Video Reel:' : '🎥 Video Reel:')}</label>
                  
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
                    <span>{videoUploading ? (language === 'ru' ? 'Загрузка...' : (language === 'en' ? 'Uploading...' : 'Video yuklanmoqda...')) : (language === 'ru' ? '📁 Выбрать видео (MP4)' : (language === 'en' ? '📁 Choose video (MP4)' : '📁 Galereyadan video tanlash (MP4)'))}</span>
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
                  {addProductLoading ? (language === 'ru' ? 'Добавление...' : (language === 'en' ? 'Adding...' : 'Qo\'shilmoqda...')) : (language === 'ru' ? '✅ Сохранить и опубликовать' : (language === 'en' ? '✅ Save and publish' : '✅ Mahsulotni saqlash va chiqarish'))}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Register New Store Modal */}
      {/* Register New Store Modal */}
    </div>
  );
}
