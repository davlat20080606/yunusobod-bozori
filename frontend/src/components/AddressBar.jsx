import React, { useEffect, useState } from 'react';
import { ChevronDown, Zap } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { loadAddresses, rememberAddress } from '../services/location';
import { triggerHaptic } from '../services/telegram';
import MapPicker, { distanceKm } from './MapPicker';

// Yandex Go style: where we deliver and how fast, at the very top of the home screen
export default function AddressBar() {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const [address, setAddress] = useState(null);
  const [zone, setZone] = useState({ bazaar: { lat: 41.36467, lng: 69.29089 }, delivery_radius_km: 3 });
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    loadAddresses().then((list) => setAddress(list[0] || null)).catch(() => {});
    api.getConfig().then(setZone).catch(() => {});
  }, []);

  const outside = address && distanceKm(zone.bazaar, address) > zone.delivery_radius_km;
  const label = address
    ? [address.main, address.apartment && `${lang === 'ru' ? 'кв.' : (lang === 'en' ? 'apt' : 'xonadon')} ${address.apartment}`].filter(Boolean).join(', ')
    : (lang === 'ru' ? 'Выберите адрес' : (lang === 'en' ? 'Choose address' : 'Manzilni tanlang'));

  return (
    <>
      <button
        type="button"
        onClick={() => { triggerHaptic('light'); setPicking(true); }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', margin: '12px 0 0', borderRadius: 18, border: 'none', background: '#ffffff', boxShadow: '0 1px 4px rgba(15,23,42,0.08)', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 22 }}>📍</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            {lang === 'ru' ? 'Доставка' : (lang === 'en' ? 'Deliver to' : 'Yetkazish')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 16, fontWeight: 800, color: address ? '#0f172a' : '#059669' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <ChevronDown size={18} style={{ flexShrink: 0 }} />
          </span>
          {outside && (
            <span style={{ display: 'block', fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>
              {lang === 'ru' ? `Дальше ${zone.delivery_radius_km} км — пока не доставляем` : (lang === 'en' ? `Farther than ${zone.delivery_radius_km} km — not delivered yet` : `${zone.delivery_radius_km} km'dan uzoq — hozircha yetkazmaymiz`)}
            </span>
          )}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
          <Zap size={14} /> 45–60 {lang === 'ru' ? 'мин' : (lang === 'en' ? 'min' : 'daq')}
        </span>
      </button>

      {picking && (
        <MapPicker
          language={language}
          bazaar={zone.bazaar}
          radiusKm={zone.delivery_radius_km}
          onClose={() => setPicking(false)}
          onAddressSelect={(text, coords, details) => {
            const entry = { main: details?.main || text, details: details?.details || '', district: details?.district || 'Yunusobod', ...coords, entrance: '', floor: '', apartment: '', landmark: '' };
            setAddress(entry);
            rememberAddress(entry).catch(() => {});
            setPicking(false);
          }}
        />
      )}
    </>
  );
}
