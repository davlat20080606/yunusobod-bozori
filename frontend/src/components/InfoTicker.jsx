import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

// Running line with real facts only, always in the chosen language
const MESSAGES = {
  uz: ['🕕 Bozor har kuni 06:00 – 20:00', '⚡ Tez yetkazish 45–60 daqiqada', "🛒 Aravachi rastalardan o'zi tanlab oladi", "📍 Yunusobod Dehqon Bozori, Toshkent", "📦 Buyurtma holatini jonli kuzating"],
  ru: ['🕕 Базар работает ежедневно 06:00 – 20:00', '⚡ Экспресс-доставка за 45–60 минут', '🛒 Аравачи сам выбирает товар на растах', '📍 Юнусабадский дехканский базар, Ташкент', '📦 Следите за заказом в реальном времени'],
  en: ['🕕 Open daily 06:00 – 20:00', '⚡ Express delivery in 45–60 minutes', '🛒 A porter picks your items at the stalls', '📍 Yunusobod Farmers Market, Tashkent', '📦 Track your order live'],
};

export default function InfoTicker() {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const line = MESSAGES[lang].join('     •     ');

  return (
    <div style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', background: '#047857', color: '#ffffff', fontSize: 14, fontWeight: 700 }} aria-label={line}>
      <div style={{ display: 'flex', width: 'max-content', animation: 'ticker-move 38s linear infinite', padding: '11px 0' }}>
        {/* Two copies make the loop seamless */}
        <span style={{ whiteSpace: 'nowrap', paddingRight: 48 }}>{line}</span>
        <span style={{ whiteSpace: 'nowrap', paddingRight: 48 }} aria-hidden="true">{line}</span>
      </div>
      <style>{`
        @keyframes ticker-move { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { [style*="ticker-move"] { animation: none !important; } }
      `}</style>
    </div>
  );
}
