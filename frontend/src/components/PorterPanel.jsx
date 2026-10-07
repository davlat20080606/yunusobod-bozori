import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Phone, MapPin, CheckCircle2, Circle, ChevronLeft, LogOut, RefreshCw, User, Store, AlertCircle } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';

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
  handed_over: { uz: '🤝 Kuryerga topshirdim', ru: '🤝 Передал курьеру', en: '🤝 Handed to courier' },
  self_deliver: { uz: "🚶 O'zim olib boraman", ru: '🚶 Отнесу сам', en: '🚶 I will deliver' },
  delivered: { uz: '✅ Yetkazildi', ru: '✅ Доставлено', en: '✅ Delivered' },
  collect_first: { uz: "Avval hamma mahsulotlarni belgilang", ru: 'Сначала отметьте все товары', en: 'Tick all items first' },
  release: { uz: 'Buyurtmani qaytarish', ru: 'Вернуть заказ', en: 'Give order back' },
  release_confirm: { uz: 'Buyurtmani qaytarasizmi? Boshqa aravachi oladi.', ru: 'Вернуть заказ? Его возьмёт другой аравачи.', en: 'Give the order back? Another porter will take it.' },
  status_picking: { uz: '🛒 Yig\'ilmoqda', ru: '🛒 Собирается', en: '🛒 Collecting' },
  status_handed_over: { uz: '🤝 Kuryerga topshirildi', ru: '🤝 Передан курьеру', en: '🤝 With courier' },
  status_on_the_way: { uz: "🚶 Yo'lda", ru: '🚶 В пути', en: '🚶 On the way' },
  logout: { uz: 'Chiqish', ru: 'Выйти', en: 'Sign out' },
  min_ago: { uz: 'daq. oldin', ru: 'мин. назад', en: 'min ago' },
  cash: { uz: 'Naqd', ru: 'Наличные', en: 'Cash' },
  check_payment: { uz: "to'lovni tekshiring", ru: 'проверьте оплату', en: 'check payment' },
};

const PIN_KEY = 'porter_pin';
const PROFILE_KEY = 'porter_profile';

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

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

function formatQty(item) {
  const qty = Number(item.quantity);
  return `${Number.isInteger(qty) ? qty : qty.toFixed(1)} ${item.unit}`;
}

export default function PorterPanel({ onBackToMarket }) {
  const { language } = useLanguage();
  const t = (key) => T[key]?.[language] || T[key]?.uz || key;

  const [pin, setPin] = useState(() => readStorage(PIN_KEY, ''));
  const [profile, setProfile] = useState(() => readStorage(PROFILE_KEY, null));
  const [orders, setOrders] = useState({ available: [], mine: [] });
  const [tab, setTab] = useState('new');
  const [openOrderId, setOpenOrderId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!pin || !profile) return;
    try {
      const data = await api.porterGetOrders(pin, profile.phone);
      setOrders(data);
      setError('');
    } catch (err) {
      if (err.status === 401) {
        setPin('');
        writeStorage(PIN_KEY, null);
      } else {
        setError(err.message);
      }
    }
  }, [pin, profile]);

  // Refresh every 10 seconds so new orders appear without touching the screen
  useEffect(() => {
    loadOrders();
    const timer = setInterval(loadOrders, 10000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  const runAction = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await loadOrders();
    } catch (err) {
      triggerHaptic('error');
      setError(err.message);
      await loadOrders();
    } finally {
      setBusy(false);
    }
  };

  if (!pin) {
    return <PinStep t={t} onBack={onBackToMarket} onSuccess={(p) => { setPin(p); writeStorage(PIN_KEY, p); }} />;
  }

  if (!profile) {
    return <ProfileStep t={t} onSave={(p) => { setProfile(p); writeStorage(PROFILE_KEY, p); }} />;
  }

  const openOrder = orders.mine.find((o) => o.id === openOrderId);

  if (openOrder) {
    return (
      <OrderRoute
        t={t}
        language={language}
        order={openOrder}
        busy={busy}
        error={error}
        onBack={() => setOpenOrderId(null)}
        onTogglePicked={(item) => runAction(async () => {
          triggerHaptic(item.is_picked ? 'light' : 'success');
          await api.porterSetPicked(pin, profile.phone, item.id, !item.is_picked);
        })}
        onSetStatus={(status) => runAction(async () => {
          triggerHaptic('success');
          await api.porterSetStatus(pin, profile.phone, openOrder.id, status);
          if (status === 'delivered') setOpenOrderId(null);
        })}
        onRelease={() => {
          if (!window.confirm(t('release_confirm'))) return;
          runAction(async () => {
            await api.porterRelease(pin, profile.phone, openOrder.id);
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
          onClick={() => { setProfile(null); writeStorage(PROFILE_KEY, null); setPin(''); writeStorage(PIN_KEY, null); }}
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
              <span style={{ fontWeight: 800, fontSize: 16 }}>#{order.order_number}</span>
              <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                {tab === 'mine' ? t(`status_${order.status}`) : (minutes !== null && `${minutes} ${t('min_ago')}`)}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {order.stops.map((stop) => (
                <span key={stop.store_id} style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>
                  {stop.stall_number}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
              {order.stops.length} {t('stalls')} · {order.items_count} {t('items')}
              {tab === 'mine' && ` · ${t('collected')} ${order.picked_count}/${order.items_count}`}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 12, display: 'flex', gap: 4 }}>
              <MapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{order.delivery_district}, {order.delivery_address}</span>
            </div>
            {tab === 'new' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(async () => {
                  await api.porterTakeOrder(pin, profile.name, profile.phone, order.id);
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

function PinStep({ t, onBack, onSuccess }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.porterLogin(value);
      triggerHaptic('success');
      onSuccess(value);
    } catch {
      triggerHaptic('error');
      setError(true);
      setValue('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="animate-fade" style={{ maxWidth: 360, margin: '40px auto', padding: '0 4px 110px', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <ShoppingCart size={34} color="#ffffff" />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t('title')}</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>{t('pin_hint')}</p>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={value}
        onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setError(false); }}
        maxLength={8}
        style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: 8, borderColor: error ? '#ef4444' : '#cbd5e1' }}
      />
      {error && <ErrorBox text={t('pin_wrong')} />}
      <button type="submit" disabled={!value || busy} style={{ ...primaryBtn, opacity: !value || busy ? 0.6 : 1, marginBottom: 10 }}>{t('enter')}</button>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 15, cursor: 'pointer', padding: 10 }}>{t('back')}</button>
    </form>
  );
}

function ProfileStep({ t, onSave }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const valid = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 9;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) onSave({ name: name.trim(), phone: phone.replace(/\s+/g, ' ').trim() }); }}
      className="animate-fade"
      style={{ maxWidth: 360, margin: '40px auto', padding: '0 4px 110px' }}
    >
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <User size={30} color="#059669" />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, textAlign: 'center' }}>{t('title')}</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20, textAlign: 'center' }}>{t('profile_hint')}</p>
      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{t('your_name')}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} autoFocus style={{ ...inputStyle, marginTop: 6 }} placeholder="Rustam" />
      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{t('your_phone')}</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" style={{ ...inputStyle, marginTop: 6 }} />
      <button type="submit" disabled={!valid} style={{ ...primaryBtn, opacity: valid ? 1 : 0.6 }}>{t('save')}</button>
    </form>
  );
}

function OrderRoute({ t, language, order, busy, error, onBack, onTogglePicked, onSetStatus, onRelease }) {
  const allPicked = order.items_count > 0 && order.picked_count === order.items_count;
  const progress = order.items_count ? Math.round((order.picked_count / order.items_count) * 100) : 0;
  const mapUrl = `https://yandex.uz/maps/?text=${encodeURIComponent(`Toshkent, ${order.delivery_district}, ${order.delivery_address}`)}`;

  return (
    <div className="animate-fade" style={{ paddingTop: 12, paddingBottom: 110 }}>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, color: '#047857', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: '4px 0', marginBottom: 8 }}>
        <ChevronLeft size={18} /> {t('back')}
      </button>

      <div style={{ ...card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 18 }}>#{order.order_number}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#047857' }}>{t(`status_${order.status}`)}</span>
        </div>
        <div style={{ height: 10, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#10b981', transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: 13, color: '#475569' }}>{t('collected')}: {order.picked_count} / {order.items_count}</div>
      </div>

      {error && <ErrorBox text={error} />}

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
                <div style={{ fontSize: 16, fontWeight: 800, color: '#92400e' }}>{stop.stall_number}</div>
                <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Store size={14} style={{ flexShrink: 0 }} /> {language === 'ru' ? stop.store_name_ru : stop.store_name_uz}
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{t('seller')}: {stop.owner_name}</div>
              </div>
              {stop.owner_phone && (
                <a href={`tel:${stop.owner_phone.replace(/[^\d+]/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#047857', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                  <Phone size={14} /> {t('call')}
                </a>
              )}
            </div>
            {stop.items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={busy || order.status !== 'picking'}
                onClick={() => onTogglePicked(item)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 10px',
                  marginTop: 6,
                  borderRadius: 12,
                  border: '1.5px solid ' + (item.is_picked ? '#86efac' : '#e2e8f0'),
                  background: item.is_picked ? '#dcfce7' : '#f8fafc',
                  cursor: order.status === 'picking' ? 'pointer' : 'default',
                  textAlign: 'left'
                }}
              >
                {item.is_picked ? <CheckCircle2 size={24} color="#16a34a" style={{ flexShrink: 0 }} /> : <Circle size={24} color="#94a3b8" style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#0f172a', textDecoration: item.is_picked ? 'line-through' : 'none' }}>{item.product_name}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#047857', whiteSpace: 'nowrap' }}>{formatQty(item)}</span>
              </button>
            ))}
          </div>
        );
      })}

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
        <div style={{ fontSize: 14, color: '#334155', marginBottom: 4 }}>{order.delivery_district}, {order.delivery_address}</div>
        {order.landmark && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>📍 {order.landmark}</div>}
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>⏱ {order.delivery_time_slot}</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
          {Math.round(order.total_amount).toLocaleString()} UZS · {order.payment_method === 'cash' ? t('cash') : `${order.payment_method === 'payme' ? 'Payme' : 'Click'} (${t('check_payment')})`}
        </div>
        {order.notes && <div style={{ fontSize: 13, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>💬 {t('note')}: {order.notes}</div>}
        <a href={mapUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#0284c7', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          <MapPin size={14} /> {t('map')}
        </a>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {order.status === 'picking' && (
          <>
            {!allPicked && <div style={{ fontSize: 13, color: '#b45309', textAlign: 'center', fontWeight: 600 }}>{t('collect_first')}</div>}
            <button type="button" disabled={!allPicked || busy} onClick={() => onSetStatus('handed_over')} style={{ ...primaryBtn, opacity: !allPicked || busy ? 0.5 : 1 }}>{t('handed_over')}</button>
            <button type="button" disabled={!allPicked || busy} onClick={() => onSetStatus('on_the_way')} style={{ ...secondaryBtn, opacity: !allPicked || busy ? 0.5 : 1 }}>{t('self_deliver')}</button>
            <button type="button" disabled={busy} onClick={onRelease} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 8 }}>{t('release')}</button>
          </>
        )}
        {(order.status === 'on_the_way' || order.status === 'handed_over') && (
          <button type="button" disabled={busy} onClick={() => onSetStatus('delivered')} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{t('delivered')}</button>
        )}
      </div>
    </div>
  );
}
