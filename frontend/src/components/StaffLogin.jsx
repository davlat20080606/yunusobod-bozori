import React, { useState } from 'react';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api, staffSession } from '../services/api';
import { triggerHaptic } from '../services/telegram';

export const ROLE_INFO = {
  porter: { emoji: '🛒', color: '#d97706', uz: 'Aravachi', ru: 'Аравачи', en: 'Porter' },
  taxi: { emoji: '🚕', color: '#2563eb', uz: 'Taksichi', ru: 'Таксист', en: 'Taxi driver' },
  pattachi: { emoji: '🧾', color: '#7c3aed', uz: 'Pattachi', ru: 'Паттачи', en: 'Fee collector' },
};

const T = {
  cabinet: { uz: 'kabineti', ru: '— кабинет', en: 'dashboard' },
  subtitle: { uz: 'Telefon raqamingiz va PIN-kod bilan kiring', ru: 'Войдите по номеру телефона и PIN-коду', en: 'Sign in with your phone and PIN' },
  phone: { uz: 'Telefon raqami', ru: 'Номер телефона', en: 'Phone number' },
  pin: { uz: 'PIN-kod', ru: 'PIN-код', en: 'PIN code' },
  enter: { uz: 'Kirish', ru: 'Войти', en: 'Sign in' },
  register: { uz: "Ro'yxatdan o'tish", ru: 'Зарегистрироваться', en: 'Register' },
  no_account: { uz: "Hisobingiz yo'qmi?", ru: 'Нет аккаунта?', en: 'No account yet?' },
  back: { uz: 'Orqaga', ru: 'Назад', en: 'Back' },
  name: { uz: 'Ismingiz', ru: 'Ваше имя', en: 'Your name' },
  car: { uz: 'Mashina va raqami (masalan: Cobalt, 01 A 777 AA)', ru: 'Машина и номер (например: Cobalt, 01 A 777 AA)', en: 'Car and plate (e.g. Cobalt, 01 A 777 AA)' },
  new_pin: { uz: "PIN-kod o'ylab toping (4–6 raqam)", ru: 'Придумайте PIN-код (4–6 цифр)', en: 'Choose a PIN (4–6 digits)' },
  sent: { uz: "Ariza yuborildi! Bozorkom tasdiqlagach, shu telefon va PIN bilan kirasiz.", ru: 'Заявка отправлена! После одобрения администрацией входите с этим телефоном и PIN.', en: 'Application sent! Sign in with this phone and PIN after the administration approves it.' },
};

const input = {
  width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 14,
  border: '1.5px solid #e2e8f0', background: '#ffffff', fontSize: 16, outline: 'none', marginBottom: 12
};
const label = { display: 'block', color: '#475569', fontSize: 13, fontWeight: 700, marginBottom: 6 };

function Message({ ok, text }) {
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 12, marginBottom: 12, fontSize: 14, fontWeight: 600, background: ok ? '#ecfdf5' : '#fef2f2', color: ok ? '#047857' : '#b91c1c' }}>
      <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{text}</span>
    </div>
  );
}

export default function StaffLogin({ role, onSignedIn, onBack }) {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (key) => T[key][lang];
  const info = ROLE_INFO[role];

  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('+998 ');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [car, setCar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      triggerHaptic('error');
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const login = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await api.staffLogin(phone, pin);
      if (res.staff.role !== role) {
        throw new Error(lang === 'ru' ? `Этот номер зарегистрирован как ${ROLE_INFO[res.staff.role][lang]}` : `Bu raqam ${ROLE_INFO[res.staff.role][lang]} sifatida ro'yxatdan o'tgan`);
      }
      staffSession.set({ token: res.token, staff: res.staff });
      triggerHaptic('success');
      onSignedIn(res.staff);
    });
  };

  const register = (e) => {
    e.preventDefault();
    run(async () => {
      await api.staffRegister({ role, name, phone, pin, car: role === 'taxi' ? car : null });
      triggerHaptic('success');
      setDone(t('sent'));
      setMode('login');
      setPin('');
    });
  };

  const phoneOk = phone.replace(/\D/g, '').length >= 12 || phone.replace(/\D/g, '').length === 9;
  const canLogin = phoneOk && pin.length >= 4 && !busy;
  const canRegister = phoneOk && /^\d{4,6}$/.test(pin) && name.trim().length >= 2 && (role !== 'taxi' || car.trim().length >= 3) && !busy;

  return (
    <div className="animate-fade" style={{ maxWidth: 400, margin: '0 auto', padding: '16px 0 110px' }}>
      <button type="button" onClick={mode === 'register' ? () => { setMode('login'); setError(''); } : onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#047857', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: '0 0 14px' }}>
        <ArrowLeft size={18} /> {t('back')}
      </button>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 68, height: 68, borderRadius: '50%', margin: '0 auto 12px', background: `${info.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{info.emoji}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>
          {mode === 'register' ? `${info[lang]} · ${t('register')}` : `${info[lang]} ${t('cabinet')}`}
        </h2>
        {mode === 'login' && <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{t('subtitle')}</p>}
      </div>

      <form onSubmit={mode === 'login' ? login : register}>
        {mode === 'register' && (
          <>
            <label style={label}>{t('name')}</label>
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </>
        )}
        <label style={label}>{t('phone')}</label>
        <input style={input} type="tel" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} maxLength={20} />
        {mode === 'register' && role === 'taxi' && (
          <>
            <label style={label}>{t('car')}</label>
            <input style={input} value={car} onChange={(e) => setCar(e.target.value)} maxLength={100} />
          </>
        )}
        <label style={label}>{mode === 'register' ? t('new_pin') : t('pin')}</label>
        <input style={{ ...input, letterSpacing: 6, fontSize: 20 }} type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }} maxLength={6} />

        {error && <Message text={error} />}
        {done && <Message ok text={done} />}

        <button type="submit" disabled={mode === 'login' ? !canLogin : !canRegister} style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', background: info.color, color: '#ffffff', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: (mode === 'login' ? canLogin : canRegister) ? 1 : 0.5 }}>
          {mode === 'login' ? t('enter') : t('register')}
        </button>
      </form>

      {mode === 'login' && (
        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: '#64748b' }}>
          {t('no_account')}{' '}
          <button type="button" onClick={() => { setMode('register'); setError(''); setDone(''); }} style={{ background: 'none', border: 'none', color: info.color, fontWeight: 800, fontSize: 14, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {t('register')}
          </button>
        </p>
      )}
    </div>
  );
}
