import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShoppingCart, Phone, MapPin, CheckCircle2, Circle, ChevronLeft, LogOut, RefreshCw, User, Store, AlertCircle } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { slotLabel } from '../services/slots';
import { api, staffSession } from '../services/api';
import StaffLogin from './StaffLogin';
import { formatUnit } from './ProductCard';
import { triggerHaptic } from '../services/telegram';
import { fulfillmentLabel, pointName, weightRange, weightOk } from '../services/offers';
import { newIdsWatcher } from '../services/sound';
import { stallLabel, itemName } from '../services/stall';
import { useLive } from '../services/live';

const T = {
  title: { uz: 'Aravachi kabineti', ru: 'Кабинет аравачи', en: 'Porter Dashboard' },
  pin_hint: { uz: 'Kirish uchun PIN-kodni kiriting', ru: 'Введите PIN-код для входа', en: 'Enter your PIN to continue' },
  pin_wrong: { uz: "Noto'g'ri PIN-kod", ru: 'Неверный PIN-код', en: 'Incorrect PIN code' },
  enter: { uz: 'Kirish', ru: 'Войти', en: 'Sign in' },
  back: { uz: 'Orqaga', ru: 'Назад', en: 'Back' },
  profile_hint: { uz: "Mijoz va sotuvchilar sizni shu ism bilan ko'radi", ru: 'Под этим именем вас увидят покупатель и продавцы', en: 'Customers and sellers will see this name' },
  your_name: { uz: 'Ismingiz', ru: 'Ваше имя', en: 'Your name' },
  your_phone: { uz: 'Telefon raqamingiz', ru: 'Ваш телефон', en: 'Your phone' },
  save: { uz: 'Davom etish', ru: 'Продолжить', en: 'Continue' },
  tab_new: { uz: 'Yangi buyurtmalar', ru: 'Новые заказы', en: 'New orders' },
  tab_mine: { uz: 'Mening buyurtmalarim', ru: 'Мои заказы', en: 'My orders' },
  empty_new: { uz: "Hozircha yangi buyurtma yo'q. Ro'yxat o'zi yangilanadi.", ru: 'Пока новых заказов нет. Список обновляется сам.', en: 'No new orders yet. The list refreshes itself.' },
  empty_mine: { uz: "Sizda faol buyurtma yo'q. «Yangi buyurtmalar»dan oling.", ru: 'У вас нет активных заказов. Возьмите заказ в «Новых заказах».', en: 'You have no active orders. Take one from “New orders”.' },
  stalls: { uz: 'rasta', ru: 'раст', en: 'stalls' },
  items: { uz: 'mahsulot', ru: 'товаров', en: 'items' },
  take: { uz: '🛒 Buyurtmani olaman', ru: '🛒 Беру заказ', en: '🛒 Take order' },
  open: { uz: 'Ochish', ru: 'Открыть', en: 'Open' },
  route: { uz: "Rastalar bo'yicha yo'nalish", ru: 'Маршрут по растам', en: 'Route through stalls' },
  seller: { uz: 'Sotuvchi', ru: 'Продавец', en: 'Seller' },
  call: { uz: "Qo'ng'iroq", ru: 'Позвонить', en: 'Call' },
  collected: { uz: 'Olindi', ru: 'Забрано', en: 'Collected' },
  customer: { uz: 'Mijoz', ru: 'Покупатель', en: 'Customer' },
  map: { uz: 'Xaritada ochish', ru: 'Открыть на карте', en: 'Open on map' },
  note: { uz: 'Izoh', ru: 'Комментарий', en: 'Note' },
  handed_over: { uz: "🚕 Yig'dim — taksi chaqirish", ru: '🚕 Собрал — вызвать такси', en: '🚕 Packed — call a taxi' },
  self_deliver: { uz: "🚶 O'zim olib boraman", ru: '🚶 Отнесу сам', en: '🚶 I will deliver' },
  delivered: { uz: '✅ Yetkazildi', ru: '✅ Доставлено', en: '✅ Delivered' },
  collect_first: { uz: "Avval hamma mahsulotlarni belgilang", ru: 'Сначала отметьте все товары', en: 'Tick all items first' },
  waiting_taxi: { uz: "🚕 Taksichi kelib olishini kuting — u xabar oldi", ru: '🚕 Ждите таксиста — он получил уведомление', en: '🚕 Wait for the taxi driver — they got a notification' },
  release: { uz: 'Buyurtmani qaytarish', ru: 'Вернуть заказ', en: 'Give order back' },
  release_confirm: { uz: 'Buyurtmani qaytarasizmi? Boshqa aravachi oladi.', ru: 'Вернуть заказ? Его возьмёт другой аравачи.', en: 'Give the order back? Another porter will take it.' },
  status_picking: { uz: '🛒 Yig\'ilmoqda', ru: '🛒 Собирается', en: '🛒 Collecting' },
  status_handed_over: { uz: '🤝 Taksichini kutmoqda', ru: '🤝 Ждёт таксиста', en: '🤝 Waiting for taxi' },
  status_at_point: { uz: '📍 Xaridorni kutmoqda', ru: '📍 Ждёт покупателя', en: '📍 Waiting for customer' },
  at_point: { uz: '📍 Joyga olib keldim', ru: '📍 Принёс на точку', en: '📍 At the pickup point' },
  gave_customer: { uz: '✅ Xaridorga berdim', ru: '✅ Отдал покупателю', en: '✅ Gave to customer' },
  waiting_customer: { uz: '🙋 Xaridor keladi — u xabar oldi', ru: '🙋 Покупатель подойдёт — он получил уведомление', en: '🙋 The customer is coming — they got a notification' },
  seller_gave: { uz: 'Sotuvchi berdi', ru: 'Продавец отдал', en: 'Seller handed' },
  seller_ready: { uz: 'Tayyor', ru: 'Готово', en: 'Packed' },
  gifts: { uz: "Sovg'alar — ham oling", ru: 'Подарки — заберите тоже', en: 'Gifts — collect them too' },
  meet_taxi: { uz: 'Taksiga berish joyi', ru: 'Где передать такси', en: 'Where to meet the taxi' },
  bring_to: { uz: 'Olib boriladigan joy', ru: 'Куда принести', en: 'Bring it to' },
  status_on_the_way: { uz: "🚶 Yo'lda", ru: '🚶 В пути', en: '🚶 On the way' },
  logout: { uz: 'Chiqish', ru: 'Выйти', en: 'Sign out' },
  min_ago: { uz: 'daq. oldin', ru: 'мин. назад', en: 'min ago' },
  cash: { uz: 'Naqd', ru: 'Наличные', en: 'Cash' },
  check_payment: { uz: "to'lovni tekshiring", ru: 'проверьте оплату', en: 'check payment' },
  weight: { uz: '⚖️ Vazn', ru: '⚖️ Вес', en: '⚖️ Weight' },
  missing: { uz: "❌ Yo'q", ru: '❌ Нет', en: '❌ Out' },
  missing_undo: { uz: '↩️ Bor ekan', ru: '↩️ Есть', en: '↩️ Found it' },
  missing_label: { uz: "Tugagan — buyurtmadan olib tashlandi", ru: 'Закончился — убран из заказа', en: 'Ran out — removed from the order' },
  weight_title: { uz: 'Tarozida qancha chiqdi?', ru: 'Сколько показали весы?', en: 'What does the scale show?' },
  weight_photo: { uz: '📷 Tarozi rasmi (ixtiyoriy)', ru: '📷 Фото весов (по желанию)', en: '📷 Photo of the scale (optional)' },
  weight_hint: { uz: "Ruxsat: {low}–{high} {unit} (±5%)", ru: 'Можно: {low}–{high} {unit} (±5%)', en: 'Allowed: {low}–{high} {unit} (±5%)' },
  weight_off: { uz: "±5% dan ko'p farq — kesib yoki qo'shib to'g'rilang", ru: 'Больше ±5% — отрежьте или довесьте', en: 'More than ±5% off — trim or add to fix it' },
  weight_pending: { uz: '⏳ Xaridor roziligi kutilmoqda', ru: '⏳ Ждём согласия покупателя', en: '⏳ Waiting for the customer' },
  weight_rejected: { uz: "Xaridor rozi bo'lmadi — buyurtma vazniga moslang", ru: 'Покупатель против — сделайте заказанный вес', en: 'Customer said no — make it the ordered weight' },
  save: { uz: 'Saqlash', ru: 'Сохранить', en: 'Save' },
  cancel: { uz: 'Bekor', ru: 'Отмена', en: 'Cancel' },
  code_label: { uz: 'Xaridordan 4 xonali kodni so\'rang', ru: 'Спросите у покупателя 4-значный код', en: "Ask the customer for the 4-digit code" },
  taxi_eta: { uz: 'Taksi ~{m} daqiqada keladi', ru: 'Такси будет через ~{m} мин', en: 'Taxi arrives in ~{m} min' },
  go_now: { uz: '🏃 Darvozaga chiqing!', ru: '🏃 Выходите к воротам!', en: '🏃 Head to the gate now!' },
  go_in: { uz: 'Darvozaga {m} daqiqadan keyin chiqing', ru: 'Выходите к воротам через {m} мин', en: 'Head to the gate in {m} min' },
  waiting_for: { uz: 'Kutilmoqda: {m} daq', ru: 'Ждёт: {m} мин', en: 'Waiting: {m} min' },
  cold: { uz: "🌡 Go'sht/sut uzoq kutmasin: o'zingiz olib boring yoki rastaga qaytaring", ru: '🌡 Мясо/молочка не должны ждать: отвезите сами или верните на расту', en: '🌡 Meat/dairy must not wait: deliver it yourself or take it back to the stall' },
  offline: { uz: "📶 Internet yo'q — oxirgi ro'yxat ko'rsatilmoqda. Belgilaringiz saqlanadi va internet kelganda yuboriladi.", ru: '📶 Нет интернета — показан последний список. Отметки сохранятся и уйдут, когда появится связь.', en: '📶 No internet — showing the last list. Your ticks are kept and sent when the connection is back.' },
  need_net: { uz: 'Buning uchun internet kerak', ru: 'Для этого нужен интернет', en: 'This needs internet' },
  batch_title: { uz: "🔗 Bitta yo'lda {n} ta buyurtma", ru: '🔗 {n} заказа за один проход', en: '🔗 {n} orders in one walk' },
  batch_take: { uz: '🛒 Hammasini olaman', ru: '🛒 Беру все', en: '🛒 Take them all' },
  batch_rows: { uz: 'Qatorlar', ru: 'Ряды', en: 'Rows' },
  combined: { uz: "🔗 Umumiy yo'nalish ({n} ta buyurtma)", ru: '🔗 Общий маршрут ({n} заказа)', en: '🔗 Combined route ({n} orders)' },
  combined_hint: { uz: "Har bir mahsulotni o'z paketiga soling: harf paketda yozilsin", ru: 'Кладите каждый товар в свой пакет: буква — на пакете', en: 'Put each item in its own bag: the letter goes on the bag' },
  bag: { uz: 'Paket', ru: 'Пакет', en: 'Bag' },
};

const BAG_LETTERS = 'ABCDEFGH';

const CACHE_KEY = 'porter_orders_cache';
const QUEUE_KEY = 'porter_offline_queue';
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
// fetch() itself failing (no connection) throws a TypeError; server answers carry a status
const isOffline = (err) => err instanceof TypeError || !navigator.onLine;

// Ticks made without internet are shown at once and sent later
function withQueued(data, queue) {
  if (!queue.length) return data;
  const map = new Map(queue.map((q) => [q.itemId, q.isPicked]));
  const fix = (o) => {
    const stops = o.stops.map((st) => ({ ...st, items: st.items.map((i) => (map.has(i.id) ? { ...i, is_picked: map.get(i.id) } : i)) }));
    return { ...o, stops, picked_count: stops.reduce((n, st) => n + st.items.filter((i) => i.is_picked).length, 0) };
  };
  return { available: data.available, mine: data.mine.map(fix) };
}

const minutesSince = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(`${iso}Z`).getTime()) / 60000)) : 0);
const minutesUntil = (iso) => (iso ? Math.ceil((new Date(`${iso}Z`).getTime() - Date.now()) / 60000) : null);

const card = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
  boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
};

const primaryBtn = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg, #059669, #047857)',
  color: '#ffffff',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer'
};

const secondaryBtn = {
  ...primaryBtn,
  background: '#f1f5f9',
  color: '#0f172a',
  border: '1.5px solid #e2e8f0'
};

const inputStyle = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: 12,
  border: '1.5px solid #cbd5e1',
  fontSize: 16,
  marginBottom: 12,
  boxSizing: 'border-box'
};

function formatQty(item, language) {
  const qty = Number(item.quantity);
  return `${Number.isInteger(qty) ? qty : qty.toFixed(1)} ${formatUnit(item.unit, language)}`;
}

export default function PorterPanel({ onBackToMarket }) {
  const { language } = useLanguage();
  const t = (key) => T[key]?.[language] || T[key]?.uz || key;

  // Personal account of this aravachi (phone + PIN, approved by the bozorkom)
  const [session, setSession] = useState(() => {
    const current = staffSession.get();
    return current?.staff?.role === 'porter' ? current : null;
  });
  const profile = session?.staff;
  const [orders, setOrders] = useState({ available: [], mine: [] });
  const [tab, setTab] = useState('new');
  const [openOrderId, setOpenOrderId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [points, setPoints] = useState([]);
  const [offline, setOffline] = useState(false);
  const [combined, setCombined] = useState(false);
  const watchNew = useRef(newIdsWatcher()).current;
  useEffect(() => { api.getConfig().then((cfg) => setPoints(cfg.handoff_points || [])).catch(() => {}); }, []);

  // Send ticks made under the dome without internet
  const flushQueue = async () => {
    let queue = readJson(QUEUE_KEY, []);
    while (queue.length) {
      const { itemId, isPicked } = queue[0];
      try {
        await api.porterPicked(itemId, isPicked);
      } catch (err) {
        if (isOffline(err)) return false;
      }
      queue = queue.slice(1);
      writeJson(QUEUE_KEY, queue);
    }
    return true;
  };

  const loadOrders = useCallback(async () => {
    if (!session) return;
    try {
      await flushQueue();
      const data = await api.porterOrders();
      const shown = withQueued(data, readJson(QUEUE_KEY, []));
      setOrders(shown);
      writeJson(CACHE_KEY, data);
      setOffline(false);
      setError('');
      watchNew(data.available.map((o) => o.id));
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        staffSession.set(null);
        setSession(null);
      } else if (isOffline(err)) {
        setOffline(true);
        const cached = readJson(CACHE_KEY, null);
        if (cached) setOrders(withQueued(cached, readJson(QUEUE_KEY, [])));
      } else {
        setError(err.message);
      }
    }
  }, [session]);

  // New orders arrive instantly over SSE; polling is the safety net when the stream is down
  const live = useLive(session ? ['porter'] : [], loadOrders);
  useEffect(() => {
    loadOrders();
    const timer = setInterval(loadOrders, live ? 30000 : 10000);
    return () => clearInterval(timer);
  }, [loadOrders, live]);

  const runAction = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await loadOrders();
    } catch (err) {
      triggerHaptic('error');
      setError(isOffline(err) ? t('need_net') : err.message);
      await loadOrders();
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return <StaffLogin role="porter" onBack={onBackToMarket} onSignedIn={() => setSession(staffSession.get())} />;
  }

  const openOrder = orders.mine.find((o) => o.id === openOrderId);
  // Each order being collected gets a bag letter, so a batch never gets mixed up
  const picking = orders.mine.filter((o) => o.status === 'picking').sort((a, b) => a.id - b.id);
  const bagOf = (id) => { const i = picking.findIndex((o) => o.id === id); return i >= 0 ? BAG_LETTERS[i] : null; };

  if (combined && picking.length > 1) {
    return (
      <CombinedRoute
        t={t}
        language={language}
        orders={picking}
        bagOf={bagOf}
        busy={busy}
        offline={offline}
        onBack={() => setCombined(false)}
        onOpen={(id) => { setCombined(false); setOpenOrderId(id); }}
        onTogglePicked={async (item) => {
          triggerHaptic(item.is_picked ? 'light' : 'success');
          try { await api.porterPicked(item.id, !item.is_picked); await loadOrders(); } catch (err) { setError(err.message); }
        }}
      />
    );
  }

  if (openOrder) {
    return (
      <OrderRoute
        t={t}
        language={language}
        points={points}
        order={openOrder}
        bag={bagOf(openOrder.id)}
        busy={busy}
        error={error}
        onBack={() => setOpenOrderId(null)}
        offline={offline}
        onTogglePicked={async (item) => {
          triggerHaptic(item.is_picked ? 'light' : 'success');
          try {
            await api.porterPicked(item.id, !item.is_picked);
            await loadOrders();
          } catch (err) {
            if (!isOffline(err)) { setError(err.message); return; }
            // No signal: keep the tick on the phone and send it later
            const queue = readJson(QUEUE_KEY, []).filter((q) => q.itemId !== item.id);
            writeJson(QUEUE_KEY, [...queue, { itemId: item.id, isPicked: !item.is_picked }]);
            setOffline(true);
            setOrders((prev) => withQueued(prev, readJson(QUEUE_KEY, [])));
          }
        }}
        onWeight={(item, qty, file) => runAction(async () => {
          const photo = file ? (await api.porterPhoto(file)).url : null;
          await api.porterWeight(item.id, qty, photo);
          triggerHaptic('success');
        })}
        onMissing={(item, missing) => runAction(async () => {
          await api.porterMissing(item.id, missing);
          triggerHaptic('warning');
        })}
        onSetStatus={(status, code) => runAction(async () => {
          triggerHaptic('success');
          await api.porterStatus(openOrder.id, status, code);
          if (status === 'delivered') setOpenOrderId(null);
        })}
        onRelease={() => {
          if (!window.confirm(t('release_confirm'))) return;
          runAction(async () => {
            await api.porterRelease(openOrder.id);
            setOpenOrderId(null);
            setTab('new');
          });
        }}
      />
    );
  }

  const list = tab === 'new' ? orders.available : orders.mine;

  return (
    <div className="animate-fade" style={{ paddingTop: 12, paddingBottom: 110 }}>
      {/* Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #064e3b, #059669)', color: '#ffffff', border: 'none' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShoppingCart size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t('title')}</div>
          <div style={{ fontSize: 13, color: '#a7f3d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.name} · {profile.phone}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { staffSession.set(null); setSession(null); }}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          <LogOut size={14} /> {t('logout')}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['new', t('tab_new'), orders.available.length], ['mine', t('tab_mine'), orders.mine.length]].map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => { triggerHaptic('selection'); setTab(key); }}
            style={{
              flex: 1,
              padding: '11px 8px',
              borderRadius: 12,
              border: tab === key ? '2px solid #059669' : '1.5px solid #e2e8f0',
              background: tab === key ? '#ecfdf5' : '#ffffff',
              color: tab === key ? '#047857' : '#334155',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            {label} {count > 0 && <span style={{ background: tab === key ? '#059669' : '#94a3b8', color: '#fff', borderRadius: 999, padding: '1px 7px', marginLeft: 4 }}>{count}</span>}
          </button>
        ))}
        <button type="button" onClick={() => { triggerHaptic('light'); loadOrders(); }} style={{ ...secondaryBtn, width: 46, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {error && <ErrorBox text={error} />}
      {offline && <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', fontSize: 13, fontWeight: 700 }}>{t('offline')}</div>}

      {tab === 'new' && (orders.batches || []).map((b) => (
        <div key={b.order_ids.join('-')} style={{ ...card, background: '#ecfdf5', borderColor: '#6ee7b7' }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{t('batch_title').replace('{n}', b.order_ids.length)}</div>
          <div style={{ fontSize: 13, color: '#065f46', marginBottom: 10 }}>
            {t('batch_rows')}: {b.rows.join(', ')} · {b.stalls} {t('stalls')} · {b.items_count} {t('items')}
            {b.handoff_point ? ` · 📍 ${pointName(points, b.handoff_point, language)}` : ''}
            <div style={{ marginTop: 2, fontWeight: 700 }}>{b.order_numbers.map((num) => `#${num}`).join(' · ')}</div>
          </div>
          <button type="button" disabled={busy} onClick={() => runAction(async () => {
            await api.porterTakeBatch(b.order_ids);
            triggerHaptic('success');
            setTab('mine');
            setCombined(true);
          })} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{t('batch_take')}</button>
        </div>
      ))}

      {tab === 'mine' && picking.length > 1 && (
        <button type="button" onClick={() => setCombined(true)} style={{ ...primaryBtn, marginBottom: 12, background: '#047857' }}>
          {t('combined').replace('{n}', picking.length)}
        </button>
      )}

      {list.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#64748b', padding: '28px 16px', fontSize: 14 }}>
          {tab === 'new' ? t('empty_new') : t('empty_mine')}
        </div>
      )}

      {list.map((order) => {
        const minutes = order.created_at ? Math.max(0, Math.round((Date.now() - new Date(order.created_at + 'Z').getTime()) / 60000)) : null;
        return (
          <div key={order.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{tab === 'mine' && bagOf(order.id) ? `📦 ${bagOf(order.id)} · ` : ''}#{order.order_number}</span>
              <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                {tab === 'mine' ? t(`status_${order.status}`) : (minutes !== null && `${minutes} ${t('min_ago')}`)}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {order.stops.map((stop) => (
                <span key={stop.store_id} style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>
                  {stallLabel(stop.stall_number, language)}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
              {order.stops.length} {t('stalls')} · {order.items_count} {t('items')}
              {tab === 'mine' && ` · ${t('collected')} ${order.picked_count}/${order.items_count}`}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 12, display: 'flex', gap: 4 }}>
              <MapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {fulfillmentLabel(order.fulfillment, language)}
                {order.handoff_point ? ` · ${pointName(points, order.handoff_point, language)}` : ''}
                {order.fulfillment === 'courier' ? ` → ${order.delivery_district}, ${order.delivery_address}` : ''}
                {order.gifts?.length > 0 ? ` · 🎁 ${order.gifts.length}` : ''}
              </span>
            </div>
            {tab === 'new' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(async () => {
                  await api.porterTake(order.id);
                  triggerHaptic('success');
                  setTab('mine');
                  setOpenOrderId(order.id);
                })}
                style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}
              >
                {t('take')}
              </button>
            ) : (
              <button type="button" onClick={() => setOpenOrderId(order.id)} style={primaryBtn}>
                {t('open')} →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ErrorBox({ text }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
      <AlertCircle size={16} style={{ flexShrink: 0 }} /> {text}
    </div>
  );
}

// All stalls of a batch in one walk; every item shows which bag (order) it goes into
function CombinedRoute({ t, language, orders, bagOf, busy, offline, onBack, onOpen, onTogglePicked }) {
  const stops = new Map();
  orders.forEach((o) => o.stops.forEach((st) => {
    const stop = stops.get(st.store_id) || { ...st, items: [] };
    st.items.forEach((item) => stop.items.push({ ...item, bag: bagOf(o.id), order_number: o.order_number }));
    stops.set(st.store_id, stop);
  }));
  const route = [...stops.values()].sort((a, b) => (parseInt((a.stall_number.match(/\d+/) || [9999])[0], 10) - parseInt((b.stall_number.match(/\d+/) || [9999])[0], 10)));
  const total = route.reduce((n, st) => n + st.items.length, 0);
  const done = route.reduce((n, st) => n + st.items.filter((i) => i.is_picked).length, 0);
  return (
    <div className="animate-fade" style={{ paddingTop: 12, paddingBottom: 110 }}>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, color: '#047857', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: '4px 0', marginBottom: 8 }}>
        <ChevronLeft size={18} /> {t('back')}
      </button>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{t('combined').replace('{n}', orders.length)}</div>
        <div style={{ height: 10, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${total ? Math.round((done / total) * 100) : 0}%`, height: '100%', background: '#10b981' }} />
        </div>
        <div style={{ fontSize: 13, color: '#475569' }}>{t('collected')}: {done} / {total} · {t('combined_hint')}</div>
      </div>
      {offline && <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', fontSize: 13, fontWeight: 700 }}>{t('offline')}</div>}
      {route.map((stop, index) => (
        <div key={stop.store_id} style={card}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#92400e' }}>{index + 1}. {stallLabel(stop.stall_number, language)}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{stop[`store_name_${language}`] || stop.store_name_uz}</div>
          {stop.items.map((item) => (
            <button key={item.id} type="button" disabled={busy || item.item_status === 'missing'} onClick={() => onTogglePicked(item)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px', marginTop: 6, borderRadius: 12, border: '1.5px solid ' + (item.is_picked ? '#86efac' : '#e2e8f0'), background: item.is_picked ? '#dcfce7' : '#f8fafc', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: '#0f172a', color: '#ffffff', fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.bag}</span>
              {item.is_picked ? <CheckCircle2 size={22} color="#16a34a" style={{ flexShrink: 0 }} /> : <Circle size={22} color="#94a3b8" style={{ flexShrink: 0 }} />}
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, textDecoration: item.is_picked || item.item_status === 'missing' ? 'line-through' : 'none' }}>{itemName(item, language)}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#047857', whiteSpace: 'nowrap' }}>{formatQty(item, language)}</span>
            </button>
          ))}
        </div>
      ))}
      {orders.map((o) => (
        <button key={o.id} type="button" onClick={() => onOpen(o.id)} style={{ ...secondaryBtn, width: '100%', marginBottom: 8, textAlign: 'left' }}>
          📦 {t('bag')} {bagOf(o.id)} · #{o.order_number} · {o.picked_count}/{o.items_count} → {t('open')}
        </button>
      ))}
    </div>
  );
}

function OrderRoute({ t, language, points, order, bag, busy, error, offline, onBack, onTogglePicked, onWeight, onMissing, onSetStatus, onRelease }) {
  const [editing, setEditing] = useState(null); // item whose weight is being typed
  const [weightValue, setWeightValue] = useState('');
  const [weightFile, setWeightFile] = useState(null);
  const [code, setCode] = useState('');
  const [, setTick] = useState(0);
  // Re-draw the gate timers every 15 seconds
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 15000); return () => clearInterval(id); }, []);
  const fill = (text, m) => text.replace('{m}', m);
  const codeBox = (label, status) => (
    <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 8 }}>🔑 {t('code_label')}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="••••" style={{ width: 110, height: 52, borderRadius: 12, border: '2px solid #86efac', fontSize: 26, fontWeight: 800, letterSpacing: 6, textAlign: 'center' }} />
        <button type="button" disabled={busy || (order.needs_code && code.length !== 4)} onClick={() => onSetStatus(status, code)} style={{ ...primaryBtn, flex: 1, opacity: busy || (order.needs_code && code.length !== 4) ? 0.5 : 1 }}>{label}</button>
      </div>
    </div>
  );
  const allPicked = order.items_count > 0 && order.picked_count === order.items_count;
  const isPoint = order.fulfillment === 'point';
  const point = pointName(points, order.handoff_point, language);
  const progress = order.items_count ? Math.round((order.picked_count / order.items_count) * 100) : 0;
  // Exact point when the customer picked it on the map, otherwise search by the address text
  const mapUrl = order.delivery_lat != null && order.delivery_lng != null
    ? `https://yandex.uz/maps/?pt=${order.delivery_lng},${order.delivery_lat}&z=17&l=map`
    : `https://yandex.uz/maps/?text=${encodeURIComponent(`Toshkent, ${order.delivery_district}, ${order.delivery_address}`)}`;

  return (
    <div className="animate-fade" style={{ paddingTop: 12, paddingBottom: 110 }}>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, color: '#047857', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: '4px 0', marginBottom: 8 }}>
        <ChevronLeft size={18} /> {t('back')}
      </button>

      <div style={{ ...card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 18 }}>{bag ? `📦 ${bag} · ` : ''}#{order.order_number}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#047857' }}>{t(`status_${order.status}`)}</span>
        </div>
        <div style={{ height: 10, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#10b981', transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: 13, color: '#475569' }}>{t('collected')}: {order.picked_count} / {order.items_count}</div>
      </div>

      {error && <ErrorBox text={error} />}
      {offline && <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', fontSize: 13, fontWeight: 700 }}>{t('offline')}</div>}

      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '16px 2px 10px' }}>{t('route')}</h3>

      {order.stops.map((stop, index) => {
        const stopDone = stop.items.every((i) => i.is_picked);
        return (
          <div key={stop.store_id} style={{ ...card, borderColor: stopDone ? '#86efac' : '#e2e8f0', background: stopDone ? '#f0fdf4' : '#ffffff' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: stopDone ? '#10b981' : '#f59e0b', color: '#ffffff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {stopDone ? '✓' : index + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#92400e' }}>{stallLabel(stop.stall_number, language)}</div>
                <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Store size={14} style={{ flexShrink: 0 }} /> {stop[`store_name_${language}`] || stop.store_name_uz}
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{t('seller')}: {stop.owner_name}</div>
                {/* Seller's own confirmation, next to the aravachi's ticks */}
                {stop.items.every((i) => i.seller_handed)
                  ? <div style={{ fontSize: 12, fontWeight: 800, color: '#047857' }}>🤝 {t('seller_gave')}</div>
                  : stop.items.every((i) => i.seller_ready) && <div style={{ fontSize: 12, fontWeight: 800, color: '#0369a1' }}>📦 {t('seller_ready')}</div>}
              </div>
              {stop.owner_phone && (
                <a href={`tel:${stop.owner_phone.replace(/[^\d+]/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#047857', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                  <Phone size={14} /> {t('call')}
                </a>
              )}
            </div>
            {stop.items.map((item) => {
              const missing = item.item_status === 'missing';
              const canEdit = order.status === 'picking' && !busy;
              const isGift = item.price === 0;
              return (
                <div key={item.id} style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    disabled={busy || order.status !== 'picking' || missing}
                    onClick={() => onTogglePicked(item)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px', borderRadius: 12,
                      border: '1.5px solid ' + (missing ? '#fecaca' : (item.is_picked ? '#86efac' : '#e2e8f0')),
                      background: missing ? '#fef2f2' : (item.is_picked ? '#dcfce7' : '#f8fafc'),
                      cursor: order.status === 'picking' && !missing ? 'pointer' : 'default', textAlign: 'left'
                    }}
                  >
                    {missing ? <span style={{ fontSize: 20, flexShrink: 0 }}>❌</span> : (item.is_picked ? <CheckCircle2 size={24} color="#16a34a" style={{ flexShrink: 0 }} /> : <Circle size={24} color="#94a3b8" style={{ flexShrink: 0 }} />)}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: missing ? '#b91c1c' : '#0f172a', textDecoration: item.is_picked || missing ? 'line-through' : 'none' }}>{itemName(item, language)}</span>
                      {missing && <span style={{ display: 'block', fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>{t('missing_label')}</span>}
                      {!missing && item.actual_quantity != null && (
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: item.weight_status === 'pending' ? '#b45309' : (item.weight_status === 'rejected' ? '#b91c1c' : '#047857') }}>
                          ⚖️ {item.actual_quantity} {formatUnit(item.unit, language)} · {Math.round(item.price * item.actual_quantity).toLocaleString()}
                          {item.weight_status === 'pending' && ` · ${t('weight_pending')}`}
                          {item.weight_status === 'rejected' && ` · ${t('weight_rejected')}`}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#047857', whiteSpace: 'nowrap' }}>{formatQty(item, language)}</span>
                  </button>
                  {order.status === 'picking' && !isGift && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {!missing && (
                        <button type="button" disabled={!canEdit} onClick={() => { setEditing(item.id); setWeightValue(String(item.actual_quantity ?? item.quantity)); setWeightFile(null); }} style={{ ...secondaryBtn, flex: 1, padding: '8px 6px', fontSize: 13 }}>{t('weight')}</button>
                      )}
                      <button type="button" disabled={!canEdit} onClick={() => onMissing(item, !missing)} style={{ ...secondaryBtn, flex: 1, padding: '8px 6px', fontSize: 13, color: missing ? '#047857' : '#b91c1c' }}>{missing ? t('missing_undo') : t('missing')}</button>
                    </div>
                  )}
                  {editing === item.id && (
                    <div style={{ marginTop: 6, padding: 12, borderRadius: 12, border: '1.5px solid #93c5fd', background: '#eff6ff' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{t('weight_title')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <input value={weightValue} onChange={(e) => setWeightValue(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))} inputMode="decimal" autoFocus style={{ width: 110, height: 48, borderRadius: 12, border: '2px solid #93c5fd', fontSize: 22, fontWeight: 800, textAlign: 'center' }} />
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{formatUnit(item.unit, language)}</span>
                        {Number(weightValue) > 0 && <span style={{ marginLeft: 'auto', fontWeight: 800, color: '#047857' }}>{Math.round(item.price * Number(weightValue)).toLocaleString()}</span>}
                      </div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>
                        {t('weight_photo')}{weightFile ? ' ✓' : ''}
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => setWeightFile(e.target.files?.[0] || null)} style={{ display: 'block', marginTop: 4, fontSize: 12 }} />
                      </label>
                      <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>{t('weight_hint').replace('{low}', weightRange(item.quantity)[0]).replace('{high}', weightRange(item.quantity)[1]).replace('{unit}', formatUnit(item.unit, language))}</div>
                      {Number(weightValue) > 0 && !weightOk(item.quantity, weightValue) && <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>⚠️ {t('weight_off')}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => setEditing(null)} style={{ ...secondaryBtn, flex: 1 }}>{t('cancel')}</button>
                        <button type="button" disabled={busy || !weightOk(item.quantity, weightValue)} onClick={() => { onWeight(item, Number(weightValue), weightFile); setEditing(null); }} style={{ ...primaryBtn, flex: 2, opacity: busy || !weightOk(item.quantity, weightValue) ? 0.5 : 1 }}>{t('save')}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {order.gifts?.length > 0 && (
        <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#047857', marginBottom: 4 }}>🎁 {t('gifts')}</div>
          {order.gifts.map((g) => <div key={`${g.stall_number}-${g.text}`} style={{ fontSize: 14, fontWeight: 700 }}>{stallLabel(g.stall_number, language)}: {g[`text_${language}`] || g.text}</div>)}
        </div>
      )}

      {point && (
        <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700 }}>{isPoint ? t('bring_to') : t('meet_taxi')}</div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>📍 {point}</div>
        </div>
      )}

      {/* Customer */}
      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '16px 2px 10px' }}>{t('customer')}</h3>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{order.customer_name}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{order.customer_phone}</div>
          </div>
          <a href={`tel:${order.customer_phone.replace(/[^\d+]/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#047857', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            <Phone size={14} /> {t('call')}
          </a>
        </div>
        {!isPoint && <div style={{ fontSize: 14, color: '#334155', marginBottom: 4 }}>{order.delivery_district}, {order.delivery_address}</div>}
        {order.landmark && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>📍 {order.landmark}</div>}
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>⏱ {slotLabel(order.delivery_time_slot, language)}</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
          {Math.round(order.total_amount).toLocaleString()} UZS · {order.payment_method === 'cash' ? t('cash') : `${order.payment_method === 'payme' ? 'Payme' : 'Click'} (${t('check_payment')})`}
        </div>
        {order.notes && <div style={{ fontSize: 13, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>💬 {t('note')}: {order.notes}</div>}
        {!isPoint && (
          <a href={mapUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#0284c7', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <MapPin size={14} /> {t('map')}
          </a>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {order.status === 'picking' && (
          <>
            {!allPicked && <div style={{ fontSize: 13, color: '#b45309', textAlign: 'center', fontWeight: 600 }}>{t('collect_first')}</div>}
            {isPoint ? (
              <button type="button" disabled={!allPicked || busy} onClick={() => onSetStatus('at_point')} style={{ ...primaryBtn, opacity: !allPicked || busy ? 0.5 : 1 }}>{t('at_point')}</button>
            ) : (
              <>
                <button type="button" disabled={!allPicked || busy} onClick={() => onSetStatus('handed_over')} style={{ ...primaryBtn, opacity: !allPicked || busy ? 0.5 : 1 }}>{t('handed_over')}</button>
                <button type="button" disabled={!allPicked || busy} onClick={() => onSetStatus('on_the_way')} style={{ ...secondaryBtn, opacity: !allPicked || busy ? 0.5 : 1 }}>{t('self_deliver')}</button>
              </>
            )}
            <button type="button" disabled={busy} onClick={onRelease} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 8 }}>{t('release')}</button>
          </>
        )}
        {order.status === 'handed_over' && (() => {
          const waited = minutesSince(order.handed_over_at);
          const eta = minutesUntil(order.taxi_eta_at);
          const cold = waited >= 15;
          return (
            <div style={{ fontSize: 14, color: cold ? '#b91c1c' : '#1d4ed8', background: cold ? '#fef2f2' : '#eff6ff', borderRadius: 12, padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
              {order.taxi_name ? (
                <>
                  🚕 {order.taxi_name}
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{eta !== null && eta > 2 ? fill(t('go_in'), eta - 2) : t('go_now')}</div>
                  {eta !== null && eta > 0 && <div style={{ fontSize: 13 }}>{fill(t('taxi_eta'), eta)}</div>}
                </>
              ) : t('waiting_taxi')}
              {order.handed_over_at && <div style={{ fontSize: 13, marginTop: 4 }}>{fill(t('waiting_for'), waited)}</div>}
              {cold && <div style={{ fontSize: 13, marginTop: 6 }}>{t('cold')}</div>}
            </div>
          );
        })()}
        {order.status === 'handed_over' && (
          <>
            <button type="button" disabled={busy} onClick={() => onSetStatus('on_the_way')} style={{ ...secondaryBtn, opacity: busy ? 0.6 : 1 }}>{t('self_deliver')}</button>
          </>
        )}
        {order.status === 'at_point' && (
          <>
            <div style={{ fontSize: 14, color: '#1d4ed8', background: '#eff6ff', borderRadius: 12, padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
              {t('waiting_customer')}
            </div>
            {codeBox(t('gave_customer'), 'delivered')}
          </>
        )}
        {order.status === 'on_the_way' && codeBox(t('delivered'), 'delivered')}
      </div>
    </div>
  );
}
