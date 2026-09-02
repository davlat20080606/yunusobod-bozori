import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { 
  CheckCircle2, 
  Clock, 
  Truck, 
  ShoppingBag, 
  MapPin, 
  Check, 
  ArrowLeft, 
  Copy, 
  Phone, 
  User, 
  Store,
  HelpCircle,
  Search
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

const STATUS_STEPS = [
  { id: 'pending', titleKey: 'tracker.status_pending', icon: Clock, descUz: 'Buyurtma tizimga qabul qilindi', descRu: 'Заказ принят и обрабатывается', descEn: 'Order placed and waiting for bazaar vendor' },
  { id: 'accepted', titleKey: 'tracker.status_accepted', icon: Store, descUz: 'Sotuvchi mahsulotni tasdiqladi', descRu: 'Продавец подтвердил наличие товаров', descEn: 'Vendor accepted and confirmed products' },
  { id: 'picking', titleKey: 'tracker.status_picking', icon: ShoppingBag, descUz: 'Rastada saralanib qadoqlanmoqda', descRu: 'Сборщик отбирает самые свежие продукты', descEn: 'Collector is picking freshest goods at stall' },
  { id: 'on_the_way', titleKey: 'tracker.status_on_the_way', icon: Truck, descUz: 'Kuryer manzilga yo\'l oldi (45 min)', descRu: 'Курьер везет заказ к вашей двери', descEn: 'Courier is delivering to your address' },
  { id: 'delivered', titleKey: 'tracker.status_delivered', icon: CheckCircle2, descUz: 'Buyurtma muvaffaqiyatli topshirildi', descRu: 'Заказ успешно доставлен покупателю', descEn: 'Order delivered successfully' },
];

export default function OrderTracker({ initialOrderNumber, onBackToMarket, onOrderNotFound }) {
  const { t, language } = useLanguage();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchNum, setSearchNum] = useState(initialOrderNumber || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let numToSearch = initialOrderNumber;
    if (!numToSearch) {
      try {
        numToSearch = localStorage.getItem('yunusobod_last_order') || '';
      } catch {}
    }

    if (numToSearch) {
      setSearchNum(numToSearch);
      fetchOrder(numToSearch);
    } else {
      setLoading(false);
    }
  }, [initialOrderNumber]);

  const fetchOrder = async (orderNum) => {
    setLoading(true);
    try {
      const data = await api.getOrder(orderNum);
      setOrder(data);
    } catch (e) {
      console.error(e);
      setOrder(null);
      if (onOrderNotFound) onOrderNotFound();
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchNum.trim()) {
      triggerHaptic('light');
      fetchOrder(searchNum.trim());
    }
  };

  const handleCopyOrderNumber = () => {
    if (!order) return;
    triggerHaptic('light');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(order.order_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const idx = STATUS_STEPS.findIndex(s => s.id === order.status);
    return idx >= 0 ? idx : 0;
  };

  const currentStep = getCurrentStepIndex();

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px 12px 100px', fontFamily: 'inherit' }}>
      
      {/* 1. Header Bar with Back Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        gap: '10px'
      }}>
        <button 
          type="button" 
          onClick={onBackToMarket}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
            padding: '8px 14px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <ArrowLeft size={16} color="#059669" />
          <span>{t('tracker.back_to_market')}</span>
        </button>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#ecfdf5',
          color: '#065f46',
          padding: '6px 12px',
          borderRadius: '999px',
          fontSize: '0.78rem',
          fontWeight: 700,
          border: '1px solid #a7f3d0'
        }}>
          <Truck size={14} color="#059669" />
          <span>{language === 'ru' ? 'Экспресс-доставка' : (language === 'en' ? 'Express Delivery' : 'Tezkor yetkazish')}</span>
        </div>
      </div>

      {/* 2. Order Search Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '14px',
        border: '1px solid #e2e8f0',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px 10px 36px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none',
                color: '#0f172a'
              }}
              placeholder={t('tracker.search_placeholder')}
              value={searchNum}
              onChange={(e) => setSearchNum(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            style={{
              background: 'linear-gradient(135deg, #059669, #10b981)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '0 16px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {t('tracker.search_btn')}
          </button>
        </form>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
          {language === 'ru' ? 'Загрузка данных заказа...' : (language === 'en' ? 'Loading order status...' : 'Buyurtma ma\'lumotlari yuklanmoqda...')}
        </div>
      )}

      {/* Not Found */}
      {!loading && !order && (
        <div style={{
          textAlign: 'center',
          padding: '36px 20px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📦</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
            {t('tracker.not_found_title')}
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '20px', lineHeight: 1.4 }}>
            {t('tracker.not_found_desc')}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={onBackToMarket}
              style={{
                background: 'linear-gradient(135deg, #059669, #10b981)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 20px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {t('tracker.back_to_market')}
            </button>

            <button 
              type="button" 
              onClick={() => {
                try {
                  localStorage.removeItem('yunusobod_last_order');
                } catch {}
                setSearchNum('');
                setOrder(null);
                if (onBackToMarket) onBackToMarket();
              }}
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '12px 18px',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {language === 'ru' ? 'Сбросить номер' : 'Tozalash'}
            </button>
          </div>
        </div>
      )}

      {/* Order Details Found */}
      {!loading && order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* A. Hero Order Card (Emerald Gradient) */}
          <div style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)',
            borderRadius: '20px',
            padding: '20px',
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(5,150,105,0.25)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Top Row: Order Number & Copy Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              gap: '10px'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#a7f3d0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('tracker.order_number_label')}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px', color: '#ffffff' }}>
                  #{order.order_number}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyOrderNumber}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'OK' : (language === 'ru' ? 'Копировать' : (language === 'en' ? 'Copy' : 'Nusxa'))}</span>
              </button>
            </div>

            {/* Middle Row: Total Payment Banner */}
            <div style={{
              background: 'rgba(0,0,0,0.28)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(251,191,36,0.6)',
              borderRadius: '14px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px'
            }}>
              <span style={{ fontSize: '0.82rem', color: '#fef08a', fontWeight: 700 }}>
                💰 {t('tracker.total_payment')}
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fde047' }}>
                {order.total_amount?.toLocaleString()} UZS
              </span>
            </div>

            {/* Customer Details Pill Grid */}
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '14px',
              padding: '12px 14px',
              fontSize: '0.78rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={14} color="#a7f3d0" />
                <span style={{ fontWeight: 700 }}>{order.customer_name}</span>
                <span style={{ color: '#a7f3d0' }}>({order.customer_phone})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={14} color="#a7f3d0" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{order.delivery_district ? `${order.delivery_district}, ` : ''}{order.delivery_address}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} color="#a7f3d0" />
                <span>⚡️ {order.delivery_time_slot || 'Express (45-60 min)'}</span>
              </div>
            </div>
          </div>

          {/* B. Visual Timeline Stepper Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '20px 16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📍</span>
              <span>{t('tracker.title')}</span>
            </h3>

            {/* Stepper Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
              {STATUS_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isPassed = idx <= currentStep;
                const isCurrent = idx === currentStep;
                const isLast = idx === STATUS_STEPS.length - 1;

                const stepDesc = language === 'ru' ? step.descRu : (language === 'en' ? step.descEn : step.descUz);

                return (
                  <div key={step.id} style={{ display: 'flex', gap: '14px', position: 'relative', paddingBottom: isLast ? '0' : '22px' }}>
                    
                    {/* Connecting Vertical Line */}
                    {!isLast && (
                      <div style={{
                        position: 'absolute',
                        left: '17px',
                        top: '34px',
                        bottom: '0',
                        width: '2px',
                        background: isPassed && idx < currentStep ? '#10b981' : '#e2e8f0',
                        zIndex: 1
                      }} />
                    )}

                    {/* Step Icon Circle */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: isCurrent 
                        ? 'linear-gradient(135deg, #059669, #10b981)' 
                        : isPassed 
                        ? '#047857' 
                        : '#f1f5f9',
                      color: isPassed ? '#ffffff' : '#94a3b8',
                      border: isCurrent ? '3px solid #a7f3d0' : isPassed ? '2px solid #059669' : '2px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      zIndex: 2,
                      boxShadow: isCurrent ? '0 0 14px rgba(16,185,129,0.5)' : 'none'
                    }}>
                      <Icon size={17} />
                    </div>

                    {/* Step Text Details */}
                    <div style={{ flex: 1, paddingTop: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.88rem',
                          fontWeight: isCurrent ? 800 : (isPassed ? 700 : 600),
                          color: isCurrent ? '#065f46' : (isPassed ? '#0f172a' : '#94a3b8')
                        }}>
                          {t(step.titleKey)}
                        </span>

                        {isCurrent && (
                          <span style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            border: '1px solid #86efac'
                          }}>
                            ● {language === 'ru' ? 'В процессе' : (language === 'en' ? 'Active' : 'Jarayonda')}
                          </span>
                        )}
                      </div>

                      <p style={{
                        margin: '3px 0 0',
                        fontSize: '0.75rem',
                        color: isCurrent ? '#059669' : '#64748b',
                        lineHeight: 1.3
                      }}>
                        {stepDesc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* C. Items Breakdown List */}
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '20px 16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>🛍️ {t('tracker.items_list')}</span>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
                {order.items?.length || 0} {language === 'ru' ? 'поз.' : 'xil'}
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {order.items?.map((item, idx) => (
                <div 
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#dcfce7',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800
                    }}>
                      ✓
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                        {item.product_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        {item.quantity} {item.unit} × {item.price?.toLocaleString()} UZS
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#065f46' }}>
                    {item.total_price?.toLocaleString()} UZS
                  </div>
                </div>
              ))}
            </div>

            {/* Delivery fee info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px dashed #cbd5e1',
              fontSize: '0.8rem',
              color: '#64748b'
            }}>
              <span>⚡️ {language === 'ru' ? 'Доставка по Ташкенту' : (language === 'en' ? 'Delivery fee' : 'Yetkazib berish')}:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>15 000 UZS</span>
            </div>

            {/* Grand Total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '8px',
              padding: '10px 12px',
              background: '#ecfdf5',
              borderRadius: '10px',
              fontSize: '0.92rem',
              fontWeight: 800,
              color: '#065f46'
            }}>
              <span>{t('cart.grand_total')}:</span>
              <span style={{ fontSize: '1.05rem', color: '#047857' }}>
                {order.total_amount?.toLocaleString()} UZS
              </span>
            </div>
          </div>

          {/* D. Back to Market Main CTA */}
          <button 
            type="button" 
            onClick={onBackToMarket}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🛒 {language === 'ru' ? 'Вернуться к покупкам на базаре' : (language === 'en' ? 'Back to Bazaar Market' : 'Bozorga qaytish')}</span>
          </button>

        </div>
      )}

    </div>
  );
}
