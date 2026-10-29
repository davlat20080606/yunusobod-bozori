// Stall numbers are stored the Uzbek way ("Rasta 14, Joy №2"); show them in the reader's language
const WORDS = { ru: ['Раста', 'место'], en: ['Row', 'Stall'] };

export function stallLabel(stall, lang) {
  const words = WORDS[lang];
  if (!stall || !words) return stall || '';
  return stall.replace(/\bRasta\b/gi, words[0]).replace(/\bJoy\b/gi, words[1]);
}

// Order lines keep the Uzbek product name; the server adds the other languages
export function itemName(item, lang) {
  return (lang !== 'uz' && item?.[`product_name_${lang}`]) || item?.product_name || '';
}
