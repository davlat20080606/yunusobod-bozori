// Stall offers (discount / free taxi / gift) and how the order reaches the customer

const pick = (lang, uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));

export const FULFILLMENTS = [
  { id: 'self', icon: '🙋', title: ['O\'zim olaman', 'Заберу сам', 'I\'ll pick it up'], sub: ['Rastalardan o\'zingiz olasiz', 'Сами забираете на растах', 'Collect it at the stalls'] },
  { id: 'point', icon: '🛒', title: ['Aravachi', 'Аравачи', 'Porter'], sub: ['Bozordagi joyga olib keladi', 'Принесёт к точке на базаре', 'Brings it to a bazaar point'] },
  { id: 'courier', icon: '🚕', title: ['Uyga yetkazish', 'Доставка домой', 'Home delivery'], sub: ['Aravachi + taksi', 'Аравачи + такси', 'Porter + taxi'] },
];

export function fulfillmentLabel(id, lang) {
  const f = FULFILLMENTS.find((x) => x.id === id) || FULFILLMENTS[2];
  return `${f.icon} ${pick(lang, ...f.title)}`;
}

export function pointName(points, id, lang) {
  const p = (points || []).find((x) => x.id === id);
  return p ? pick(lang, p.name_uz, p.name_ru, p.name_en) : '';
}

const money = (n, lang) => `${Math.round(n).toLocaleString()} ${pick(lang, "so'm", 'сум', 'UZS')}`;

// "🚕 Free taxi", "−5%", "🎁 1 kg carrots" for a bonus an order got
export function bonusLabel(b, lang) {
  if (b.kind === 'discount') return `🏷 ${pick(lang, 'Chegirma', 'Скидка', 'Discount')} ${b.text || ''}`.trim();
  if (b.kind === 'free_taxi') return `🚕 ${pick(lang, 'Bepul taksi', 'Бесплатное такси', 'Free taxi')}`;
  return `🎁 ${b.text}`;
}

// "From 400 000 so'm — free taxi" for a stall's offer
export function promoLabel(p, lang) {
  const from = pick(lang, `${money(p.min_amount, lang)}dan`, `от ${money(p.min_amount, lang)}`, `from ${money(p.min_amount, lang)}`);
  if (p.kind === 'discount') return `${from} — ${pick(lang, 'chegirma', 'скидка', 'discount')} ${p.percent}%`;
  if (p.kind === 'free_taxi') return `${from} — ${pick(lang, 'bepul taksi', 'бесплатное такси', 'free taxi')} 🚕`;
  return `${from} — ${pick(lang, "sovg'a", 'подарок', 'gift')}: ${p.gift_text} 🎁`;
}

// "Add 50 000 so'm at Dilshod ota for a free taxi"
export function hintLabel(h, lang) {
  const what = h.kind === 'discount'
    ? pick(lang, `${h.text} chegirma`, `скидку ${h.text}`, `a ${h.text} discount`)
    : h.kind === 'free_taxi' ? pick(lang, 'bepul taksi', 'бесплатное такси', 'a free taxi')
      : pick(lang, `sovg'a: ${h.text}`, `подарок: ${h.text}`, `a gift: ${h.text}`);
  const store = pick(lang, h.store_name_uz, h.store_name_ru || h.store_name_uz, h.store_name_uz);
  return pick(lang,
    `${store}dan yana ${money(h.need, lang)} — ${what}`,
    `Ещё ${money(h.need, lang)} у «${store}» — ${what}`,
    `${money(h.need, lang)} more at ${store} for ${what}`);
}
