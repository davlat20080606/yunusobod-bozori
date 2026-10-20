// Orders store the time slot as a fixed English id; show it in the reader's language
const SLOT_LABELS = {
  Express: { uz: 'Tezkor (45–60 daqiqa)', ru: 'Экспресс (45–60 минут)', en: 'Express (45–60 min)' },
  Evening: { uz: 'Bugun kechqurun (18:00–20:00)', ru: 'Сегодня вечером (18:00–20:00)', en: 'Tonight (18:00–20:00)' },
  Morning: { uz: 'Ertaga ertalab (09:00–11:00)', ru: 'Завтра утром (09:00–11:00)', en: 'Tomorrow morning (09:00–11:00)' },
};

export function slotLabel(slot, lang) {
  const labels = SLOT_LABELS[(slot || '').split(' ')[0]];
  return labels ? (labels[lang] || labels.uz) : slot;
}
