import React, { useState, useEffect, useRef } from 'react';
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
  Search,
  Navigation,
  SlidersHorizontal,
  Sparkles,
  PhoneCall,
  ExternalLink
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

// Realistic Street Coordinates in Yunusobod, Tashkent
const BAZAAR_COORDS = [41.3653, 69.2885];        // Yunusobod Dehqon Bozori
const BAZAAR_GATE = [41.3668, 69.2895];          // Bazaar Gate 4 (Ahmad Donish roadside)
const ROUTE_TURN_1 = [41.3705, 69.2915];         // Ahmad Donish Avenue
const ROUTE_TURN_2 = [41.3742, 69.2942];         // Turn towards 19-mavze
const CUSTOMER_COORDS = [41.3778, 69.2978];      // Customer destination (Yunusobod 19-mavze)

const STREET_ROUTE = [
  BAZAAR_COORDS,
  BAZAAR_GATE,
  ROUTE_TURN_1,
  ROUTE_TURN_2,
  CUSTOMER_COORDS
];

// Helper to get courier position & styling based on status
function getCourierDetails(status, language) {
  if (status === 'handed_over') {
    return {
      coords: BAZAAR_GATE,
      label: language === 'ru' ? '🤝 У ворот базара' : '🤝 Darvoza oldida',
      emoji: '🤝',
      color: '#d97706'
    };
  }
  if (status === 'on_the_way') {
    return {
      coords: ROUTE_TURN_2,
      label: language === 'ru' ? '🚗 Такси Cobalt (~10 мин)' : '🚗 Cobalt yo\'lda (~10 min)',
      emoji: '🚗',
      color: '#0284c7'
    };
  }
  if (status === 'delivered') {
    return {
      coords: CUSTOMER_COORDS,
      label: language === 'ru' ? '✅ Доставлено к двери' : '✅ Yetkazildi',
      emoji: '✅',
      color: '#16a34a'
    };
  }
  // Default: picking at bazaar
  return {
    coords: BAZAAR_COORDS,
    label: language === 'ru' ? '🛒 Аравачи на рядах' : '🛒 Aravachi rastada',
    emoji: '🛒',
    color: '#059669'
  };
}

// Ultra-stable Leaflet Map Component (Initialized ONCE, updates smoothly without reload crashes)
function YandexGoMap({ status, deliveryAddress, language }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const courierMarkerRef = useRef(null);
  const leafletLibRef = useRef(null);

  // 1. Initialize Map ONCE on mount
  useEffect(() => {
    let isMounted = true;

    const setupMap = async () => {
      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        if (!isMounted || !mapContainerRef.current) return;
        if (mapInstanceRef.current) return; // Prevent double initialization

        leafletLibRef.current = L;

        // Clean container just in case
        mapContainerRef.current.innerHTML = '';

        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          touchZoom: true,
          scrollWheelZoom: false
        }).setView(BAZAAR_COORDS, 14);

        mapInstanceRef.current = map;

        // OpenStreetMap Crisp Tiles (100% free, real street names, zero watermarks)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c']
        }).addTo(map);

        // 1. Street Route Polyline (Double layer for glowing road effect)
        L.polyline(STREET_ROUTE, {
          color: '#10b981',
          weight: 7,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        L.polyline(STREET_ROUTE, {
          color: '#059669',
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // 2. Bazaar Marker
        const bazaarIcon = L.divIcon({
          className: 'bazaar-map-marker',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%);">
              <div style="background:#064e3b; color:#ffffff; padding:4px 9px; border-radius:999px; font-size:11px; font-weight:800; display:flex; align-items:center; gap:5px; box-shadow:0 4px 14px rgba(0,0,0,0.28); border:2px solid #ffffff; white-space:nowrap;">
                <span style="font-size:13px;">🏛️</span>
                <span>${language === 'ru' ? 'Юнусабад Базар' : 'Yunusobod Bozori'}</span>
              </div>
              <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:7px solid #064e3b; margin-top:-1px;"></div>
            </div>
          `,
          iconSize: [0, 0]
        });
        L.marker(BAZAAR_COORDS, { icon: bazaarIcon }).addTo(map);

        // 3. Customer House Marker
        const customerIcon = L.divIcon({
          className: 'customer-map-marker',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%);">
              <div style="background:#dc2626; color:#ffffff; padding:4px 9px; border-radius:999px; font-size:11px; font-weight:800; display:flex; align-items:center; gap:5px; box-shadow:0 4px 14px rgba(0,0,0,0.28); border:2px solid #ffffff; white-space:nowrap;">
                <span style="font-size:13px;">🏠</span>
                <span>${deliveryAddress ? deliveryAddress.slice(0, 14) : '19-mavze'}</span>
              </div>
              <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:7px solid #dc2626; margin-top:-1px;"></div>
            </div>
          `,
          iconSize: [0, 0]
        });
        L.marker(CUSTOMER_COORDS, { icon: customerIcon }).addTo(map);

        // 4. Initial Courier Marker
        const details = getCourierDetails(status, language);
        const courierIcon = createCourierIcon(L, details);
        const courierMarker = L.marker(details.coords, { icon: courierIcon }).addTo(map);
        courierMarkerRef.current = courierMarker;

        // Auto fit both points with nice padding
        const bounds = L.latLngBounds([BAZAAR_COORDS, CUSTOMER_COORDS]);
        map.fitBounds(bounds, { padding: [50, 40] });

      } catch (err) {
        console.error('Map init error:', err);
      }
    };

    setupMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Smoothly Update Courier Marker position and icon when status changes (NO MAP RELOAD!)
  useEffect(() => {
    const L = leafletLibRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !courierMarkerRef.current) return;

    try {
      const details = getCourierDetails(status, language);
      courierMarkerRef.current.setLatLng(details.coords);
      courierMarkerRef.current.setIcon(createCourierIcon(L, details));
    } catch (err) {
      console.warn('Courier marker update error:', err);
    }
  }, [status, language]);

  function createCourierIcon(L, details) {
    return L.divIcon({
      className: 'live-courier-marker',
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%); position:relative;">
          <div style="position:absolute; width:48px; height:48px; border-radius:50%; background:${details.color}; opacity:0.35; animation:yandexPulse 2s cubic-bezier(0.24,0,0.38,1) infinite;"></div>
          <div style="width:36px; height:36px; border-radius:50%; background:${details.color}; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 4px 16px rgba(0,0,0,0.35); border:2.5px solid #ffffff; position:relative; z-index:2;">
            ${details.emoji}
          </div>
          <div style="position:absolute; top:40px; background:rgba(15,23,42,0.92); color:#ffffff; padding:2px 7px; border-radius:6px; font-size:9px; font-weight:800; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.25); z-index:3;">
            ${details.label}
          </div>
        </div>
      `,
      iconSize: [0, 0]
    });
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '310px',
      borderRadius: '24px',
      overflow: 'hidden',
      border: '1.5px solid #e2e8f0',
      boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
      background: '#e2e8f0'
    }}>
      <style>{`
        @keyframes yandexPulse {
          0% { transform: scale(0.85); opacity: 0.7; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(0.85); opacity: 0; }
        }
        .leaflet-container {
          background: #e2e8f0 !important;
          font-family: inherit !important;
        }
        .leaflet-tile {
          filter: contrast(1.02) brightness(0.99) !important;
        }
      `}</style>
      
      {/* Map DOM Element */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Top Banner (Yandex Go style) */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        right: '12px',
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '10px 14px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 500,
        border: '1px solid rgba(255,255,255,0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: status === 'delivered' ? '#16a34a' : '#10b981',
            boxShadow: '0 0 10px #10b981'
          }} />
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
            {status === 'pending' && (language === 'ru' ? '⏳ Заказ принят' : 'Kutilmoqda')}
            {status === 'picking' && (language === 'ru' ? '🛒 Аравачи на базаре' : '🛒 Aravachi yig\'moqda')}
            {status === 'handed_over' && (language === 'ru' ? '🤝 Передано таксисту' : '🤝 Taksiga topshirildi')}
            {status === 'on_the_way' && (language === 'ru' ? '🚗 Такси едет к вам' : '🚗 Taksi yo\'lda')}
            {status === 'delivered' && (language === 'ru' ? '✅ Доставлено' : '✅ Yetkazildi')}
          </span>
        </div>

        <div style={{
          background: '#064e3b',
          color: '#ffffff',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '0.78rem',
          fontWeight: 800
        }}>
          {status === 'delivered' ? '0 min' : '~15-20 min'}
        </div>
      </div>

      {/* Floating Bottom Street Path Badge */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        right: '12px',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(8px)',
        color: '#ffffff',
        padding: '7px 12px',
        borderRadius: '14px',
        zIndex: 500,
        fontSize: '0.75rem',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🏛️ Yunusobod Bozori</span>
          <span style={{ color: '#10b981' }}>➔</span>
          <span>🏠 {deliveryAddress ? deliveryAddress.slice(0, 16) : '19-mavze'}</span>
        </div>
        <a 
          href={`https://yandex.com/maps/?rtext=41.3653,69.2885~41.3778,69.2978&rtt=auto`} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: '#38bdf8',
            textDecoration: 'none',
            fontSize: '0.72rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <span>Яндекс Карты</span>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

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
      loadLatestOrder();
    }
  }, [initialOrderNumber]);

  const loadLatestOrder = async () => {
    setLoading(true);
    try {
      const orders = await api.getOrders(1);
      if (orders && orders.length > 0) {
        setOrder(orders[0]);
        setSearchNum(orders[0].order_number);
        try { localStorage.setItem('yunusobod_last_order', orders[0].order_number); } catch {}
      } else {
        setOrder(null);
      }
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

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

  // Instant optimistic status update (GUARANTEED: NEVER FREEZES OR BLOCKS CLICKS)
  const handleQuickStatusChange = (newStatus) => {
    if (!order) return;
    triggerHaptic('medium');

    // 1. Instantly update UI and map marker position
    setOrder(prev => ({ ...prev, status: newStatus }));

    // 2. Persist to backend asynchronously in background
    api.updateOrderStatus(order.id, newStatus).catch(err => {
      console.warn('Background status sync note:', err);
    });
  };

  // Progress segments (1: Qabul, 2: Aravachi, 3: Taksi, 4: Yetkazildi)
  const getProgressSegmentIndex = () => {
    if (!order) return 0;
    if (order.status === 'pending') return 1;
    if (order.status === 'picking') return 2;
    if (order.status === 'handed_over') return 3;
    if (order.status === 'on_the_way') return 3;
    if (order.status === 'delivered') return 4;
    return 2;
  };

  const activeSegment = getProgressSegmentIndex();

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '14px 12px 110px', fontFamily: 'inherit' }}>
      
      {/* 1. Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px',
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
            border: '1.5px solid #e2e8f0',
            color: '#0f172a',
            padding: '8px 14px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <ArrowLeft size={16} color="#059669" />
          <span>{language === 'ru' ? 'На базар' : 'Bozorga'}</span>
        </button>

        {order && (
          <button
            type="button"
            onClick={handleCopyOrderNumber}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              padding: '6px 12px',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 800,
              color: '#0f172a',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontFamily: 'monospace', color: '#059669' }}>#{order.order_number}</span>
            {copied ? <Check size={14} color="#059669" /> : <Copy size={14} color="#64748b" />}
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⏳</div>
          {language === 'ru' ? 'Загружаем трекер заказа...' : 'Buyurtma xaritasi yuklanmoqda...'}
        </div>
      )}

      {/* Not Found */}
      {!loading && !order && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: '#ffffff',
          borderRadius: '20px',
          border: '1.5px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📦</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
            {language === 'ru' ? 'Заказ не найден' : 'Buyurtma topilmadi'}
          </h3>
          <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '20px' }}>
            {language === 'ru' ? 'Сделайте заказ в каталоге или введите номер' : 'Katalogdan xarid qiling yoki raqamni kiriting'}
          </p>
          <button 
            type="button" 
            onClick={onBackToMarket}
            style={{
              background: 'linear-gradient(135deg, #059669, #10b981)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '0.9rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            🛒 {language === 'ru' ? 'В каталог базара' : 'Bozorga o\'tish'}
          </button>
        </div>
      )}

      {/* Order Details Found */}
      {!loading && order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* A. HERO: REALISTIC STREET MAP (Yandex Go style) */}
          <YandexGoMap 
            status={order.status} 
            deliveryAddress={order.delivery_address} 
            language={language} 
          />

          {/* B. DISPATCHER TEST BUTTONS (NOW 100% INSTANT CLICKABLE!) */}
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '12px 14px',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <SlidersHorizontal size={14} color="#059669" />
                <span>{language === 'ru' ? '⚡️ Проверить статус заказа (нажимай):' : '⚡️ Holatni sinab ko\'rish:'}</span>
              </span>
              <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 800, background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                {language === 'ru' ? 'Живой тест' : 'Jonli rejim'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleQuickStatusChange('picking')}
                style={{
                  padding: '10px 4px',
                  borderRadius: '12px',
                  border: order.status === 'picking' ? '2px solid #059669' : '1.5px solid #e2e8f0',
                  background: order.status === 'picking' ? '#059669' : '#f8fafc',
                  color: order.status === 'picking' ? '#ffffff' : '#334155',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  boxShadow: order.status === 'picking' ? '0 4px 12px rgba(5,150,105,0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🛒</span>
                <span>{language === 'ru' ? 'Сборка' : 'Yig\'ish'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickStatusChange('handed_over')}
                style={{
                  padding: '10px 4px',
                  borderRadius: '12px',
                  border: order.status === 'handed_over' ? '2px solid #d97706' : '1.5px solid #e2e8f0',
                  background: order.status === 'handed_over' ? '#d97706' : '#f8fafc',
                  color: order.status === 'handed_over' ? '#ffffff' : '#334155',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  boxShadow: order.status === 'handed_over' ? '0 4px 12px rgba(217,119,6,0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🤝</span>
                <span>{language === 'ru' ? 'Таксисту' : 'Taksiga'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickStatusChange('on_the_way')}
                style={{
                  padding: '10px 4px',
                  borderRadius: '12px',
                  border: order.status === 'on_the_way' ? '2px solid #0284c7' : '1.5px solid #e2e8f0',
                  background: order.status === 'on_the_way' ? '#0284c7' : '#ffffff',
                  color: order.status === 'on_the_way' ? '#ffffff' : '#334155',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  boxShadow: order.status === 'on_the_way' ? '0 4px 12px rgba(2,132,199,0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🚗</span>
                <span>{language === 'ru' ? 'В пути' : 'Yo\'lda'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickStatusChange('delivered')}
                style={{
                  padding: '10px 4px',
                  borderRadius: '12px',
                  border: order.status === 'delivered' ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
                  background: order.status === 'delivered' ? '#16a34a' : '#f8fafc',
                  color: order.status === 'delivered' ? '#ffffff' : '#334155',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  boxShadow: order.status === 'delivered' ? '0 4px 12px rgba(22,163,74,0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>✅</span>
                <span>{language === 'ru' ? 'Доставлен' : 'Yetdi'}</span>
              </button>
            </div>
          </div>

          {/* C. YANDEX GO STATUS CARD (Headline + Progress Bar + Team Info) */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '20px',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 8px 25px rgba(0,0,0,0.06)'
          }}>
            {/* Status Big Headline */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px', lineHeight: 1.25 }}>
                {order.status === 'pending' && (language === 'ru' ? '⏳ Заказ принят в систему' : 'Buyurtma tizimga qabul qilindi')}
                {order.status === 'picking' && (language === 'ru' ? '🛒 Аравачи отбирает продукты на базаре' : '🛒 Aravachi saralamoqda')}
                {order.status === 'handed_over' && (language === 'ru' ? '🤝 Заказ передан таксисту у ворот базара' : '🤝 Taksistga topshirildi')}
                {order.status === 'on_the_way' && (language === 'ru' ? '🚗 Таксист везет ваш заказ' : '🚗 Taksi manzil sari yo\'lda')}
                {order.status === 'delivered' && (language === 'ru' ? '✅ Заказ доставлен к вашей двери!' : '✅ Buyurtma yetkazildi!')}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                {order.status === 'pending' && (language === 'ru' ? 'Продавцы Юнусабадского базара готовят товары' : 'Bozor sotuvchilari mahsulotlarni tayyorlamoqda')}
                {order.status === 'picking' && (language === 'ru' ? 'Сборщик отбирает самые свежие фрукты и овощи на рядах' : 'Yunusobod rastalarida eng sara yangi mahsulotlar yig\'ilmoqda')}
                {order.status === 'handed_over' && (language === 'ru' ? 'Пакеты проверены и погружены в багажник такси' : 'Xaridlar tekshirilib, taksi mashinasiga yuklandi')}
                {order.status === 'on_the_way' && (language === 'ru' ? 'Водитель Cobalt 01 A 777 AA подъезжает по вашему адресу' : 'Cobalt 01 A 777 AA manzil sari harakatlanmoqda')}
                {order.status === 'delivered' && (language === 'ru' ? 'Приятного аппетита и спасибо за покупку на базаре!' : 'Yoqimli ishtaha, xaridingiz uchun rahmat!')}
              </div>
            </div>

            {/* Segmented Progress Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              margin: '16px 0 20px'
            }}>
              {[
                { step: 1, label: language === 'ru' ? 'Принят' : 'Qabul' },
                { step: 2, label: language === 'ru' ? 'Аравачи' : 'Aravachi' },
                { step: 3, label: language === 'ru' ? 'Такси' : 'Taksi' },
                { step: 4, label: language === 'ru' ? 'Доставлен' : 'Yetkazildi' }
              ].map((seg) => {
                const isPassed = activeSegment >= seg.step;
                const isCurrent = activeSegment === seg.step;

                return (
                  <div key={seg.step} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{
                      height: '6px',
                      borderRadius: '999px',
                      background: isPassed ? '#10b981' : '#e2e8f0',
                      transition: 'all 0.3s ease',
                      boxShadow: isCurrent ? '0 0 8px rgba(16,185,129,0.5)' : 'none'
                    }} />
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: isPassed ? 800 : 600,
                      color: isPassed ? '#065f46' : '#94a3b8',
                      textAlign: 'center'
                    }}>
                      {seg.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Courier / Driver Profile Badge */}
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: order.status === 'on_the_way' ? '#0284c7' : (order.status === 'handed_over' ? '#d97706' : '#059669'),
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  {order.status === 'on_the_way' ? '🚕' : (order.status === 'handed_over' ? '🤝' : '🛒')}
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                    {order.porter_name
                      ? `${order.porter_name} (${language === 'ru' ? 'Аравачи' : 'Aravachi'})`
                      : (order.status === 'on_the_way' 
                        ? 'Farhod aka (Таксист)' 
                        : (order.status === 'handed_over' ? 'Передача у ворот №4' : (language === 'ru' ? 'Ищем свободного аравачи…' : "Bo'sh aravachi qidirilmoqda…")))}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '1px' }}>
                    {order.porter_name
                      ? (order.status === 'handed_over'
                        ? (language === 'ru' ? 'Передал заказ курьеру' : 'Buyurtmani kuryerga topshirdi')
                        : (order.status === 'on_the_way'
                          ? (language === 'ru' ? 'Несёт заказ к вам' : 'Buyurtmani sizga olib kelmoqda')
                          : (language === 'ru' ? 'Собирает заказ по растам' : "Rastalardan buyurtmani yig'moqda")))
                      : (order.status === 'on_the_way' 
                        ? 'Cobalt Oq • 01 A 777 AA' 
                        : (order.status === 'handed_over' ? 'Сборщик ➔ Водитель' : 'Юнусабадский базар'))}
                  </div>
                </div>
              </div>

              <a
                href={`tel:${(order.porter_phone || '+998901234567').replace(/[^\d+]/g, '')}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#10b981',
                  color: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                  boxShadow: '0 3px 10px rgba(16,185,129,0.35)',
                  flexShrink: 0
                }}
              >
                <PhoneCall size={14} />
                <span>{language === 'ru' ? 'Связь' : 'Aloqa'}</span>
              </a>
            </div>

            {/* Clear Route and Location Points (EXACTLY WHAT USER ASKED) */}
            <div style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px dashed #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* Pickup Point */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  flexShrink: 0,
                  marginTop: '1px'
                }}>
                  🏛️
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    {language === 'ru' ? 'Откуда (Точка сбора):' : 'Qayerdan (Bozor):'}
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                    {language === 'ru' ? 'Юнусабадский Дехкон Бозар (Ряды 1-14)' : 'Yunusobod Dehqon Bozori (1-14 rastalar)'}
                  </div>
                </div>
              </div>

              {/* Delivery Point */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  flexShrink: 0,
                  marginTop: '1px'
                }}>
                  📍
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    {language === 'ru' ? 'Куда (Адрес клиента):' : 'Qayerga (Manzil):'}
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                    {order.delivery_district ? `${order.delivery_district}, ` : ''}{order.delivery_address}
                  </div>
                  {order.landmark && (
                    <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                      🚩 {language === 'ru' ? 'Ориентир' : 'Mo\'ljal'}: {order.landmark}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* D. ORDER ITEMS BREAKDOWN */}
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '18px 16px',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                🛍️ {language === 'ru' ? 'Состав заказа' : 'Buyurtma tarkibi'}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
                {order.items?.length || 0} {language === 'ru' ? 'наименования' : 'tur'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {order.items?.map((item, idx) => (
                <div 
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: '#dcfce7',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}>
                      ✓
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                        {item.product_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
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
              <span>⚡️ {language === 'ru' ? 'Доставка такси по району' : 'Yetkazib berish'}:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{order.delivery_fee?.toLocaleString() || '15 000'} UZS</span>
            </div>

            {/* Grand Total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '10px',
              padding: '10px 14px',
              background: '#ecfdf5',
              borderRadius: '12px',
              fontSize: '0.92rem',
              fontWeight: 800,
              color: '#065f46'
            }}>
              <span>{language === 'ru' ? 'Итого к оплате:' : 'Jami to\'lov:'}</span>
              <span style={{ fontSize: '1.15rem', color: '#047857' }}>
                {order.total_amount?.toLocaleString()} UZS
              </span>
            </div>
          </div>

          {/* E. Back to Market Main Button */}
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
            <span>🛒 {language === 'ru' ? 'Вернуться на базар' : 'Bozorga qaytish'}</span>
          </button>

        </div>
      )}

    </div>
  );
}
