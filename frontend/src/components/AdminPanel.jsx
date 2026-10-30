import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, LogOut, AlertCircle, CheckCircle2, RefreshCw, Phone } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api, adminSession } from '../services/api';
import { triggerHaptic } from '../services/telegram';
import { ROLE_INFO } from './StaffLogin';
import { stallLabel, itemName } from '../services/stall';
import { useLive } from '../services/live';

const T = {
  title: { uz: 'Bozorkom kabineti', ru: 'Кабинет базаркома', en: 'Bazaar administration' },
  pin_hint: { uz: "Ma'muriyat PIN-kodini kiriting", ru: 'Введите PIN администрации', en: 'Enter the administration PIN' },
  enter: { uz: 'Kirish', ru: 'Войти', en: 'Sign in' },
  back: { uz: 'Orqaga', ru: 'Назад', en: 'Back' },
  logout: { uz: 'Chiqish', ru: 'Выйти', en: 'Sign out' },
  tabs: {
    uz: ['Umumiy', 'Arizalar', 'Rastalar', 'Xodimlar', 'Buyurtmalar', 'Patta', 'Sozlamalar', 'Xaridorlar'],
    ru: ['Обзор', 'Заявки', 'Расты', 'Работники', 'Заказы', 'Патта', 'Настройки', 'Покупатели'],
    en: ['Overview', 'Requests', 'Stalls', 'Workers', 'Orders', 'Stall fees', 'Settings', 'Customers'],
  },
  pending: { uz: 'Yangi arizalar', ru: 'Новые заявки', en: 'New requests' },
  stalls: { uz: 'Faol rastalar', ru: 'Активные расты', en: 'Active stalls' },
  orders24: { uz: 'Buyurtmalar (24 soat)', ru: 'Заказы (24 часа)', en: 'Orders (24h)' },
  revenue: { uz: 'Savdo (24 soat)', ru: 'Продажи (24 часа)', en: 'Sales (24h)' },
  patta_today: { uz: 'Bugungi patta', ru: 'Патта сегодня', en: 'Stall fees today' },
  radius: { uz: 'Yetkazish radiusi', ru: 'Радиус доставки', en: 'Delivery radius' },
  approve: { uz: 'Tasdiqlash', ru: 'Одобрить', en: 'Approve' },
  reject: { uz: 'Rad etish', ru: 'Отклонить', en: 'Reject' },
  block: { uz: 'Bloklash', ru: 'Заблокировать', en: 'Block' },
  unblock: { uz: 'Faollashtirish', ru: 'Разблокировать', en: 'Activate' },
  new_pin: { uz: 'Yangi PIN', ru: 'Новый PIN', en: 'New PIN' },
  pin_prompt: { uz: 'Yangi PIN-kod (4–6 raqam):', ru: 'Новый PIN-код (4–6 цифр):', en: 'New PIN (4–6 digits):' },
  pin_done: { uz: "PIN o'zgartirildi", ru: 'PIN изменён', en: 'PIN changed' },
  no_requests: { uz: "Yangi ariza yo'q", ru: 'Новых заявок нет', en: 'No new requests' },
  cancel: { uz: 'Bekor qilish', ru: 'Отменить', en: 'Cancel' },
  cancel_confirm: { uz: 'Buyurtmani bekor qilasizmi?', ru: 'Отменить заказ?', en: 'Cancel this order?' },
  save: { uz: 'Saqlash', ru: 'Сохранить', en: 'Save' },
  saved: { uz: 'Saqlandi', ru: 'Сохранено', en: 'Saved' },
  km: { uz: 'km (bozordan)', ru: 'км (от базара)', en: 'km (from the bazaar)' },
  patta_amount: { uz: 'Kunlik patta summasi', ru: 'Ежедневная сумма патты', en: 'Daily stall fee' },
  support_phone: { uz: 'Yordam telefoni (xaridorlar uchun)', ru: 'Телефон поддержки (для покупателей)', en: 'Help phone (for customers)' },
  porter_fee: { uz: "Aravachi narxi (so'm)", ru: 'Цена аравачи (сум)', en: 'Porter fee (UZS)' },
  taxi_fee: { uz: "Taksi narxi (so'm)", ru: 'Цена такси (сум)', en: 'Taxi fee (UZS)' },
  limits: { uz: 'Soxta buyurtmalardan himoya', ru: 'Защита от фейковых заказов', en: 'Fake-order protection' },
  new_customer_max_total: { uz: "Birinchi buyurtma, so'mgacha", ru: 'Первый заказ, до (сум)', en: 'First order, up to (UZS)' },
  new_customer_max_open: { uz: 'Yangi xaridor: ochiq buyurtma', ru: 'Новый покупатель: открытых заказов', en: 'New customer: open orders' },
  max_open_orders: { uz: 'Har kim: ochiq buyurtma', ru: 'Любой покупатель: открытых заказов', en: 'Any customer: open orders' },
  orders_per_10_min: { uz: 'Urinishlar, 10 daqiqada', ru: 'Попыток за 10 минут', en: 'Tries per 10 minutes' },
  limits_hint: { uz: "Yangi xaridor — hali birorta buyurtmani olmagan odam.", ru: 'Новый покупатель — тот, кто ещё не получил ни одного заказа.', en: 'A new customer is one who has not received an order yet.' },
  search: { uz: 'Telefon yoki ism', ru: 'Телефон или имя', en: 'Phone or name' },
  orders_count: { uz: 'buyurtma', ru: 'заказов', en: 'orders' },
  received: { uz: 'olgan', ru: 'получено', en: 'received' },
  cancelled: { uz: 'bekor', ru: 'отменено', en: 'cancelled' },
  block_prompt: { uz: 'Bloklash sababi (ixtiyoriy):', ru: 'Причина блокировки (необязательно):', en: 'Reason for blocking (optional):' },
  blocked_done: { uz: 'Bloklandi', ru: 'Заблокирован', en: 'Blocked' },
  unblocked_done: { uz: 'Blokdan chiqarildi', ru: 'Разблокирован', en: 'Unblocked' },
  no_customers: { uz: "Xaridor topilmadi", ru: 'Покупатели не найдены', en: 'No customers found' },
  paid: { uz: "To'lagan", ru: 'Оплатили', en: 'Paid' },
  not_paid: { uz: "To'lamagan", ru: 'Не оплатили', en: 'Not paid' },
  status: {
    pending: { uz: 'Kutilmoqda', ru: 'Ожидает', en: 'Pending' },
    approved: { uz: 'Faol', ru: 'Активен', en: 'Active' },
    rejected: { uz: 'Rad etilgan', ru: 'Отклонён', en: 'Rejected' },
    blocked: { uz: 'Bloklangan', ru: 'Заблокирован', en: 'Blocked' },
  },
  order_status: {
    pending: '🧾', accepted: '🧾', picking: '🛒', handed_over: '🤝', on_the_way: '🚗', delivered: '✅', cancelled: '✖️',
  },
};

const LIMIT_KEYS = ['new_customer_max_total', 'new_customer_max_open', 'max_open_orders', 'orders_per_10_min'];
const STATUS_COLOR = { pending: '#d97706', approved: '#16a34a', rejected: '#64748b', blocked: '#dc2626' };
const card = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 12, marginBottom: 8 };
const pill = (color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, color, background: `${color}1a` });
const smallBtn = (bg, color = '#ffffff') => ({ padding: '8px 10px', borderRadius: 10, border: 'none', background: bg, color, fontWeight: 800, fontSize: 12, cursor: 'pointer' });

function AdminLogin({ t, onBack, onSignedIn }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.adminLogin(pin);
      adminSession.set({ token: res.token });
      triggerHaptic('success');
      onSignedIn();
    } catch (err) {
      triggerHaptic('error');
      setError(err.message);
      setPin('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="animate-fade" style={{ maxWidth: 360, margin: '0 auto', padding: '16px 0 110px', textAlign: 'center' }}>
      <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#047857', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: '0 0 14px' }}>
        <ArrowLeft size={18} /> {t('back')}
      </button>
      <div style={{ fontSize: 44, marginBottom: 8 }}>🏛</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>{t('title')}</h2>
      <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 18px' }}>{t('pin_hint')}</p>
      <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }} maxLength={12} style={{ width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 14, border: '1.5px solid #e2e8f0', fontSize: 22, letterSpacing: 6, textAlign: 'center', marginBottom: 12 }} />
      {error && <div style={{ display: 'flex', gap: 8, background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 13, fontWeight: 600, textAlign: 'left' }}><AlertCircle size={16} style={{ flexShrink: 0 }} />{error}</div>}
      <button type="submit" disabled={!pin || busy} style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', background: '#0f172a', color: '#ffffff', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: !pin || busy ? 0.5 : 1 }}>{t('enter')}</button>
    </form>
  );
}

export default function AdminPanel({ onBackToMarket }) {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (key) => (typeof T[key] === 'object' && T[key][lang] !== undefined ? T[key][lang] : key);
  const statusName = (s) => T.status[s]?.[lang] || s;

  const [signedIn, setSignedIn] = useState(() => Boolean(adminSession.get()?.token));
  const [tab, setTab] = useState(0);
  const [data, setData] = useState({ overview: null, stores: [], staff: [], orders: [], patta: null });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [settingsForm, setSettingsForm] = useState({ radius: '', patta: '', phone: '', porterFee: '', taxiFee: '' });
  const [customers, setCustomers] = useState([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [categories, setCategories] = useState({});

  useEffect(() => {
    api.getCategories().then((list) => setCategories(Object.fromEntries(list.map((c) => [c.slug, c])))).catch(() => {});
  }, []);
  const categoryName = (slug) => {
    const c = categories[slug];
    return c ? `${c.icon || ''} ${c[`name_${language}`] || c.name_uz}`.trim() : slug;
  };

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      const [overview, stores, staff, orders, patta] = await Promise.all([
        api.adminOverview(), api.adminStores(), api.adminStaff(), api.adminOrders(), api.adminPatta()
      ]);
      setData({ overview, stores, staff, orders, patta });
      setSettingsForm((prev) => prev.radius ? prev : {
        radius: String(overview.delivery_radius_km), patta: String(overview.patta_amount), phone: overview.support_phone || '',
        porterFee: String(overview.porter_fee ?? 5000), taxiFee: String(overview.taxi_fee ?? 10000),
        ...Object.fromEntries(LIMIT_KEYS.map((key) => [key, String(overview[key] ?? '')])),
      });
      setError('');
    } catch (err) {
      if (err.status === 401) setSignedIn(false);
      else setError(err.message);
    }
  }, [signedIn]);

  const live = useLive(signedIn ? ['admin'] : [], load);
  useEffect(() => {
    load();
    const timer = setInterval(load, live ? 60000 : 20000);
    return () => clearInterval(timer);
  }, [load, live]);

  const act = async (action, message) => {
    setError('');
    try {
      await action();
      triggerHaptic('success');
      if (message) {
        setNotice(message);
        setTimeout(() => setNotice(''), 2500);
      }
    } catch (err) {
      triggerHaptic('error');
      setError(err.message);
    }
    load();
  };

  const loadCustomers = (q = customerQuery) => api.adminCustomers(q).then(setCustomers).catch((err) => setError(err.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (signedIn && tab === 7) loadCustomers(); }, [signedIn, tab]);

  const blockCustomer = (c) => {
    const reason = window.prompt(t('block_prompt'));
    if (reason === null) return;
    act(() => api.adminBlockCustomer(c.phone, reason).then(() => loadCustomers()), t('blocked_done'));
  };
  const unblockCustomer = (c) => act(() => api.adminUnblockCustomer(c.phone_key).then(() => loadCustomers()), t('unblocked_done'));

  const resetPin = (fn) => {
    const pin = window.prompt(t('pin_prompt'));
    if (pin && /^\d{4,6}$/.test(pin)) act(() => fn(pin), t('pin_done'));
  };

  if (!signedIn) {
    return <AdminLogin t={t} onBack={onBackToMarket} onSignedIn={() => setSignedIn(true)} />;
  }

  const { overview, stores, staff, orders, patta } = data;
  const pendingStores = stores.filter((s) => s.status === 'pending');
  const pendingStaff = staff.filter((s) => s.status === 'pending');

  const statusButtons = (item, setStatus) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {item.status === 'pending' && <>
        <button type="button" style={smallBtn('#16a34a')} onClick={() => act(() => setStatus(item.id, 'approved'))}>{t('approve')}</button>
        <button type="button" style={smallBtn('#f1f5f9', '#334155')} onClick={() => act(() => setStatus(item.id, 'rejected'))}>{t('reject')}</button>
      </>}
      {item.status === 'approved' && <button type="button" style={smallBtn('#fee2e2', '#b91c1c')} onClick={() => act(() => setStatus(item.id, 'blocked'))}>{t('block')}</button>}
      {['blocked', 'rejected'].includes(item.status) && <button type="button" style={smallBtn('#dcfce7', '#15803d')} onClick={() => act(() => setStatus(item.id, 'approved'))}>{t('unblock')}</button>}
    </div>
  );

  const storeCard = (s) => (
    <div key={`store-${s.id}`} style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <b style={{ fontSize: 15 }}>🏪 {stallLabel(s.stall_number, language)}</b>
        <span style={pill(STATUS_COLOR[s.status])}>{statusName(s.status)}</span>
      </div>
      <div style={{ fontSize: 14 }}>{s[`name_${language}`] || s.name_uz}</div>
      <div style={{ fontSize: 13, color: '#64748b' }}>{s.owner_name} · <a href={`tel:${s.owner_phone.replace(/[^\d+]/g, '')}`} style={{ color: 'inherit' }}>{s.owner_phone}</a> · {categoryName(s.category_slug)}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {statusButtons(s, api.adminStoreStatus)}
        {s.status === 'approved' && <button type="button" style={{ ...smallBtn('#f1f5f9', '#334155'), marginTop: 8 }} onClick={() => resetPin((pin) => api.adminStorePin(s.id, pin))}>{t('new_pin')}</button>}
      </div>
    </div>
  );

  const staffCard = (s) => (
    <div key={`staff-${s.id}`} style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <b style={{ fontSize: 15 }}>{ROLE_INFO[s.role]?.emoji} {s.name}</b>
        <span style={pill(STATUS_COLOR[s.status])}>{statusName(s.status)}</span>
      </div>
      <div style={{ fontSize: 13, color: '#64748b' }}>
        {ROLE_INFO[s.role]?.[lang]} · <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} style={{ color: 'inherit' }}>{s.phone}</a>{s.car ? ` · ${s.car}` : ''}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {statusButtons(s, api.adminStaffStatus)}
        {s.status === 'approved' && <button type="button" style={{ ...smallBtn('#f1f5f9', '#334155'), marginTop: 8 }} onClick={() => resetPin((pin) => api.adminStaffPin(s.id, pin))}>{t('new_pin')}</button>}
      </div>
    </div>
  );

  const stat = (label, value, sub, color = '#0f172a', onClick) => (
    <button type="button" onClick={onClick} style={{ ...card, marginBottom: 0, textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b' }}>{sub}</div>}
    </button>
  );

  return (
    <div className="animate-fade" style={{ paddingTop: 12, paddingBottom: 110 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #0f172a, #334155)', color: '#ffffff', border: 'none', padding: 14 }}>
        <div style={{ fontSize: 30 }}>🏛</div>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>{t('title')}</div>
        <button type="button" onClick={load} aria-label="refresh" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}><RefreshCw size={16} /></button>
        <button type="button" onClick={() => { adminSession.set(null); setSignedIn(false); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <LogOut size={14} /> {t('logout')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -12px 12px', padding: '0 12px 4px' }}>
        {t('tabs').map((name, i) => {
          const badge = i === 1 ? pendingStores.length + pendingStaff.length : 0;
          return (
            <button key={name} type="button" onClick={() => { triggerHaptic('selection'); setTab(i); }} style={{ flexShrink: 0, padding: '9px 14px', borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: 'pointer', border: 'none', background: tab === i ? '#0f172a' : '#ffffff', color: tab === i ? '#ffffff' : '#334155' }}>
              {name}{badge > 0 && <span style={{ marginLeft: 6, background: '#dc2626', color: '#fff', borderRadius: 999, padding: '0 6px' }}>{badge}</span>}
            </button>
          );
        })}
      </div>

      {error && <div style={{ display: 'flex', gap: 8, background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 13, fontWeight: 600 }}><AlertCircle size={16} style={{ flexShrink: 0 }} />{error}</div>}
      {notice && <div style={{ display: 'flex', gap: 8, background: '#ecfdf5', color: '#047857', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 13, fontWeight: 600 }}><CheckCircle2 size={16} style={{ flexShrink: 0 }} />{notice}</div>}

      {tab === 0 && overview && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {stat(t('pending'), overview.pending_stores + overview.pending_staff, null, overview.pending_stores + overview.pending_staff ? '#dc2626' : '#0f172a', () => setTab(1))}
          {stat(t('stalls'), overview.stores, null, '#0f172a', () => setTab(2))}
          {stat(`${ROLE_INFO.porter.emoji} ${ROLE_INFO.porter[lang]} · ${ROLE_INFO.taxi.emoji} ${ROLE_INFO.taxi[lang]}`, `${overview.staff.porter} · ${overview.staff.taxi}`, `${ROLE_INFO.pattachi.emoji} ${ROLE_INFO.pattachi[lang]}: ${overview.staff.pattachi}`, '#0f172a', () => setTab(3))}
          {stat(t('orders24'), overview.orders_24h, Object.entries(overview.orders_by_status).map(([k, v]) => `${T.order_status[k] || k} ${v}`).join('  '), '#0f172a', () => setTab(4))}
          {stat(t('revenue'), Math.round(overview.revenue_24h).toLocaleString(), 'UZS')}
          {stat(t('patta_today'), `${overview.patta_today.paid} / ${overview.patta_today.of}`, `${Math.round(overview.patta_today.total).toLocaleString()} UZS`, '#6d28d9', () => setTab(5))}
          {stat(t('radius'), `${overview.delivery_radius_km} km`, null, '#047857', () => setTab(6))}
        </div>
      )}

      {tab === 1 && (
        <>
          {pendingStores.length + pendingStaff.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#64748b', padding: 24 }}>{t('no_requests')}</div>}
          {pendingStores.map(storeCard)}
          {pendingStaff.map(staffCard)}
        </>
      )}

      {tab === 2 && stores.map(storeCard)}
      {tab === 3 && staff.map(staffCard)}

      {tab === 4 && orders.map((o) => (
        <div key={o.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <b>{T.order_status[o.status]} #{o.order_number}</b>
            <span style={{ fontWeight: 800 }}>{Math.round(o.total_amount).toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            {o.customer_name} · <a href={`tel:${o.customer_phone.replace(/[^\d+]/g, '')}`} style={{ color: 'inherit' }}><Phone size={11} /> {o.customer_phone}</a>
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{o.delivery_address}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {o.porter_name && `🛒 ${o.porter_name}`} {o.taxi_name && ` · 🚕 ${o.taxi_name}`} · {o.created_at ? new Date(`${o.created_at}Z`).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : ''}
          </div>
          {!['delivered', 'cancelled'].includes(o.status) && (
            <button type="button" style={{ ...smallBtn('#fee2e2', '#b91c1c'), marginTop: 8 }} onClick={() => window.confirm(t('cancel_confirm')) && act(() => api.adminCancelOrder(o.id))}>{t('cancel')}</button>
          )}
        </div>
      ))}

      {tab === 5 && patta && (
        <>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span>{patta.day}</span>
            <span>{patta.paid_count} / {patta.stores.length} · {Math.round(patta.total).toLocaleString()} UZS</span>
          </div>
          {patta.stores.map((s) => (
            <div key={s.store_id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: s.paid ? '#f0fdf4' : '#ffffff' }}>
              <div style={{ minWidth: 0 }}>
                <b>{stallLabel(s.stall_number, language)}</b> <span style={{ color: '#64748b', fontSize: 13 }}>{s.owner_name}</span>
                {s.paid && <div style={{ fontSize: 12, color: '#15803d' }}>{s.collector}</div>}
              </div>
              <span style={pill(s.paid ? '#16a34a' : '#dc2626')}>{s.paid ? `${t('paid')} · ${Math.round(s.amount).toLocaleString()}` : t('not_paid')}</span>
            </div>
          ))}
        </>
      )}

      {tab === 6 && (
        <form onSubmit={(e) => { e.preventDefault(); act(() => api.adminSettings({ delivery_radius_km: Number(settingsForm.radius), patta_amount: Number(settingsForm.patta), support_phone: settingsForm.phone, porter_fee: Number(settingsForm.porterFee || 0), taxi_fee: Number(settingsForm.taxiFee || 0), ...Object.fromEntries(LIMIT_KEYS.filter((key) => settingsForm[key]).map((key) => [key, Number(settingsForm[key])])) }), t('saved')); }} style={card}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{t('radius')} ({t('km')})</label>
          <input value={settingsForm.radius} onChange={(e) => setSettingsForm({ ...settingsForm, radius: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 16, marginBottom: 12 }} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{t('patta_amount')} (UZS)</label>
          <input value={settingsForm.patta} onChange={(e) => setSettingsForm({ ...settingsForm, patta: e.target.value.replace(/\D/g, '') })} inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 16, marginBottom: 12 }} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{t('support_phone')}</label>
          <input value={settingsForm.phone} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value.replace(/[^\d\s()+-]/g, '') })} type="tel" inputMode="tel" placeholder="+998 71 000 00 00" maxLength={30} style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 16, marginBottom: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['porterFee', 'porter_fee'], ['taxiFee', 'taxi_fee']].map(([key, label]) => (
              <label key={key} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', minWidth: 0 }}>
                {t(label)}
                <input value={settingsForm[key]} onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.value.replace(/\D/g, '') })} inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 16, marginTop: 6, marginBottom: 12 }} />
              </label>
            ))}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, margin: '4px 0 2px' }}>🛡 {t('limits')}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{t('limits_hint')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {LIMIT_KEYS.map((key) => (
              <label key={key} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', minWidth: 0 }}>
                {t(key)}
                <input value={settingsForm[key] ?? ''} onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.value.replace(/\D/g, '') })} inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 16, marginTop: 6, marginBottom: 12 }} />
              </label>
            ))}
          </div>
          <button type="submit" style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: '#0f172a', color: '#ffffff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{t('save')}</button>
        </form>
      )}

      {tab === 7 && (
        <>
          <form onSubmit={(e) => { e.preventDefault(); loadCustomers(customerQuery); }} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder={t('search')} style={{ flex: 1, minWidth: 0, padding: 12, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 16 }} />
            <button type="submit" aria-label="search" style={{ ...smallBtn('#0f172a'), padding: '0 14px' }}>🔍</button>
          </form>
          {customers.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#64748b', padding: 24 }}>{t('no_customers')}</div>}
          {customers.map((c) => (
            <div key={c.phone_key} style={{ ...card, background: c.blocked ? '#fef2f2' : '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 15, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.tg_id ? '✈️ ' : ''}{c.name}</b>
                {c.blocked && <span style={pill('#dc2626')}>{statusName('blocked')}</span>}
              </div>
              <div style={{ fontSize: 13, color: '#475569' }}>
                <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} style={{ color: 'inherit' }}><Phone size={11} /> {c.phone}</a>
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {c.orders} {t('orders_count')} · ✅ {c.delivered} {t('received')} · ✖️ {c.cancelled} {t('cancelled')} · #{c.last_order}
              </div>
              {c.blocked && c.block_reason && <div style={{ fontSize: 13, color: '#b91c1c' }}>{c.block_reason}</div>}
              <div style={{ marginTop: 8 }}>
                {c.blocked
                  ? <button type="button" style={smallBtn('#dcfce7', '#15803d')} onClick={() => unblockCustomer(c)}>{t('unblock')}</button>
                  : <button type="button" style={smallBtn('#fee2e2', '#b91c1c')} onClick={() => blockCustomer(c)}>{t('block')}</button>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
