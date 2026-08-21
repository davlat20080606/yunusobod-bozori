import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { CheckCircle2, Clock, Truck, ShoppingBag, MapPin, Check, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

const STATUS_STEPS = [
  { id: 'pending', title: 'tracker.status_pending', icon: Clock },
  { id: 'accepted', title: 'tracker.status_accepted', icon: CheckCircle2 },
  { id: 'picking', title: 'tracker.status_picking', icon: ShoppingBag },
  { id: 'on_the_way', title: 'tracker.status_on_the_way', icon: Truck },
  { id: 'delivered', title: 'tracker.status_delivered', icon: CheckCircle2 },
];

export default function OrderTracker({ activeOrderNumber, onBackToShopping }) {
  const { t } = useLanguage();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchNum, setSearchNum] = useState(activeOrderNumber || '');

  useEffect(() => {
    if (activeOrderNumber) {
      fetchOrder(activeOrderNumber);
    } else {
      setLoading(false);
    }
  }, [activeOrderNumber]);

  const fetchOrder = async (orderNum) => {
    setLoading(true);
    try {
      const data = await api.getOrder(orderNum);
      setOrder(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateStatus = async (newStatus) => {
    if (!order) return;
    triggerHaptic('medium');
    try {
      await api.updateOrderStatus(order.id, newStatus);
      setOrder(prev => ({ ...prev, status: newStatus }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchNum.trim()) {
      fetchOrder(searchNum.trim());
    }
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const idx = STATUS_STEPS.findIndex(s => s.id === order.status);
    return idx >= 0 ? idx : 0;
  };

  const currentStep = getCurrentStepIndex();

  return (
    <div className="bozor-container animate-fade" style={{ paddingTop: '20px' }}>
      {/* Search Order Number */}
      <div 
        style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          border: '1px solid var(--border-color)',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="text" 
            className="form-input"
            placeholder="Buyurtma raqami (masalan: YB-2108-1234)..."
            value={searchNum}
            onChange={(e) => setSearchNum(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="add-cart-btn" style={{ width: 'auto', padding: '0 20px' }}>
            Qidirish
          </button>
        </form>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          Yuklanmoqda...
        </div>
      )}

      {!loading && !order && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', color: '#64748b' }}>
          <ShoppingBag size={48} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
          <h3 style={{ color: '#0f172a', marginBottom: '8px' }}>Buyurtma topilmadi</h3>
          <p style={{ fontSize: '0.88rem', marginBottom: '20px' }}>Yuqoridagi maydonga buyurtma raqamingizni kiriting yoki bozorga qayting.</p>
          <button className="add-cart-btn" onClick={onBackToShopping} style={{ width: 'auto', margin: '0 auto' }}>
            Bozorga qaytish
          </button>
        </div>
      )}

      {!loading && order && (
        <div>
          {/* Order Header Card */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #064e3b, #065f46)',
              color: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#a7f3d0' }}>Buyurtma raqami:</span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>#{order.order_number}</h2>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: '#a7f3d0' }}>Jami to'lov:</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fef08a' }}>
                  {order.total_amount?.toLocaleString()} UZS
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', gap: '20px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <span>👤 {order.customer_name} ({order.customer_phone})</span>
              <span>📍 {order.delivery_district}, {order.delivery_address}</span>
              <span>⚡️ {order.delivery_time_slot}</span>
            </div>
          </div>

          {/* Live Interactive Status Stepper */}
          <div 
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              border: '1px solid var(--border-color)',
              marginBottom: '24px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h3 style={{ fontSize: '1.15rem', marginBottom: '20px' }}>{t('tracker.title')}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {STATUS_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isPassed = idx <= currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div 
                    key={step.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '10px',
                      background: isCurrent ? '#ecfdf5' : isPassed ? '#f8fafc' : '#ffffff',
                      border: `1.5px solid ${isCurrent ? '#10b981' : isPassed ? '#cbd5e1' : '#e2e8f0'}`
                    }}
                  >
                    <div 
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: isPassed ? '#047857' : '#cbd5e1',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Qadam {idx + 1}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isPassed ? '#0f172a' : '#94a3b8' }}>
                        {t(step.title)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status simulation controls */}
            <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>🎮 Holatni o'zgartirish (Test / Demo):</span>
              {STATUS_STEPS.map((step) => (
                <button
                  key={step.id}
                  onClick={() => handleSimulateStatus(step.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: order.status === step.id ? '#047857' : '#ffffff',
                    color: order.status === step.id ? '#ffffff' : '#0f172a',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {t(step.title)}
                </button>
              ))}
            </div>
          </div>

          {/* Items Breakdown & Bazaar Picker Checklist */}
          <div 
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>{t('tracker.items_list')} ({order.items?.length || 0})</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {order.items?.map((item) => (
                <div 
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#d1fae5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                      ✓
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{item.product_name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {item.quantity} {item.unit} x {item.price.toLocaleString()} UZS
                      </div>
                    </div>
                  </div>

                  <div style={{ fontWeight: 800, color: '#064e3b' }}>
                    {item.total_price.toLocaleString()} UZS
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
