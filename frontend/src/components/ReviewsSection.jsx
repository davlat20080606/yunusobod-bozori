import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { stallLabel, itemName } from '../services/stall';

const T = {
  kicker: { uz: 'XARIDORLAR FIKRI', ru: 'ОТЗЫВЫ ПОКУПАТЕЛЕЙ', en: 'CUSTOMER REVIEWS' },
  title: { uz: 'Bozor haqida nima deyishadi', ru: 'Что говорят о базаре', en: 'What people say' },
  subtitle: { uz: "Faqat shu botda buyurtma olgan xaridorlarning baholari", ru: 'Только оценки покупателей, получивших заказ через этот бот', en: 'Only from customers who received an order through this bot' },
  ratings: { uz: 'ta baho', ru: 'оценок', en: 'ratings' },
};

function Stars({ value, size = 16 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color="#f59e0b" fill={i <= Math.floor(value + 0.25) ? '#f59e0b' : 'none'} />
      ))}
    </span>
  );
}

export default function ReviewsSection() {
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (key) => T[key][lang];
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getReviews().then(setData).catch(() => setData(null));
  }, []);

  // No invented numbers: the block appears only after the first real review
  if (!data || data.count === 0) return null;

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: '#059669' }}>{t('kicker')}</div>
      <h2 className="med-section-title" style={{ margin: '4px 0 4px' }}>{t('title')}</h2>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>{t('subtitle')}</p>

      <div style={{ background: '#ffffff', borderRadius: 20, padding: 16, boxShadow: '0 1px 4px rgba(15,23,42,0.06)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{data.average.toFixed(1)}</div>
          <div>
            <Stars value={data.average} size={18} />
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{data.count} {t('ratings')}</div>
          </div>
        </div>
        {[5, 4, 3, 2, 1].map((n) => {
          const share = data.count ? Math.round((data.distribution[String(n)] / data.count) * 100) : 0;
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', marginTop: 6 }}>
              <span style={{ width: 22 }}>{n}★</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{ width: `${share}%`, height: '100%', background: '#f59e0b' }} />
              </div>
              <span style={{ width: 36, textAlign: 'right' }}>{share}%</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', margin: '0 -12px', padding: '0 12px 6px', scrollSnapType: 'x mandatory' }}>
        {data.latest.filter((r) => r.comment).map((r, i) => (
          <div key={i} style={{ width: 260, flexShrink: 0, scrollSnapAlign: 'start', background: '#ffffff', borderRadius: 18, padding: 14, boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <b style={{ fontSize: 14 }}>{r.name}</b>
              <Stars value={r.rating} size={13} />
            </div>
            <p style={{ fontSize: 14, color: '#334155', margin: '0 0 8px', lineHeight: 1.4 }}>{r.comment}</p>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {r.created_at ? new Date(`${r.created_at}Z`).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''}
              {r.stalls.length ? ` · ${r.stalls.map((x) => stallLabel(x, language)).join(', ')}` : ''}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
