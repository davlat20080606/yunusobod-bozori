// How the customer said they will pay; the money itself goes between people, never through the bot
export function payLabel(method, lang) {
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));
  return method === 'card'
    ? tr("💳 Kartaga o'tkazma", '💳 Перевод на карту', '💳 Card transfer')
    : tr('💵 Naqd pul', '💵 Наличными', '💵 Cash');
}
