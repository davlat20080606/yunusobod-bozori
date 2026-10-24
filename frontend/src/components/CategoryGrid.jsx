import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../services/telegram';

const NAMES = {
  vegetables: { uz: 'Sabzavotlar', ru: 'Овощи и зелень', en: 'Vegetables' },
  fruits: { uz: 'Mevalar', ru: 'Фрукты', en: 'Fruits' },
  meat: { uz: "Go'sht va qazi", ru: 'Мясо и казы', en: 'Meat' },
  bakery: { uz: 'Non va tandir', ru: 'Хлеб и выпечка', en: 'Bakery' },
  dairy: { uz: 'Sut mahsulotlari', ru: 'Молочное', en: 'Dairy' },
  dry_fruits: { uz: 'Quruq mevalar', ru: 'Сухофрукты', en: 'Dried fruits' },
  combos: { uz: "To'plamlar", ru: 'Наборы', en: 'Sets' },
  poliz: { uz: 'Poliz: qovun, tarvuz', ru: 'Бахча: дыни, арбузы', en: 'Melons' },
  shop: { uz: 'Magazin', ru: 'Магазин', en: 'Grocery' },
};

const COUNT_WORD = { uz: 'mahsulot', ru: 'товаров', en: 'items' };

// Big photo cards for bazaar sections; the photo and the count come from the real products
export default function CategoryGrid({ categories = [], products = [], onSelectCategory }) {
  const { getLocalized, language } = useLanguage();
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');

  const cards = categories
    .map((cat) => {
      const items = products.filter((p) => p.category_slug === cat.slug);
      const photo = items.find((p) => p.image_url)?.image_url;
      return { cat, count: items.length, photo };
    })
    .filter((c) => c.count > 0);

  if (!cards.length) return null;

  return (
    <section style={{ marginTop: 24 }}>
      <h2 className="med-section-title" style={{ marginBottom: 12 }}>
        {lang === 'ru' ? 'Разделы базара' : (lang === 'en' ? 'Bazaar sections' : "Bozor bo'limlari")}
      </h2>
      {/* Two tiles per row on phones, more on wide screens so the photos stay a sensible size */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {cards.map(({ cat, count, photo }) => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => { triggerHaptic('light'); onSelectCategory(cat.slug); }}
            style={{
              position: 'relative', aspectRatio: '1 / 1.05', borderRadius: 22, overflow: 'hidden',
              border: 'none', padding: 0, cursor: 'pointer', background: '#e2e8f0', textAlign: 'left'
            }}
          >
            {photo && <img src={photo} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.65) 100%)' }} />
            {/* Solid pill so the count stays readable on any photo */}
            <span style={{ position: 'absolute', top: 12, left: 12, padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', color: '#065f46', fontSize: 12, fontWeight: 800 }}>
              {cat.icon} {count} {COUNT_WORD[lang]}
            </span>
            <span style={{ position: 'absolute', left: 14, right: 60, bottom: 14, color: '#ffffff', fontSize: 17, fontWeight: 800, lineHeight: 1.2, textShadow: '0 1px 6px rgba(0,0,0,0.35)' }}>
              {NAMES[cat.slug]?.[lang] || getLocalized(cat, 'name')}
            </span>
            <span style={{ position: 'absolute', right: 12, bottom: 12, width: 40, height: 40, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRight size={18} color="#0f172a" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
