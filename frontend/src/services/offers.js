// Stall offers (discount / free taxi / gift) and how the order reaches the customer

const pick = (lang, uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));

// The scale weight must stay within ±5% of the order; the server refuses anything further off
export const WEIGHT_TOLERANCE = 0.05;
export function weightRange(quantity) {
  const round = (n) => Math.round(n * 1000) / 1000;
  return [round(quantity * (1 - WEIGHT_TOLERANCE)), round(quantity * (1 + WEIGHT_TOLERANCE))];
}
export function weightOk(quantity, value) {
  const [low, high] = weightRange(quantity);
  const v = Math.round(Number(value) * 1000) / 1000;
  return v >= low && v <= high;
}

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

// What an order got from a stall: "−5%", "Taxi paid by the stall", "🎁 1 kg carrots"
export function bonusLabel(b, lang) {
  if (b.kind === 'discount') return `🏷 ${pick(lang, 'Chegirma', 'Скидка', 'Discount')} ${b.text || ''}`.trim();
  if (b.kind === 'covers_taxi' || b.kind === 'free_taxi') return `🚕 ${pick(lang, "Taksi to'lovi qoplandi", 'Такси оплачено', 'Taxi paid')}`;
  if (b.kind === 'covers_porter') return `🛒 ${pick(lang, "Aravachi to'lovi qoplandi", 'Аравачи оплачен', 'Porter paid')}`;
  if (b.kind === 'delivery_discount') return `💰 ${pick(lang, 'Yetkazish bonusi → chegirma', 'Бонус доставки → скидка', 'Delivery bonus → discount')}`;
  return `🎁 ${b[`text_${lang}`] || b.text}`;
}

// "From 400 000 so'm — free taxi" for a stall's offer
export function promoLabel(p, lang) {
  const from = pick(lang, `${money(p.min_amount, lang)}dan`, `от ${money(p.min_amount, lang)}`, `from ${money(p.min_amount, lang)}`);
  if (p.kind === 'discount') return `${from} — ${pick(lang, 'chegirma', 'скидка', 'discount')} ${p.percent}%`;
  if (p.kind === 'delivery' || p.kind === 'free_taxi') {
    return `${from} — ${pick(lang, 'yetkazish bonusi', 'бонус на доставку', 'delivery bonus')}${p.amount ? ` ${money(p.amount, lang)}` : ''} 🚚`;
  }
  return `${from} — ${pick(lang, "sovg'a", 'подарок', 'gift')}: ${p.gift_text}${p.gift_qty ? ` (${p.gift_qty})` : ''} 🎁`;
}

// "Add 50 000 so'm at Dilshod ota for a free taxi"
export function hintLabel(h, lang) {
  const what = h.kind === 'discount'
    ? pick(lang, `${h.text} chegirma`, `скидку ${h.text}`, `a ${h.text} discount`)
    : h.kind === 'delivery' ? pick(lang, `${h.text} so'm yetkazish bonusi`, `бонус на доставку ${h.text} сум`, `a ${h.text} UZS delivery bonus`)
      : pick(lang, `sovg'a: ${h.text}`, `подарок: ${h.text}`, `a gift: ${h.text}`);
  const store = pick(lang, h.store_name_uz, h.store_name_ru || h.store_name_uz, h.store_name_uz);
  return pick(lang,
    `${store}dan yana ${money(h.need, lang)} — ${what}`,
    `Ещё ${money(h.need, lang)} у «${store}» — ${what}`,
    `${money(h.need, lang)} more at ${store} for ${what}`);
}
