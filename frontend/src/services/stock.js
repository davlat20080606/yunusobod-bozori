// What a customer can still order of a product. The server sends available_quantity only for
// products the seller counts; for the rest it is null and only "is_available" matters.
const EPS = 1e-9;

export function stockLeft(product) {
  return product?.available_quantity ?? null;
}

export function isSoldOut(product) {
  const left = stockLeft(product);
  return product?.is_available === false || (left !== null && left < (product.min_weight || product.step_weight || 0.5) - EPS);
}

// "Only 2 kg left" once a few steps are all that is left
export function fewLeft(product) {
  const left = stockLeft(product);
  return left !== null && !isSoldOut(product) && left <= (product.step_weight || 0.5) * 4 + EPS;
}

export function canHave(product, quantity) {
  const left = stockLeft(product);
  return left === null || quantity <= left + EPS;
}

export function fewLeftLabel(product, unit, lang) {
  const left = stockLeft(product);
  const q = Number.isInteger(left) ? left : +left.toFixed(2);
  return lang === 'ru' ? `Осталось ${q} ${unit}` : (lang === 'en' ? `Only ${q} ${unit} left` : `Faqat ${q} ${unit} qoldi`);
}
