import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Phone, Copy, Check, ChevronDown, ChevronRight, MapPin, Clock, CreditCard, Package, Star } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';
import { formatUnit } from './ProductCard';
import { slotLabel } from '../services/slots';
import { fulfillmentLabel, pointName, bonusLabel } from '../services/offers';
import { stallLabel, itemName } from '../services/stall';

const BAZAAR = { lat: 41.36467, lng: 69.29089 };
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
  cancel: { uz: 'Buyurtmani bekor qilish', ru: 'Отменить заказ', en: 'Cancel order' },
  rate_title: { uz: 'Buyurtmani baholang', ru: 'Оцените заказ', en: 'Rate your order' },
  rate_hint: { uz: "Bahoyingiz rastalar reytingiga qo'shiladi", ru: 'Ваша оценка войдёт в рейтинг раст', en: 'Your rating counts toward the stalls' },
  rate_comment: { uz: 'Izoh (ixtiyoriy)', ru: 'Комментарий (необязательно)', en: 'Comment (optional)' },
  rate_send: { uz: 'Yuborish', ru: 'Отправить', en: 'Send' },
  rate_thanks: { uz: 'Bahoyingiz uchun rahmat!', ru: 'Спасибо за оценку!', en: 'Thanks for your rating!' },
  cancel_confirm: { uz: 'Buyurtmani bekor qilasizmi?', ru: 'Отменить заказ?', en: 'Cancel this order?' },
  cash: { uz: 'Naqd', ru: 'Наличные', en: 'Cash' },
  help: { uz: 'Savol yoki muammo bormi?', ru: 'Есть вопрос или проблема?', en: 'Question or problem?' },
  help_call: { uz: "Bozorga qo'ng'iroq qiling", ru: 'Позвоните на базар', en: 'Call the bazaar' },
  code_title: { uz: 'Qabul qilish kodi', ru: 'Код получения', en: 'Pickup code' },
  code_hint: { uz: 'Buyurtmani olganingizda kuryer yoki aravachiga ayting', ru: 'Назовите курьеру или аравачи, когда получите заказ', en: 'Tell it to the courier or porter when you get the order' },
  weight_ask: { uz: 'Tarozida ko\'proq chiqdi', ru: 'На весах вышло больше', en: 'The scale shows more' },
  weight_ask_body: { uz: '{name}: {qty} (buyurtma {ordered}). Narx {old} → {new} so\'m. Rozimisiz?', ru: '{name}: {qty} (заказано {ordered}). Цена {old} → {new} сум. Согласны?', en: '{name}: {qty} (ordered {ordered}). Price {old} → {new} UZS. OK?' },
  weight_yes: { uz: '✅ Roziman', ru: '✅ Согласен', en: '✅ Yes' },
  weight_no: { uz: '✂️ Buyurtma vaznida qolsin', ru: '✂️ Оставить заказанный вес', en: '✂️ Keep the ordered weight' },
  photo: { uz: 'tarozi rasmi', ru: 'фото весов', en: 'scale photo' },
  ran_out: { uz: 'tugagan', ru: 'нет в наличии', en: 'ran out' },
  received: { uz: '✅ Buyurtmani oldim', ru: '✅ Я получил заказ', en: '✅ I got my order' },
  received_hint: { uz: "Olganingizni tasdiqlang, so'ng baholang", ru: 'Подтвердите получение, затем оцените', en: 'Confirm you got it, then rate it' },
  how: { uz: 'Qanday olasiz', ru: 'Как получить', en: 'How you get it' },
  bonuses: { uz: 'Aksiyalar', ru: 'Акции', en: 'Offers' },
  stall_discount: { uz: 'Rasta chegirmasi', ru: 'Скидка расты', en: 'Stall discount' },
};

// Progress steps differ by how the order reaches the customer
const STEPS = {
  courier: {
    uz: ['Qabul qilindi', "Yig'ilmoqda", "Yo'lda", 'Yetkazildi'],
    ru: ['Принят', 'Собираем', 'В пути', 'Доставлен'],
    en: ['Accepted', 'Collecting', 'On the way', 'Delivered'],
  },
  point: {
    uz: ['Qabul qilindi', "Yig'ilmoqda", 'Joyida', 'Olindi'],
    ru: ['Принят', 'Собираем', 'На точке', 'Получен'],
    en: ['Accepted', 'Collecting', 'At the point', 'Received'],
  },
  self: {
    uz: ['Qabul qilindi', 'Tayyorlanmoqda', 'Tayyor', 'Olindi'],
    ru: ['Принят', 'Готовят', 'Готов', 'Получен'],
    en: ['Accepted', 'Packing', 'Ready', 'Received'],
  },
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
  ready: {
    step: 2, emoji: '🛍',
    title: { uz: 'Buyurtma tayyor', ru: 'Заказ готов', en: 'Order is ready' },
    sub: { uz: 'Rastalarga kelib oling', ru: 'Заберите на растах', en: 'Collect it at the stalls' },
  },
  at_point: {
    step: 2, emoji: '📍',
    title: { uz: 'Aravachi sizni kutmoqda', ru: 'Аравачи ждёт вас', en: 'The porter is waiting' },
    sub: { uz: 'Belgilangan joyga keling', ru: 'Подойдите к точке', en: 'Come to the pickup point' },
  },
  handed_over: {
    step: 2, emoji: '🤝',
    title: { uz: 'Taksichiga topshirildi', ru: 'Передан таксисту', en: 'Handed to taxi' },
    sub: { uz: "Taksichi tez orada yo'lga chiqadi", ru: 'Таксист скоро выедет к вам', en: 'The taxi is about to leave' },
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

export const ACTIVE_STATUSES = ['pending', 'accepted', 'picking', 'ready', 'at_point', 'handed_over', 'on_the_way'];

// Where the customer can say "I got it": the order must have reached them
const RECEIVABLE = { self: ['delivered'], point: ['at_point', 'delivered'], courier: ['on_the_way', 'delivered'] };

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
  return slotLabel(order.delivery_time_slot, lang);
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
  const { language, t: tr } = useLanguage();
  const brandName = tr('brand.name');
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
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [sendingReview, setSendingReview] = useState(false);
  const [supportPhone, setSupportPhone] = useState('');
  const [points, setPoints] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [deciding, setDeciding] = useState(false);

  // Orders also live on the server for this Telegram user: a closed app or a new phone keeps them
  useEffect(() => {
    api.myOrders().then((numbers) => {
      if (!numbers?.length) return;
      const merged = [...new Set([...readMyOrders(), ...numbers])];
      saveMyOrders(merged);
      setMyOrders(merged);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.getConfig().then((cfg) => { setSupportPhone(cfg.support_phone || ''); setPoints(cfg.handoff_points || []); }).catch(() => {});
  }, []);

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

  const cancelOrder = async () => {
    if (!openOrder || !window.confirm(t('cancel_confirm'))) return;
    setCancelling(true);
    setActionError('');
    try {
      const updated = await api.cancelOrder(openOrder.order_number);
      setOrders((prev) => ({ ...prev, [updated.order_number]: updated }));
      triggerHaptic('success');
    } catch (err) {
      triggerHaptic('error');
      setActionError(err.message);
      load([openOrder.order_number]);
    } finally {
      setCancelling(false);
    }
  };

  const confirmReceived = async () => {
    if (!openOrder) return;
    setConfirming(true);
    setActionError('');
    try {
      const updated = await api.confirmReceived(openOrder.order_number);
      triggerHaptic('success');
      setOrders((prev) => ({ ...prev, [updated.order_number]: { ...prev[updated.order_number], ...updated } }));
    } catch (e) {
      setActionError(e.message);
      triggerHaptic('error');
    } finally {
      setConfirming(false);
    }
  };

  const decideWeight = async (item, approve) => {
    setDeciding(true);
    setActionError('');
    try {
      const updated = await api.weightDecision(openOrder.order_number, item.id, approve);
      triggerHaptic('success');
      setOrders((prev) => ({ ...prev, [updated.order_number]: { ...prev[updated.order_number], ...updated } }));
    } catch (e) {
      setActionError(e.message);
    } finally {
      setDeciding(false);
    }
  };

  const sendReview = async () => {
    if (!openOrder || !stars) return;
    setSendingReview(true);
    setActionError('');
    try {
      await api.reviewOrder(openOrder.order_number, stars, comment.trim() || null);
      triggerHaptic('success');
      setOrders((prev) => ({ ...prev, [openOrder.order_number]: { ...prev[openOrder.order_number], review_rating: stars } }));
    } catch (err) {
      triggerHaptic('error');
      setActionError(err.message);
    } finally {
      setSendingReview(false);
    }
  };

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
    const mode = openOrder.fulfillment || 'courier';
    const items = openOrder.items || [];
    // Self pickup: an item counts once its seller handed it over; otherwise once the aravachi took it
    const isDone = (i) => (mode === 'self' ? i.seller_handed : i.is_picked);
    const picked = items.filter(isDone).length;
    const canConfirm = RECEIVABLE[mode]?.includes(openOrder.status) && !openOrder.customer_confirmed_at;
    const bonuses = openOrder.bonuses || [];
    const pointLabel = pointName(points, openOrder.handoff_point, lang);
    const eta = etaText(openOrder, lang);
    const isActive = ACTIVE_STATUSES.includes(openOrder.status);
    const subtitle = openOrder.status === 'picking' && openOrder.porter_name
      ? `${openOrder.porter_name} · ${t('collected_of')} ${picked} / ${items.length}`
      : openOrder.status === 'at_point' && pointLabel
        ? `📍 ${pointLabel}`
        : mode === 'self' && ['pending', 'accepted', 'ready'].includes(openOrder.status)
          ? (lang === 'ru' ? `Готово ${items.filter((i) => i.seller_ready).length} из ${items.length} · выдано ${picked}` : (lang === 'en' ? `${items.filter((i) => i.seller_ready).length} of ${items.length} packed · ${picked} collected` : `${items.filter((i) => i.seller_ready).length}/${items.length} tayyor · ${picked} olindi`))
          : mode === 'point' && openOrder.status === 'pending'
            ? (lang === 'ru' ? 'Ищем свободного аравачи' : (lang === 'en' ? 'Looking for a free porter' : "Bo'sh aravachini qidiryapmiz"))
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
              {(STEPS[mode] || STEPS.courier)[lang].map((label, i) => (
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

        {/* Urgent first: the code for the courier and «the scale shows more — OK?» */}
        {/* The customer tells this code to whoever hands the order over */}
        {openOrder.handoff_code && isActive && mode !== 'self' && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 6, color: '#065f46' }}>{openOrder.handoff_code}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>🔑 {t('code_title')}</div>
              <div style={{ fontSize: 13, color: '#475569' }}>{t('code_hint')}</div>
            </div>
          </div>
        )}

        {items.filter((i) => i.weight_status === 'pending').map((item) => {
          const unit = formatUnit(item.unit, language);
          const money = (n) => Math.round(n).toLocaleString();
          return (
            <div key={`w${item.id}`} style={{ ...card, background: '#fffbeb', border: '1.5px solid #fcd34d' }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>⚖️ {t('weight_ask')}</div>
              <div style={{ fontSize: 14, marginBottom: 10 }}>
                {t('weight_ask_body').replace('{name}', itemName(item, lang)).replace('{qty}', `${item.actual_quantity} ${unit}`).replace('{ordered}', `${item.quantity} ${unit}`).replace('{old}', money(item.price * item.quantity)).replace('{new}', money(item.price * item.actual_quantity))}
                {item.weight_photo_url && <> · <a href={item.weight_photo_url} target="_blank" rel="noreferrer">📷 {t('photo')}</a></>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={deciding} onClick={() => decideWeight(item, false)} style={{ flex: 1, height: 48, borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>{t('weight_no')}</button>
                <button type="button" disabled={deciding} onClick={() => decideWeight(item, true)} style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}>{t('weight_yes')}</button>
              </div>
            </div>
          );
        })}

        {/* Porter */}
        {openOrder.porter_name && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ecfdf5', color: '#047857', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {openOrder.porter_name.trim().charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{openOrder.porter_name}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{t('porter')} · {brandName}</div>
            </div>
            {openOrder.porter_phone && isActive && (
              <a href={`tel:${openOrder.porter_phone.replace(/[^\d+]/g, '')}`} style={{ width: 44, height: 44, borderRadius: '50%', background: '#059669', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-label={t('call')}>
                <Phone size={20} />
              </a>
            )}
          </div>
        )}

        {/* Taxi driver who brings the order from the bazaar gate */}
        {openOrder.taxi_name && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🚕</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{openOrder.taxi_name}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{lang === 'ru' ? 'Таксист' : (lang === 'en' ? 'Taxi driver' : 'Taksichi')}</div>
            </div>
            {openOrder.taxi_phone && isActive && (
              <a href={`tel:${openOrder.taxi_phone.replace(/[^\d+]/g, '')}`} style={{ width: 44, height: 44, borderRadius: '50%', background: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-label={t('call')}>
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
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: isDone(item) ? '#059669' : (item.seller_ready ? '#a7f3d0' : '#e2e8f0'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isDone(item) && <Check size={14} color="#ffffff" />}
                  </div>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: item.item_status === 'missing' ? '#b91c1c' : '#0f172a', textDecoration: item.item_status === 'missing' ? 'line-through' : 'none' }}>
                    {itemName(item, lang)}
                    {item.item_status === 'missing' && <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>❌ {t('ran_out')}</span>}
                    {item.item_status !== 'missing' && item.actual_quantity != null && (
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#047857' }}>
                        ⚖️ {item.actual_quantity} {formatUnit(item.unit, language)}
                        {item.weight_photo_url && <> · <a href={item.weight_photo_url} target="_blank" rel="noreferrer" style={{ color: '#0284c7' }}>📷 {t('photo')}</a></>}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)} {formatUnit(item.unit, language)}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{Math.round(item.total_price).toLocaleString()}</span>
                </div>
              ))}
              {openOrder.discount_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid #f1f5f9', fontSize: 14, color: '#047857' }}>
                  <span>{t('stall_discount')}</span><span>−{Math.round(openOrder.discount_amount).toLocaleString()}</span>
                </div>
              )}
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
            [Package, t('how'), fulfillmentLabel(mode, lang) + (pointLabel ? ` · 📍 ${pointLabel}` : '')],
            mode === 'courier' ? [MapPin, t('address'), [openOrder.delivery_district, openOrder.delivery_address].filter(Boolean).join(', ') + (openOrder.landmark ? ` · ${openOrder.landmark}` : '')] : null,
            [Clock, t('delivery'), slotLabel(openOrder.delivery_time_slot, lang)],
            [CreditCard, t('payment'), paymentLabel],
          ].filter(Boolean).map(([Icon, label, value], i) => (
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

        {supportPhone && (
          <a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: '#0f172a' }}>
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Phone size={20} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{t('help')}</span>
              <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{t('help_call')} · {supportPhone}</span>
            </span>
            <ChevronRight size={20} color="#94a3b8" />
          </a>
        )}

        {bonuses.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{t('bonuses')}</div>
            {bonuses.map((b) => (
              <div key={`${b.store_id}-${b.kind}`} style={{ fontSize: 14, fontWeight: 700, color: '#047857', padding: '3px 0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{bonusLabel(b, lang)}</span>
                {b.amount > 0 && <span style={{ whiteSpace: 'nowrap' }}>−{Math.round(b.amount).toLocaleString()}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Last step of every route: the customer confirms they have the order */}
        {canConfirm && (
          <div style={{ ...card, textAlign: 'center' }}>
            <button type="button" onClick={confirmReceived} disabled={confirming} style={{ width: '100%', height: 54, borderRadius: 16, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 17, cursor: 'pointer', opacity: confirming ? 0.6 : 1 }}>
              {t('received')}
            </button>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>{t('received_hint')}</div>
          </div>
        )}

        {/* Real reviews: rate the order once the customer has it */}
        {openOrder.status === 'delivered' && !canConfirm && (
          <div style={{ ...card, textAlign: 'center' }}>
            {openOrder.review_rating ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={26} color="#f59e0b" fill={i <= openOrder.review_rating ? '#f59e0b' : 'none'} />)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#047857' }}>{t('rate_thanks')}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>{t('rate_title')}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{t('rate_hint')}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" onClick={() => { triggerHaptic('selection'); setStars(i); }} aria-label={`${i}`} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}>
                      <Star size={36} color="#f59e0b" fill={i <= stars ? '#f59e0b' : 'none'} />
                    </button>
                  ))}
                </div>
                {stars > 0 && (
                  <>
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder={t('rate_comment')} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 12, fontSize: 15, fontFamily: 'inherit', resize: 'none', marginBottom: 10 }} />
                    <button type="button" onClick={sendReview} disabled={sendingReview} style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: sendingReview ? 0.6 : 1 }}>
                      {t('rate_send')}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {actionError && (
          <div style={{ ...card, background: '#fef2f2', color: '#b91c1c', fontSize: 14, fontWeight: 600 }}>{actionError}</div>
        )}

        {/* Like delivery apps: cancel is possible only until someone starts collecting */}
        {['pending', 'accepted'].includes(openOrder.status) && !openOrder.porter_name && !items.some((i) => i.seller_handed) && (
          <button type="button" onClick={cancelOrder} disabled={cancelling} style={{ width: '100%', height: 48, borderRadius: 16, border: '1.5px solid #fecaca', background: '#ffffff', color: '#dc2626', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: cancelling ? 0.6 : 1 }}>
            {t('cancel')}
          </button>
        )}

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
