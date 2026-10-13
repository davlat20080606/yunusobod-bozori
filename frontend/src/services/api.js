import { getTelegramInitData } from './telegram';

const API_BASE = '/api';
const SELLER_SESSION_KEY = 'seller_session';

export function getSellerSession() {
  try {
    return JSON.parse(localStorage.getItem(SELLER_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setSellerSession(session) {
  try {
    if (session) localStorage.setItem(SELLER_SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SELLER_SESSION_KEY);
  } catch {}
}

function tgHeaders() {
  const initData = getTelegramInitData();
  return initData ? { 'x-telegram-init-data': initData } : {};
}

async function readError(res, fallback) {
  const err = await res.json().catch(() => ({}));
  const detail = Array.isArray(err.detail) ? (err.detail[0]?.msg || fallback) : err.detail;
  const error = new Error(detail || fallback);
  error.status = res.status;
  return error;
}

// Seller requests carry the session token; an expired session signs the seller out
async function sellerFetch(path, options = {}) {
  const session = getSellerSession();
  const headers = { ...(options.headers || {}) };
  if (session?.token) headers['x-seller-token'] = session.token;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}/seller${path}`, { ...options, headers });
  if (res.status === 401) {
    setSellerSession(null);
    window.dispatchEvent(new Event('seller-signed-out'));
  }
  if (!res.ok) throw await readError(res, 'Request failed');
  return res.json();
}

export const api = {
  // Stores & Categories
  async getStores(category = '') {
    const url = category ? `${API_BASE}/stores?category=${category}` : `${API_BASE}/stores`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch stores');
    return res.json();
  },

  async getCategories() {
    const res = await fetch(`${API_BASE}/stores/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  async getStoreDetail(slug) {
    const res = await fetch(`${API_BASE}/stores/${slug}`);
    if (!res.ok) throw new Error('Failed to fetch store details');
    return res.json();
  },

  // Products
  async getProducts(params = {}) {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.store_id) query.set('store_id', params.store_id);
    if (params.search) query.set('search', params.search);
    if (params.featured_only) query.set('featured_only', 'true');

    const res = await fetch(`${API_BASE}/products?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  // Orders
  async createOrder(orderData) {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tgHeaders() },
      body: JSON.stringify(orderData)
    });
    if (!res.ok) throw await readError(res, 'Failed to place order');
    return res.json();
  },

  async cancelOrder(orderNumber) {
    const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderNumber)}/cancel`, { method: 'POST' });
    if (!res.ok) throw await readError(res, 'Failed to cancel order');
    return res.json();
  },

  async getReviews() {
    const res = await fetch(`${API_BASE}/reviews?limit=10`);
    if (!res.ok) throw await readError(res, 'Failed to load reviews');
    return res.json();
  },

  async reviewOrder(orderNumber, rating, comment) {
    const res = await fetch(`${API_BASE}/reviews/${encodeURIComponent(orderNumber)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment })
    });
    if (!res.ok) throw await readError(res, 'Failed to send review');
    return res.json();
  },

  async getOrder(orderNumber) {
    if (!orderNumber) throw new Error('Order number required');
    const cleanNum = String(orderNumber).replace(/^#/, '').trim();
    const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(cleanNum)}`);
    if (!res.ok) throw new Error('Order not found');
    return res.json();
  },

  // Seller API
  async sellerLogin(phone, pin) {
    const res = await fetch(`${API_BASE}/seller/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tgHeaders() },
      body: JSON.stringify({ phone_or_slug: phone, pin })
    });
    if (!res.ok) throw await readError(res, 'Login failed');
    return res.json();
  },

  async registerStore(storeData, adminPin) {
    const res = await fetch(`${API_BASE}/seller/register-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
      body: JSON.stringify(storeData)
    });
    if (!res.ok) throw await readError(res, 'Failed to register store');
    return res.json();
  },

  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);
    return sellerFetch('/upload-media', { method: 'POST', body: formData });
  },

  async createProduct(productData) {
    return sellerFetch('/stores/me/products', { method: 'POST', body: JSON.stringify(productData) });
  },

  async updateStoreProfile(storeData) {
    return sellerFetch('/stores/me', { method: 'PATCH', body: JSON.stringify(storeData) });
  },

  async getMyStoreDashboard() {
    return sellerFetch('/my-store');
  },

  async updateProductPrice(productId, price, old_price = null) {
    return sellerFetch(`/products/${productId}/price`, { method: 'PATCH', body: JSON.stringify({ price, old_price }) });
  },

  async toggleProductAvailability(productId, is_available) {
    return sellerFetch(`/products/${productId}/availability`, { method: 'PATCH', body: JSON.stringify({ is_available }) });
  },

  async toggleStoreStatus() {
    return sellerFetch('/stores/me/toggle-status', { method: 'PATCH' });
  },

  async getStoreOrders() {
    return sellerFetch('/orders');
  },

  // Porter (aravachi) API
  async porterRequest(method, path, pin, porterPhone, body) {
    const headers = { 'Content-Type': 'application/json', 'x-porter-pin': pin, ...tgHeaders() };
    if (porterPhone) headers['x-porter-phone'] = porterPhone;
    const res = await fetch(`${API_BASE}/porter${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw await readError(res, 'Request failed');
    return res.json();
  },

  async porterLogin(pin) {
    return api.porterRequest('POST', '/login', pin, null, { pin });
  },

  async porterGetOrders(pin, porterPhone, porterName = '') {
    return api.porterRequest('GET', `/orders?porter_phone=${encodeURIComponent(porterPhone)}&porter_name=${encodeURIComponent(porterName)}`, pin);
  },

  async porterTakeOrder(pin, porterName, porterPhone, orderId) {
    return api.porterRequest('POST', `/orders/${orderId}/take`, pin, porterPhone, { porter_name: porterName, porter_phone: porterPhone });
  },

  async porterSetPicked(pin, porterPhone, itemId, isPicked) {
    return api.porterRequest('PATCH', `/items/${itemId}/picked`, pin, porterPhone, { is_picked: isPicked });
  },

  async porterSetStatus(pin, porterPhone, orderId, status) {
    return api.porterRequest('PATCH', `/orders/${orderId}/status`, pin, porterPhone, { status });
  },

  async porterRelease(pin, porterPhone, orderId) {
    return api.porterRequest('POST', `/orders/${orderId}/release`, pin, porterPhone);
  },

  // Market stats
  async getMarketStats() {
    const res = await fetch(`${API_BASE}/stats/summary`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  }
};
