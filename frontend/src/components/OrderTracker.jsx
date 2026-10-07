import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Phone, Copy, Check, ChevronDown, ChevronRight, MapPin, Clock, CreditCard, Package } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';

const BAZAAR = { lat: 41.3655, lng: 69.2885 };
const MY_ORDERS_KEY = 'yunusobod_my_orders';
const REFRESH_MS = 10000;

const T = {
  my_orders: { uz: 'Mening buyurtmalarim', ru: 'Мои заказы', en: 'My orders' },
  empty: { uz: "Sizda hali buyurtma yo'q", ru: 'У вас пока нет заказов', en: 'You have no orders yet' },
  empty_hint: { uz: "Bozordan mahsulot tanlang — buyurtma holati shu yerda ko'rinadi", ru: 'Выберите товары на базаре — статус заказа появится здесь', en: 'Pick products at the bazaar — order status will appear here' },
  to_market: { uz: "Bozorga o'tish", ru: 'Перейти на базар', en: 'Go to the bazaar' },
  order: { uz: 'Buyurtma', ru: 'Заказ', en: 'Order' },
  arrive_by: { uz: 'Taxminiy vaqt', ru: 'Ожидаемое время', en: 'Estimated arrival' },
  porter: { uz: 'Aravachi', ru: 'Аравачи', en: 'Porter' },
  call: { uz: "Qo'ng'iroq", ru: 'Позвонить', en: 'Call' },
  contents: { uz: 'Buyurtma tarkibi', ru: 'Состав заказа', en: 'Order contents' },
  items: { uz: 'ta mahsulot', ru: 'товаров', en: 'items' },
  collected_of: { uz: "yig'ildi", ru: 'собрано', en: 'collected' },
  address: { uz: 'Manzil', ru: 'Адрес', en: 'Address' },
  payment: { uz: "To'lov", ru: 'Оплата', en: 'Payment' },
  delivery: { uz: 'Yetkazish', ru: 'Доставка', en: 'Delivery' },
  total: { uz: 'Jami', ru: 'Итого', en: 'Total' },
  copied: { uz: 'nusxa olindi', ru: 'скопировано', en: 'copied' },
  order_again: { uz: 'Yana buyurtma berish', ru: 'Заказать ещё', en: 'Order again' },
  cash: { uz: 'Naqd', ru: 'Наличные', en: 'Cash' },
};

const STEPS = {
  uz: ['Qabul qilindi', "Yig'ilmoqda", "Yo'lda", 'Yetkazildi'],
  ru: ['Принят', 'Собираем', 'В пути', 'Доставлен'],
  en: ['Accepted', 'Collecting', 'On the way', 'Delivered'],
};

const STATUS = {
  pending: {
    step: 0, emoji: '🧾',
    title: { uz: 'Buyurtma qabul qilindi', ru: 'Заказ принят', en: 'Order accepted' },
    sub: { uz: "Bo'sh aravachini qidiryapmiz", ru: 'Ищем свободного аравачи на базаре', en: 'Looking for a free porter' },
  },
  picking: {
    step: 1, emoji: '🛒',
    title: { uz: "Bozorda yig'ilmoqda", ru: 'Собираем на базаре', en: 'Collecting at the bazaar' },
    sub: { uz: 'Aravachi rastalarni aylanib chiqmoqda', ru: 'Аравачи обходит расты и выбирает свежее', en: 'The porter is visiting the stalls' },
  },
  handed_over: {
    step: 2, emoji: '🤝',
    title: { uz: 'Kuryerga topshirildi', ru: 'Передан курьеру', en: 'Handed to courier' },
    sub: { uz: "Kuryer tez orada yo'lga chiqadi", ru: 'Курьер скоро выедет к вам', en: 'The courier is about to leave' },
  },
  on_the_way: {
    step: 2, emoji: '🚗',
    title: { uz: "Kuryer yo'lda", ru: 'Курьер в пути', en: 'Courier on the way' },
    sub: { uz: 'Buyurtmangizni olib kelmoqda', ru: 'Везём заказ к вам', en: 'Bringing your order to you' },
  },
  delivered: {
    step: 3, emoji: '🎉',
    title: { uz: 'Yetkazildi', ru: 'Заказ доставлен', en: 'Delivered' },
    sub: { uz: 'Yoqimli ishtaha!', ru: 'Приятного аппетита!', en: 'Enjoy your meal!' },
  },
  cancelled: {
    step: -1, emoji: '✖️',
    title: { uz: 'Buyurtma bekor qilindi', ru: 'Заказ отменён', en: 'Order cancelled' },
    sub: { uz: "Savollar bo'lsa, bizga yozing", ru: 'Если есть вопросы, напишите нам', en: 'Contact us if you have questions' },
  },
};
STATUS.accepted = STATUS.pending;

export const ACTIVE_STATUSES = ['pending', 'accepted', 'picking', 'handed_over', 'on_the_way'];

export function statusTitle(status, language) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const s = STATUS[status] || STATUS.pending;
  return `${s.emoji} ${s.title[lang]}`;
}

function readMyOrders() {
  try {
    const list = JSON.parse(localStorage.getItem(MY_ORDERS_KEY) || '[]');
    const last = localStorage.getItem('yunusobod_last_order');
    if (last && !list.includes(last)) list.unshift(last);
    return list;
  } catch {
    return [];
  }
}

function saveMyOrders(list) {
  try { localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(list.slice(0, 20))); } catch {}
}

export function rememberMyOrder(orderNumber) {
  saveMyOrders([orderNumber, ...readMyOrders().filter((n) => n !== orderNumber)]);
}

function parseDate(value) {
  if (!value) return null;
  // Backend sends UTC without a timezone suffix
  return new Date(/Z|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

function formatTime(date) {
  return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
}

function etaText(order, lang) {
  if (!ACTIVE_STATUSES.includes(order.status)) return null;
  const created = parseDate(order.created_at);
  if (order.delivery_time_slot?.startsWith('Express') && created) {
    const time = formatTime(new Date(created.getTime() + 60 * 60000));
    return lang === 'ru' ? `до ${time}` : (lang === 'en' ? `by ${time}` : `${time} gacha`);
  }
  return order.delivery_time_slot;
}

// Small map: bazaar → delivery point (MapLibre + free OpenFreeMap tiles)
function RouteMap({ order }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const hasHome = order.delivery_lat != null && order.delivery_lng != null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (cancelled || !elRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: elRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [BAZAAR.lng, BAZAAR.lat],
        zoom: 14.5,
        interactive: false,
        attributionControl: { compact: true }
      });
      mapRef.current = map;

      const pin = (emoji, bg) => {
        const el = document.createElement('div');
        el.style.cssText = `width:36px;height:36px;border-radius:50%;background:${bg};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:17px`;
        el.textContent = emoji;
        return el;
      };
      new maplibregl.Marker({ element: pin('🏪', '#059669') }).setLngLat([BAZAAR.lng, BAZAAR.lat]).addTo(map);

      map.once('load', () => {
        map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        if (!hasHome) return;
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[BAZAAR.lng, BAZAAR.lat], [order.delivery_lng, order.delivery_lat]] } }
        });
        map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#059669', 'line-width': 4, 'line-dasharray': [2, 1.5] } });
      });

      if (hasHome) {
        new maplibregl.Marker({ element: pin('🏠', '#2563eb') }).setLngLat([order.delivery_lng, order.delivery_lat]).addTo(map);
        const bounds = new maplibregl.LngLatBounds([BAZAAR.lng, BAZAAR.lat], [BAZAAR.lng, BAZAAR.lat]).extend([order.delivery_lng, order.delivery_lat]);
        map.fitBounds(bounds, { padding: { top: 50, bottom: 70, left: 50, right: 50 }, maxZoom: 15, duration: 0 });
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [order.order_number, hasHome, order.delivery_lat, order.delivery_lng]);

  return <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />;
}

const card = { background: '#ffffff', borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(15,23,42,0.06)' };

export default function OrderTracker({ initialOrderNumber, onBackToMarket, onOrderNotFound }) {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (key) => T[key]?.[lang] || T[key]?.uz || key;
  const st = (status) => STATUS[status] || STATUS.pending;

  const [myOrders, setMyOrders] = useState(() => {
    if (initialOrderNumber) rememberMyOrder(initialOrderNumber);
    return readMyOrders();
  });
  const [orders, setOrders] = useState({});
  const [openNumber, setOpenNumber] = useState(initialOrderNumber || null);
  const [loading, setLoading] = useState(true);
  const [showItems, setShowItems] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!initialOrderNumber) return;
    rememberMyOrder(initialOrderNumber);
    setMyOrders(readMyOrders());
    setOpenNumber(initialOrderNumber);
  }, [initialOrderNumber]);

  const load = useCallback(async (numbers) => {
    const results = await Promise.all(numbers.map((n) => api.getOrder(n).then((o) => [n, o]).catch(() => [n, null])));
    setOrders((prev) => {
      const next = { ...prev };
      results.forEach(([n, o]) => { if (o) next[n] = o; });
      return next;
    });
    setLoading(false);
    return results;
  }, []);

  // Orders are remembered on this device only, so customers never see each other's orders
  useEffect(() => {
    if (myOrders.length === 0) { setLoading(false); return; }
    load(myOrders.slice(0, 10)).then((results) => {
      const missing = results.filter(([, o]) => !o).map(([n]) => n);
      if (!missing.length) return;
      const kept = readMyOrders().filter((n) => !missing.includes(n));
      saveMyOrders(kept);
      try {
        if (missing.includes(localStorage.getItem('yunusobod_last_order'))) localStorage.removeItem('yunusobod_last_order');
      } catch {}
      setMyOrders(kept);
      if (missing.includes(openNumber)) setOpenNumber(null);
      if (missing.includes(initialOrderNumber) && onOrderNotFound) onOrderNotFound();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myOrders.join(',')]);

  // Live updates while the open order is still in progress
  const openOrder = openNumber ? orders[openNumber] : null;
  useEffect(() => {
    if (!openNumber || (openOrder && !ACTIVE_STATUSES.includes(openOrder.status))) return;
    const timer = setInterval(() => load([openNumber]), REFRESH_MS);
    return () => clearInterval(timer);
  }, [openNumber, openOrder?.status, load]);

  // Gentle vibration when the status changes, like delivery apps do
  const lastStatusRef = useRef(null);
  useEffect(() => {
    if (!openOrder) return;
    if (lastStatusRef.current && lastStatusRef.current !== openOrder.status) triggerHaptic('success');
    lastStatusRef.current = openOrder.status;
  }, [openOrder?.status]);

  const copyNumber = () => {
    if (!openOrder || !navigator.clipboard) return;
    navigator.clipboard.writeText(openOrder.order_number);
    triggerHaptic('light');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const backBtn = (onClick) => (
    <button type="button" onClick={onClick} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#ffffff', boxShadow: '0 1px 6px rgba(15,23,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} aria-label="back">
      <ArrowLeft size={20} />
    </button>
  );

  // ---------- Order detail (Yandex Go style) ----------
  if (openNumber && (openOrder || loading)) {
    if (!openOrder) {
      return <div style={{ padding: '60px 16px', textAlign: 'center', color: '#64748b' }}>…</div>;
    }
    const status = st(openOrder.status);
    const items = openOrder.items || [];
    const picked = items.filter((i) => i.is_picked).length;
    const eta = etaText(openOrder, lang);
    const isActive = ACTIVE_STATUSES.includes(openOrder.status);
    const subtitle = openOrder.status === 'picking' && openOrder.porter_name
      ? `${openOrder.porter_name} · ${t('collected_of')} ${picked} / ${items.length}`
      : status.sub[lang];
    const paymentLabel = openOrder.payment_method === 'payme' ? 'Payme' : (openOrder.payment_method === 'click' ? 'Click' : t('cash'));

    return (
      <div className="animate-fade" style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 110 }}>
        {/* Map header */}
        <div style={{ position: 'relative', height: 240, margin: '0 -12px', background: '#e5e7eb', overflow: 'hidden' }}>
          <RouteMap order={openOrder} />
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
            {backBtn(() => { setOpenNumber(null); setShowItems(false); })}
          </div>
        </div>

        {/* Status sheet overlapping the map */}
        <div style={{ ...card, marginTop: -32, position: 'relative', zIndex: 3, borderRadius: 24, padding: '18px 18px 16px', boxShadow: '0 -4px 18px rgba(15,23,42,0.10)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 30, lineHeight: 1 }}>{status.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{status.title[lang]}</div>
              <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{subtitle}</div>
            </div>
          </div>

          {status.step >= 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
              {STEPS[lang].map((label, i) => (
                <div key={label} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ height: 6, borderRadius: 3, background: i < status.step || status.step === 3 ? '#059669' : '#e2e8f0', overflow: 'hidden', position: 'relative' }}>
                    {i === status.step && status.step < 3 && (
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #a7f3d0, #059669, #a7f3d0)', backgroundSize: '200% 100%', animation: 'ot-flow 1.6s linear infinite' }} />
                    )}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 5, color: i <= status.step ? '#065f46' : '#94a3b8', fontWeight: i === status.step ? 800 : 600, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {isActive && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 8 }}>
              <div style={{ fontSize: 14, color: '#0f172a', minWidth: 0 }}>
                {eta && <><span style={{ color: '#64748b' }}>{t('arrive_by')}: </span><b>{eta}</b></>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#059669', fontWeight: 800, whiteSpace: 'nowrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'ot-pulse 1.4s ease-in-out infinite' }} />
                LIVE
              </div>
            </div>
          )}
        </div>

        {/* Porter */}
        {openOrder.porter_name && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ecfdf5', color: '#047857', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {openOrder.porter_name.trim().charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{openOrder.porter_name}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{t('porter')} · Yunusobod Dehqon Bozori</div>
            </div>
            {openOrder.porter_phone && isActive && (
              <a href={`tel:${openOrder.porter_phone.replace(/[^\d+]/g, '')}`} style={{ width: 44, height: 44, borderRadius: '50%', background: '#059669', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-label={t('call')}>
                <Phone size={20} />
              </a>
            )}
          </div>
        )}

        {/* Contents */}
        <div style={card}>
          <button type="button" onClick={() => setShowItems((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <Package size={20} color="#059669" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{t('contents')}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {items.length} {t('items')} · {openOrder.status === 'picking' ? `${t('collected_of')} ${picked}/${items.length}` : `${Math.round(openOrder.total_amount).toLocaleString()} UZS`}
              </div>
            </div>
            <ChevronDown size={20} color="#64748b" style={{ transform: showItems ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
          </button>
          {showItems && (
            <div style={{ marginTop: 12 }}>
              {items.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: item.is_picked ? '#059669' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.is_picked && <Check size={14} color="#ffffff" />}
                  </div>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: '#0f172a' }}>{item.product_name}</span>
                  <span style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)} {item.unit}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{Math.round(item.total_price).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid #f1f5f9', fontSize: 14, color: '#64748b' }}>
                <span>{t('delivery')}</span><span>{Math.round(openOrder.delivery_fee).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, borderTop: '1px solid #e2e8f0', fontSize: 16, fontWeight: 800 }}>
                <span>{t('total')}</span><span>{Math.round(openOrder.total_amount).toLocaleString()} UZS</span>
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div style={card}>
          {[
            [MapPin, t('address'), [openOrder.delivery_district, openOrder.delivery_address].filter(Boolean).join(', ') + (openOrder.landmark ? ` · ${openOrder.landmark}` : '')],
            [Clock, t('delivery'), openOrder.delivery_time_slot],
            [CreditCard, t('payment'), paymentLabel],
          ].map(([Icon, label, value], i) => (
            <div key={label} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? '1px solid #f1f5f9' : 'none' }}>
              <Icon size={18} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
                <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</div>
              </div>
            </div>
          ))}
          <button type="button" onClick={copyNumber} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 0 0', marginTop: 4, border: 'none', borderTop: '1px solid #f1f5f9', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13 }}>
            {copied ? <Check size={16} color="#059669" /> : <Copy size={16} />}
            {t('order')} #{openOrder.order_number}{copied ? ` · ${t('copied')}` : ''}
          </button>
        </div>

        {!isActive && (
          <button type="button" onClick={onBackToMarket} style={{ width: '100%', height: 52, borderRadius: 16, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
            {t('order_again')}
          </button>
        )}

        <style>{`
          @keyframes ot-flow { from { background-position: 200% 0; } to { background-position: 0 0; } }
          @keyframes ot-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
          .maplibregl-ctrl-attrib { font-size: 9px; }
        `}</style>
      </div>
    );
  }

  // ---------- List of this customer's orders ----------
  const listed = myOrders.map((n) => orders[n]).filter(Boolean);

  return (
    <div className="animate-fade" style={{ maxWidth: 640, margin: '0 auto', padding: '14px 0 110px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {backBtn(onBackToMarket)}
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('my_orders')}</h2>
      </div>

      {!loading && listed.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '36px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🛍️</div>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{t('empty')}</div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 18 }}>{t('empty_hint')}</div>
          <button type="button" onClick={onBackToMarket} style={{ padding: '13px 22px', borderRadius: 14, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            {t('to_market')}
          </button>
        </div>
      )}

      {listed.map((o) => {
        const active = ACTIVE_STATUSES.includes(o.status);
        const created = parseDate(o.created_at);
        return (
          <button key={o.order_number} type="button" onClick={() => { triggerHaptic('light'); setOpenNumber(o.order_number); }} style={{ ...card, width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: active ? '1.5px solid #6ee7b7' : '1.5px solid transparent', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: active ? '#ecfdf5' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
              {st(o.status).emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: active ? '#047857' : '#0f172a' }}>{st(o.status).title[lang]}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                #{o.order_number} · {created ? created.toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''} {formatTime(created)}
              </div>
              <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{Math.round(o.total_amount).toLocaleString()} UZS</div>
            </div>
            <ChevronRight size={20} color="#94a3b8" style={{ flexShrink: 0 }} />
          </button>
        );
      })}
    </div>
  );
}
