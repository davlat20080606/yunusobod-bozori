const API_BASE = '/api';

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to place order');
    }
    return res.json();
  },

  async getOrder(orderNumber) {
    if (!orderNumber) throw new Error('Order number required');
    const cleanNum = String(orderNumber).replace(/^#/, '').trim();
    const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(cleanNum)}`);
    if (!res.ok) throw new Error('Order not found');
    return res.json();
  },

  async getOrders(limit = 10) {
    const res = await fetch(`${API_BASE}/orders?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  },

  async updateOrderStatus(orderId, status) {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return res.json();
  },

  // Seller API
  async sellerLogin(phone_or_slug, pin) {
    const res = await fetch(`${API_BASE}/seller/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_or_slug, pin })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/seller/upload-media`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      throw new Error('Media upload failed');
    }
    return res.json();
  },

  async createProduct(storeId, productData) {
    const res = await fetch(`${API_BASE}/seller/stores/${storeId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create product');
    }
    return res.json();
  },

  async updateStoreProfile(storeId, storeData) {
    const res = await fetch(`${API_BASE}/seller/stores/${storeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update store profile');
    }
    return res.json();
  },

  async registerStore(storeData) {
    const res = await fetch(`${API_BASE}/seller/register-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to register store');
    }
    return res.json();
  },

  async getAvailableSellerStores() {
    const res = await fetch(`${API_BASE}/seller/stores/list`);
    if (!res.ok) throw new Error('Failed to fetch seller stores');
    return res.json();
  },

  async getMyStoreDashboard(storeId) {
    const res = await fetch(`${API_BASE}/seller/my-store/${storeId}`);
    if (!res.ok) throw new Error('Failed to fetch store dashboard');
    return res.json();
  },

  async updateProductPrice(productId, price, old_price = null) {
    const res = await fetch(`${API_BASE}/seller/products/${productId}/price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price, old_price })
    });
    if (!res.ok) throw new Error('Failed to update price');
    return res.json();
  },

  async toggleProductAvailability(productId, is_available) {
    const res = await fetch(`${API_BASE}/seller/products/${productId}/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available })
    });
    return res.json();
  },

  async toggleStoreStatus(storeId) {
    const res = await fetch(`${API_BASE}/seller/stores/${storeId}/toggle-status`, {
      method: 'PATCH'
    });
    return res.json();
  },

  async getStoreOrders(storeId) {
    const res = await fetch(`${API_BASE}/seller/orders/${storeId}`);
    if (!res.ok) return [];
    return res.json();
  },

  // Porter (aravachi) API
  async porterRequest(method, path, pin, porterPhone, body) {
    const headers = { 'Content-Type': 'application/json', 'x-porter-pin': pin };
    if (porterPhone) headers['x-porter-phone'] = porterPhone;
    const res = await fetch(`${API_BASE}/porter${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || 'Request failed');
      error.status = res.status;
      throw error;
    }
    return res.json();
  },

  async porterLogin(pin) {
    return api.porterRequest('POST', '/login', pin, null, { pin });
  },

  async porterGetOrders(pin, porterPhone) {
    return api.porterRequest('GET', `/orders?porter_phone=${encodeURIComponent(porterPhone)}`, pin);
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
