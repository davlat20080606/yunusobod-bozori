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

function sessionStore(key) {
  return {
    get() {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
    },
    set(value) {
      try {
        if (value) localStorage.setItem(key, JSON.stringify(value));
        else localStorage.removeItem(key);
      } catch {}
    }
  };
}

export const staffSession = sessionStore('staff_session');
export const adminSession = sessionStore('admin_session');

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

// Same pattern for workers (aravachi, taksichi, pattachi) and the bozorkom
async function tokenFetch(path, session, header, event, options = {}) {
  const current = session.get();
  const headers = { ...(options.headers || {}) };
  if (current?.token) headers[header] = current.token;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    session.set(null);
    window.dispatchEvent(new Event(event));
  }
  if (!res.ok) throw await readError(res, 'Request failed');
  return res.json();
}

const staffFetch = (path, options) => tokenFetch(path, staffSession, 'x-staff-token', 'staff-signed-out', options);
const adminFetch = (path, options) => tokenFetch(path, adminSession, 'x-admin-token', 'admin-signed-out', options);
const json = (method, body) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  async getConfig() {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw await readError(res, 'Failed to load settings');
    return res.json();
  },

  // Workers
  async staffRegister(data) {
    const res = await fetch(`${API_BASE}/staff/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...tgHeaders() }, body: JSON.stringify(data)
    });
    if (!res.ok) throw await readError(res, 'Registration failed');
    return res.json();
  },
  async staffLogin(phone, pin) {
    const res = await fetch(`${API_BASE}/staff/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...tgHeaders() }, body: JSON.stringify({ phone, pin })
    });
    if (!res.ok) throw await readError(res, 'Login failed');
    return res.json();
  },
  porterOrders: () => staffFetch('/porter/orders'),
  porterTake: (orderId) => staffFetch(`/porter/orders/${orderId}/take`, json('POST', {})),
  porterPicked: (itemId, isPicked) => staffFetch(`/porter/items/${itemId}/picked`, json('PATCH', { is_picked: isPicked })),
  porterStatus: (orderId, status) => staffFetch(`/porter/orders/${orderId}/status`, json('PATCH', { status })),
  porterRelease: (orderId) => staffFetch(`/porter/orders/${orderId}/release`, json('POST', {})),
  taxiOrders: () => staffFetch('/taxi/orders'),
  taxiTake: (orderId) => staffFetch(`/taxi/orders/${orderId}/take`, json('POST', {})),
  taxiStatus: (orderId, status) => staffFetch(`/taxi/orders/${orderId}/status`, json('PATCH', { status })),
  pattaToday: () => staffFetch('/patta/today'),
  pattaPay: (storeId, amount) => staffFetch(`/patta/${storeId}`, json('POST', { amount })),
  pattaUndo: (storeId) => staffFetch(`/patta/${storeId}`, { method: 'DELETE' }),

  // Bozorkom
  async adminLogin(pin) {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...tgHeaders() }, body: JSON.stringify({ pin })
    });
    if (!res.ok) throw await readError(res, 'Login failed');
    return res.json();
  },
  adminOverview: () => adminFetch('/admin/overview'),
  adminStores: () => adminFetch('/admin/stores'),
  adminStoreStatus: (id, status) => adminFetch(`/admin/stores/${id}/status`, json('POST', { status })),
  adminStorePin: (id, pin) => adminFetch(`/admin/stores/${id}/reset-pin`, json('POST', { pin })),
  adminStaff: () => adminFetch('/admin/staff'),
  adminStaffStatus: (id, status) => adminFetch(`/admin/staff/${id}/status`, json('POST', { status })),
  adminStaffPin: (id, pin) => adminFetch(`/admin/staff/${id}/reset-pin`, json('POST', { pin })),
  adminOrders: () => adminFetch('/admin/orders'),
  adminCancelOrder: (id) => adminFetch(`/admin/orders/${id}/cancel`, json('POST', {})),
  adminPatta: (day) => adminFetch(`/admin/patta${day ? `?day=${day}` : ''}`),
  adminSettings: (values) => adminFetch('/admin/settings', json('PUT', values)),

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

  async registerStore(storeData) {
    const res = await fetch(`${API_BASE}/seller/register-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tgHeaders() },
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

  // Market stats
  async getMarketStats() {
    const res = await fetch(`${API_BASE}/stats/summary`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  }
};
