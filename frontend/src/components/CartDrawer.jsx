import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function CartDrawer({ isOpen, onClose, cart, onUpdateQty, onRemoveItem, onProceedCheckout, notes, setNotes }) {
  const { getLocalized, t } = useLanguage();

  if (!isOpen) return null;

  const itemsTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const deliveryFee = cart.length > 0 ? 15000 : 0;
  const grandTotal = itemsTotal + deliveryFee;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} color="#064e3b" />
            <h3>{t('cart.title')} ({cart.length})</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Items List */}
        <div className="modal-body">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛒</div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{t('cart.empty_title')}</h4>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>{t('cart.empty_desc')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cart.map(({ product, quantity }) => {
                const itemTotal = (product.price * quantity).toLocaleString();
                const step = product.step_weight || 0.5;
                const min = product.min_weight || 0.5;

                return (
                  <div 
                    key={product.id}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      alignItems: 'center'
                    }}
                  >
                    <img 
                      src={product.image_url} 
                      alt={getLocalized(product, 'name')}
                      style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover' }}
                    />
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5 style={{ fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getLocalized(product, 'name')}
                      </h5>
                      <div style={{ fontSize: '0.78rem', color: '#064e3b', fontWeight: 700, marginTop: '2px' }}>
                        {product.price.toLocaleString()} UZS / {product.unit}
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        = {itemTotal} UZS
                      </div>
                    </div>

                    {/* Qty controller in cart */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <button 
                        onClick={() => {
                          triggerHaptic('light');
                          onRemoveItem(product.id);
                        }}
                        style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', borderRadius: '6px', padding: '2px', border: '1px solid #cbd5e1' }}>
                        <button 
                          style={{ border: 'none', background: 'transparent', width: '22px', height: '22px', cursor: 'pointer', fontWeight: 700 }}
                          onClick={() => {
                            triggerHaptic('light');
                            if (quantity > min) onUpdateQty(product.id, +(quantity - step).toFixed(2));
                            else onRemoveItem(product.id);
                          }}
                        >
                          <Minus size={12} />
                        </button>
                        
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>
                          {quantity} {product.unit}
                        </span>

                        <button 
                          style={{ border: 'none', background: 'transparent', width: '22px', height: '22px', cursor: 'pointer', fontWeight: 700 }}
                          onClick={() => {
                            triggerHaptic('light');
                            onUpdateQty(product.id, +(quantity + step).toFixed(2));
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Notes to picker */}
              <div style={{ marginTop: '10px' }}>
                <label className="form-label">{t('cart.notes_placeholder')}</label>
                <textarea 
                  className="form-input"
                  rows="2"
                  placeholder={t('cart.notes_placeholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ resize: 'none' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {cart.length > 0 && (
          <div className="modal-footer">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: '#64748b' }}>
              <span>{t('cart.total')}</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{itemsTotal.toLocaleString()} UZS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '12px', color: '#64748b' }}>
              <span>{t('cart.delivery_fee')}</span>
              <span style={{ fontWeight: 700, color: '#059669' }}>{deliveryFee.toLocaleString()} UZS</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, marginBottom: '16px', color: '#064e3b', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
              <span>{t('cart.grand_total')}</span>
              <span>{grandTotal.toLocaleString()} UZS</span>
            </div>

            <button 
              className="add-cart-btn"
              onClick={() => {
                triggerHaptic('medium');
                onProceedCheckout();
              }}
              style={{ height: '48px', fontSize: '0.95rem' }}
            >
              <span>{t('cart.checkout_btn')}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
