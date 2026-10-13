import React, { useState } from 'react';
import { Store, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api, setSellerSession } from '../services/api';
import { triggerHaptic } from '../services/telegram';

const T = {
  title: { uz: 'Sotuvchi kabineti', ru: 'Кабинет продавца', en: 'Seller dashboard' },
  subtitle: { uz: 'Telefon raqamingiz va PIN-kod bilan kiring', ru: 'Войдите по номеру телефона и PIN-коду', en: 'Sign in with your phone and PIN' },
  phone: { uz: 'Telefon raqami', ru: 'Номер телефона', en: 'Phone number' },
  pin: { uz: 'PIN-kod', ru: 'PIN-код', en: 'PIN code' },
  enter: { uz: 'Kirish', ru: 'Войти', en: 'Sign in' },
  porter: { uz: '🛒 Men aravachiman (yuk tashuvchi) →', ru: '🛒 Я аравачи (носильщик) →', en: '🛒 I am a porter (aravachi) →' },
  new_stall: { uz: "Yangi rasta qo'shish (ma'muriyat uchun)", ru: 'Новая раста (для администрации)', en: 'New stall (administration)' },
  back: { uz: 'Orqaga', ru: 'Назад', en: 'Back' },
  forgot: { uz: "PIN-kodni unutdingizmi? Bozor ma'muriyatiga murojaat qiling.", ru: 'Забыли PIN-код? Обратитесь в администрацию базара.', en: 'Forgot your PIN? Contact the bazaar administration.' },
  reg_title: { uz: "Yangi rasta qo'shish", ru: 'Новая раста', en: 'New stall' },
  reg_hint: { uz: "Faqat bozor ma'muriyati uchun. Sotuvchi keyin o'z telefoni va PIN-kodi bilan kiradi.", ru: 'Только для администрации базара. Продавец потом входит по своему телефону и PIN-коду.', en: 'For the bazaar administration only. The seller then signs in with their phone and PIN.' },
  stall_name: { uz: 'Rasta nomi', ru: 'Название расты', en: 'Stall name' },
  stall_number: { uz: 'Rasta raqami (masalan: Rasta 5, Joy 2)', ru: 'Номер расты (например: Раста 5, место 2)', en: 'Stall number (e.g. Rasta 5, place 2)' },
  owner_name: { uz: 'Sotuvchi ismi', ru: 'Имя продавца', en: 'Seller name' },
  category: { uz: "Bo'lim", ru: 'Раздел', en: 'Section' },
  seller_pin: { uz: 'Sotuvchi uchun PIN (4–6 raqam)', ru: 'PIN для продавца (4–6 цифр)', en: 'Seller PIN (4–6 digits)' },
  admin_pin: { uz: "Ma'muriyat PIN-kodi", ru: 'PIN администрации', en: 'Administration PIN' },
  register: { uz: "Rastani qo'shish", ru: 'Добавить расту', en: 'Add stall' },
  registered: { uz: "Rasta qo'shildi! Sotuvchi endi telefon va PIN bilan kirishi mumkin.", ru: 'Раста добавлена! Продавец может войти по телефону и PIN-коду.', en: 'Stall added! The seller can now sign in with phone and PIN.' },
};

const CATEGORIES = [
  ['vegetables', '🍅 Sabzavotlar / Овощи'],
  ['fruits', '🍇 Mevalar / Фрукты'],
  ['meat', "🥩 Go'sht / Мясо"],
  ['bakery', '🥖 Non / Хлеб'],
  ['dry_fruits', '🥜 Quruq mevalar / Сухофрукты'],
  ['dairy', '🧀 Sut mahsulotlari / Молочка'],
];

const page = {
  position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto',
  background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f2027 100%)',
  padding: '32px 16px calc(32px + env(safe-area-inset-bottom))'
};
const input = {
  width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 14,
  border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)',
  color: '#ffffff', fontSize: 16, outline: 'none', marginBottom: 12
};
const label = { display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6 };
const primary = {
  width: '100%', height: 52, borderRadius: 14, border: 'none',
  background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff',
  fontSize: 16, fontWeight: 800, cursor: 'pointer'
};

function Message({ type, text }) {
  const ok = type === 'ok';
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, marginBottom: 12, fontSize: 14, fontWeight: 600, background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: ok ? '#6ee7b7' : '#fca5a5' }}>
      <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{text}</span>
    </div>
  );
}

export default function SellerLogin({ onSignedIn, onCancel, onOpenPorter }) {
  const { language } = useLanguage();
  const t = (key) => T[key]?.[language] || T[key]?.uz || key;

  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('+998 ');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [reg, setReg] = useState({ name_uz: '', stall_number: '', owner_name: '', owner_phone: '+998 ', category_slug: 'vegetables', pin: '', admin_pin: '' });

  const submitLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.sellerLogin(phone, pin);
      setSellerSession({ token: res.token, store: res.store });
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

  const submitRegister = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDone('');
    try {
      const { admin_pin, ...store } = reg;
      await api.registerStore({ ...store, name_ru: store.name_uz }, admin_pin);
      triggerHaptic('success');
      setDone(t('registered'));
      setPhone(store.owner_phone);
      setReg({ name_uz: '', stall_number: '', owner_name: '', owner_phone: '+998 ', category_slug: reg.category_slug, pin: '', admin_pin });
    } catch (err) {
      triggerHaptic('error');
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const header = (title, subtitle) => (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div style={{ width: 68, height: 68, borderRadius: '50%', margin: '0 auto 16px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(16,185,129,0.4)' }}>
        <Store size={32} color="#ffffff" />
      </div>
      <h2 style={{ color: '#ffffff', fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>{title}</h2>
      <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>{subtitle}</p>
    </div>
  );

  if (mode === 'register') {
    const set = (field) => (e) => setReg({ ...reg, [field]: field.endsWith('pin') ? e.target.value.replace(/\D/g, '') : e.target.value });
    const valid = reg.name_uz.trim().length >= 2 && reg.stall_number.trim() && reg.owner_name.trim().length >= 2
      && reg.owner_phone.replace(/\D/g, '').length >= 9 && /^\d{4,6}$/.test(reg.pin) && reg.admin_pin;
    return (
      <div style={page}>
        <form onSubmit={submitRegister} style={{ maxWidth: 400, margin: '0 auto' }}>
          <button type="button" onClick={() => { setMode('login'); setError(''); setDone(''); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#94a3b8', fontSize: 15, cursor: 'pointer', padding: '0 0 16px' }}>
            <ArrowLeft size={18} /> {t('back')}
          </button>
          {header(t('reg_title'), t('reg_hint'))}
          <label style={label}>{t('stall_name')}</label>
          <input style={input} value={reg.name_uz} onChange={set('name_uz')} maxLength={150} />
          <label style={label}>{t('stall_number')}</label>
          <input style={input} value={reg.stall_number} onChange={set('stall_number')} maxLength={50} />
          <label style={label}>{t('category')}</label>
          <select style={{ ...input, appearance: 'auto' }} value={reg.category_slug} onChange={set('category_slug')}>
            {CATEGORIES.map(([slug, name]) => <option key={slug} value={slug} style={{ color: '#0f172a' }}>{name}</option>)}
          </select>
          <label style={label}>{t('owner_name')}</label>
          <input style={input} value={reg.owner_name} onChange={set('owner_name')} maxLength={100} />
          <label style={label}>{t('phone')}</label>
          <input style={input} type="tel" inputMode="tel" value={reg.owner_phone} onChange={set('owner_phone')} maxLength={20} />
          <label style={label}>{t('seller_pin')}</label>
          <input style={input} inputMode="numeric" value={reg.pin} onChange={set('pin')} maxLength={6} />
          <label style={label}>{t('admin_pin')}</label>
          <input style={input} type="password" inputMode="numeric" value={reg.admin_pin} onChange={set('admin_pin')} maxLength={12} />
          {error && <Message type="error" text={error} />}
          {done && <Message type="ok" text={done} />}
          <button type="submit" disabled={!valid || busy} style={{ ...primary, opacity: !valid || busy ? 0.5 : 1 }}>{t('register')}</button>
        </form>
      </div>
    );
  }

  const canLogin = phone.replace(/\D/g, '').length >= 9 && pin.length >= 4 && !busy;
  return (
    <div style={page}>
      <form onSubmit={submitLogin} style={{ maxWidth: 360, margin: '0 auto' }}>
        {header(t('title'), t('subtitle'))}
        <label style={label}>{t('phone')}</label>
        <input style={input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} maxLength={20} />
        <label style={label}>{t('pin')}</label>
        <input style={{ ...input, letterSpacing: 6, fontSize: 20 }} type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }} maxLength={6} />
        {error && <Message type="error" text={error} />}
        {done && <Message type="ok" text={done} />}
        <button type="submit" disabled={!canLogin} style={{ ...primary, opacity: canLogin ? 1 : 0.5, marginBottom: 10 }}>{t('enter')}</button>
        <p style={{ color: '#64748b', fontSize: 12, textAlign: 'center', margin: '0 0 18px' }}>{t('forgot')}</p>

        {onOpenPorter && (
          <button type="button" onClick={onOpenPorter} style={{ width: '100%', padding: '12px 16px', borderRadius: 14, marginBottom: 10, background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.45)', color: '#fbbf24', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {t('porter')}
          </button>
        )}
        <button type="button" onClick={() => { setMode('register'); setError(''); }} style={{ width: '100%', padding: '10px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>
          {t('new_stall')}
        </button>
        <button type="button" onClick={onCancel} style={{ width: '100%', padding: '10px', background: 'none', border: 'none', color: '#64748b', fontSize: 15, cursor: 'pointer' }}>
          {t('back')}
        </button>
      </form>
    </div>
  );
}
