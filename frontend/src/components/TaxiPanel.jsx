import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, MapPin, LogOut, RefreshCw, AlertCircle, Navigation } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api, staffSession } from '../services/api';
import { triggerHaptic } from '../services/telegram';
import StaffLogin from './StaffLogin';
import { pointName } from '../services/offers';
import { newIdsWatcher } from '../services/sound';
import { stallLabel, itemName } from '../services/stall';

const T = {
  title: { uz: 'Taksichi kabineti', ru: 'Кабинет таксиста', en: 'Taxi dashboard' },
  tab_new: { uz: 'Tayyor buyurtmalar', ru: 'Готовые заказы', en: 'Ready orders' },
  tab_mine: { uz: 'Mening yo\'llarim', ru: 'Мои поездки', en: 'My trips' },
  empty_new: { uz: "Hozircha tayyor buyurtma yo'q. Aravachi topshirganda xabar keladi.", ru: 'Готовых заказов пока нет. Придёт уведомление, когда аравачи передаст заказ.', en: 'No ready orders yet. You will be notified.' },
  empty_mine: { uz: "Sizda faol yo'l yo'q", ru: 'У вас нет активных поездок', en: 'No active trips' },
  at_gate: { uz: 'bozor darvozasida kutmoqda', ru: 'ждёт у ворот базара', en: 'waiting at the bazaar gate' },
  take: { uz: '🚕 Olib ketaman', ru: '🚕 Беру заказ', en: '🚕 Take order' },
  go: { uz: "🤝 Qabul qildim, yo'lga chiqdim", ru: '🤝 Принял, выехал', en: '🤝 Got it, on my way' },
  delivered: { uz: '✅ Yetkazdim', ru: '✅ Доставил', en: '✅ Delivered' },
  customer: { uz: 'Mijoz', ru: 'Покупатель', en: 'Customer' },
  porter: { uz: 'Aravachi', ru: 'Аравачи', en: 'Porter' },
  call: { uz: "Qo'ng'iroq", ru: 'Позвонить', en: 'Call' },
  route: { uz: "Yo'lni ochish", ru: 'Открыть маршрут', en: 'Open route' },
  pay_cash: { uz: 'Naqd oling', ru: 'Получить наличными', en: 'Collect cash' },
  pay_check: { uz: "To'lovni tekshiring", ru: 'Проверьте оплату', en: 'Check payment' },
  items: { uz: 'ta mahsulot', ru: 'товаров', en: 'items' },
  logout: { uz: 'Chiqish', ru: 'Выйти', en: 'Sign out' },
  eta_question: { uz: 'Darvozaga necha daqiqada yetasiz?', ru: 'Через сколько минут будете у ворот?', en: 'How soon will you be at the gate?' },
  min: { uz: 'daq', ru: 'мин', en: 'min' },
  navigator: { uz: 'Yandex Navigator', ru: 'Яндекс Навигатор', en: 'Yandex Navigator' },
  code_label: { uz: 'Xaridordan 4 xonali kodni so\'rang', ru: 'Спросите у покупателя 4-значный код', en: 'Ask the customer for the 4-digit code' },
};

const BAZAAR = '69.29089,41.36467';
const card = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, marginBottom: 12 };
const btn = { width: '100%', padding: '14px 16px', borderRadius: 14, border: 'none', background: '#2563eb', color: '#ffffff', fontSize: 15, fontWeight: 800, cursor: 'pointer' };
const smallLink = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1d4ed8', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 };

export default function TaxiPanel({ onBackToMarket }) {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (key) => T[key][lang];

  const [session, setSession] = useState(() => {
    const current = staffSession.get();
    return current?.staff?.role === 'taxi' ? current : null;
  });
  const [orders, setOrders] = useState({ available: [], mine: [] });
  const [etaFor, setEtaFor] = useState(null);
  const [codes, setCodes] = useState({});
  const watchNew = useRef(newIdsWatcher()).current;
  const [tab, setTab] = useState('new');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [points, setPoints] = useState([]);
  useEffect(() => { api.getConfig().then((cfg) => setPoints(cfg.handoff_points || [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api.taxiOrders();
      setOrders(data);
      watchNew(data.available.map((o) => o.id));
      setError('');
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        staffSession.set(null);
        setSession(null);
      } else {
        setError(err.message);
      }
    }
  }, [session]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      triggerHaptic('success');
    } catch (err) {
      triggerHaptic('error');
      setError(err.message);
    } finally {
      setBusy(false);
      load();
    }
  };

  if (!session) {
    return <StaffLogin role="taxi" onBack={onBackToMarket} onSignedIn={() => setSession(staffSession.get())} />;
  }

  const list = tab === 'new' ? orders.available : orders.mine;

  return (
    <div className="animate-fade" style={{ paddingTop: 12, paddingBottom: 110 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', color: '#ffffff', border: 'none' }}>
        <div style={{ fontSize: 30 }}>🚕</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t('title')}</div>
          <div style={{ fontSize: 13, color: '#bfdbfe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.staff.name} · {session.staff.car}</div>
        </div>
        <button type="button" onClick={() => { staffSession.set(null); setSession(null); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <LogOut size={14} /> {t('logout')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['new', t('tab_new'), orders.available.length], ['mine', t('tab_mine'), orders.mine.length]].map(([key, label, count]) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{ flex: 1, padding: '11px 6px', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer', border: tab === key ? '2px solid #2563eb' : '1.5px solid #e2e8f0', background: tab === key ? '#eff6ff' : '#ffffff', color: tab === key ? '#1d4ed8' : '#334155' }}>
            {label} {count > 0 && `(${count})`}
          </button>
        ))}
        <button type="button" onClick={load} aria-label="refresh" style={{ width: 46, borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: 8, background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {list.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#64748b', padding: '28px 16px', fontSize: 14 }}>{tab === 'new' ? t('empty_new') : t('empty_mine')}</div>}

      {list.map((o) => {
        const hasPoint = o.delivery_lat != null && o.delivery_lng != null;
        const routeUrl = hasPoint
          ? `https://yandex.uz/maps/?rtext=${BAZAAR.split(',').reverse().join(',')}~${o.delivery_lat},${o.delivery_lng}&rtt=auto`
          : `https://yandex.uz/maps/?text=${encodeURIComponent(`Toshkent, ${o.delivery_district}, ${o.delivery_address}`)}`;
        return (
          <div key={o.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <b style={{ fontSize: 16 }}>#{o.order_number}</b>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(o.total_amount).toLocaleString()} UZS</span>
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>
              🛒 {o.porter_name} — {o.handoff_point ? `📍 ${pointName(points, o.handoff_point, language)}` : t('at_gate')} · {o.items_count} {t('items')}
              {o.gifts?.length > 0 && <div style={{ color: '#047857', fontWeight: 700 }}>🎁 {o.gifts.map((g) => g[`text_${language}`] || g.text).join(', ')}</div>}
            </div>
            <div style={{ fontSize: 14, color: '#0f172a', marginBottom: 6, display: 'flex', gap: 4 }}>
              <MapPin size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{o.delivery_district}, {o.delivery_address}{o.landmark ? ` · ${o.landmark}` : ''}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: o.payment_method === 'cash' ? '#047857' : '#b45309', marginBottom: 10 }}>
              💳 {o.payment_method === 'cash' ? t('pay_cash') : `${o.payment_method === 'payme' ? 'Payme' : 'Click'} — ${t('pay_check')}`}
            </div>

            {tab === 'new' ? (
              etaFor === o.id ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{t('eta_question')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {[5, 10, 15, 20].map((m) => (
                      <button key={m} type="button" disabled={busy} onClick={() => run(async () => { await api.taxiTake(o.id, m); setEtaFor(null); setTab('mine'); })} style={{ ...btn, padding: '12px 4px', opacity: busy ? 0.6 : 1 }}>{m} {t('min')}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <button type="button" disabled={busy} onClick={() => setEtaFor(o.id)} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{t('take')}</button>
              )
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <a href={`tel:${o.customer_phone.replace(/[^\d+]/g, '')}`} style={smallLink}><Phone size={14} /> {t('customer')}: {o.customer_name}</a>
                  {o.porter_phone && <a href={`tel:${o.porter_phone.replace(/[^\d+]/g, '')}`} style={smallLink}><Phone size={14} /> {t('porter')}</a>}
                  <a href={routeUrl} target="_blank" rel="noreferrer" style={smallLink}><Navigation size={14} /> {t('route')}</a>
                  {hasPoint && <a href={`yandexnavi://build_route_on_map?lat_to=${o.delivery_lat}&lon_to=${o.delivery_lng}`} style={smallLink}>🧭 {t('navigator')}</a>}
                  {hasPoint && <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.delivery_lat},${o.delivery_lng}&travelmode=driving`} target="_blank" rel="noreferrer" style={smallLink}>🗺 Google Maps</a>}
                </div>
                {o.status === 'handed_over' && <button type="button" disabled={busy} onClick={() => run(() => api.taxiStatus(o.id, 'on_the_way'))} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{t('go')}</button>}
                {o.status === 'on_the_way' && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 6 }}>🔑 {t('code_label')}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={codes[o.id] || ''} onChange={(e) => setCodes({ ...codes, [o.id]: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" placeholder="••••" style={{ width: 110, height: 50, borderRadius: 12, border: '2px solid #86efac', fontSize: 24, fontWeight: 800, letterSpacing: 6, textAlign: 'center' }} />
                      <button type="button" disabled={busy || (o.needs_code && (codes[o.id] || '').length !== 4)} onClick={() => run(() => api.taxiStatus(o.id, 'delivered', codes[o.id]))} style={{ ...btn, flex: 1, background: '#059669', opacity: busy || (o.needs_code && (codes[o.id] || '').length !== 4) ? 0.5 : 1 }}>{t('delivered')}</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
