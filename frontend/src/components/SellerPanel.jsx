import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { Store, DollarSign, CheckCircle2, ToggleLeft, ToggleRight, RefreshCw, Package, Check, Save, PlusCircle, X, ShieldCheck } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function SellerPanel({ onProductPriceUpdated }) {
  const { getLocalized, t } = useLanguage();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [incomingOrders, setIncomingOrders] = useState([]);

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
      // Auto select Karen Aka or first store
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
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>Sotuvchi Boshqaruv Paneli</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t('seller.desc')}</p>
          </div>

          {/* Quick Actions */}
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
              <span>+ Yangi do'kon qo'shish</span>
            </button>

            <select 
              className="form-select"
              value={selectedStoreId || ''}
              onChange={(e) => selectStore(Number(e.target.value))}
              style={{ background: '#334155', color: '#ffffff', borderColor: '#475569', minWidth: '220px' }}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  {s.stall_number} — {s.name_uz}
                </option>
              ))}
            </select>
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
          {/* Store Info Banner & Open/Close Switch */}
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{getLocalized(storeData.store, 'name')}</h3>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                📍 {storeData.store.stall_number} | 👤 {storeData.store.owner_name} ({storeData.store.owner_phone})
              </div>
            </div>

            <button 
              className={`nav-btn ${storeData.store.is_open ? 'nav-btn-primary' : ''}`}
              onClick={handleToggleStoreStatus}
              style={{
                background: storeData.store.is_open ? '#10b981' : '#ef4444',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                fontWeight: 700
              }}
            >
              {storeData.store.is_open ? '🟢 Do\'kon OCHIQ' : '🔴 Do\'kon YOPIQ'}
            </button>
          </div>

          {/* Products & Real-time Price Management */}
          <div className="section-header">
            <h3>{t('seller.my_products')} ({storeData.products.length})</h3>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Narxni yozing va "Saqlash" tugmasini bosing</span>
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
                        {t('seller.current_price')}: <strong style={{ color: '#064e3b' }}>{product.price.toLocaleString()} UZS</strong> / {product.unit}
                      </div>
                    </div>
                  </div>

                  {/* Price input field & Quick Controls */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('seller.new_price')} / {product.unit}:</label>
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
                        <span>Saqlash</span>
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
                      {product.is_available ? 'Tugatish' : 'Mavjud qilish'}
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
