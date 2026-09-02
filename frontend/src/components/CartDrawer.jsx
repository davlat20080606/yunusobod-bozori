import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, AlertTriangle } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { formatUnit } from './ProductCard';

export default function CartDrawer({ 
  isOpen, 
  onClose, 
  cart, 
  onUpdateQuantity, 
  onRemoveItem, 
  onCheckout, 
  pickerNotes, 
  setPickerNotes 
}) {
  const { getLocalized, t, language } = useLanguage();
  const [itemToDelete, setItemToDelete] = useState(null);

  if (!isOpen) return null;

  const currencyLabel = language === 'ru' ? 'сум' : (language === 'en' ? 'UZS' : 'so\'m');
  const itemsTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const deliveryFee = cart.length > 0 ? 15000 : 0;
  const grandTotal = itemsTotal + deliveryFee;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel animate-fade" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#065f46' }}>
              <ShoppingBag size={18} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              {t('cart.title')} ({cart.length})
            </h3>
          </div>
          <button 
            type="button" 
            className="close-btn" 
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Items List */}
        <div className="modal-body">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛒</div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{t('cart.empty_title')}</h4>
              <p style={{ fontSize: '0.85rem', marginTop: '6px', color: '#64748b' }}>{t('cart.empty_desc')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cart.map(({ product, quantity }) => {
                const itemTotal = (product.price * quantity).toLocaleString();
                const step = product.step_weight || 0.5;
                const min = product.min_weight || 0.5;
                const displayUnit = formatUnit(product.unit, language);

                return (
                  <div key={product.id} className="cart-item-card">
                    {/* Fixed size Thumbnail Image */}
                    <img 
                      src={product.image_url || "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=120&auto=format&fit=crop&q=80"} 
                      alt={getLocalized(product, 'name')}
                      className="cart-item-thumb"
                    />
                    
                    {/* Details */}
                    <div className="cart-item-details">
                      <h5 className="cart-item-title">
                        {getLocalized(product, 'name')}
                      </h5>
                      <div className="cart-item-unit-price">
                        {product.price.toLocaleString()} {currencyLabel} / {displayUnit}
                      </div>
                      <div className="cart-item-subtotal">
                        = {itemTotal} {currencyLabel}
                      </div>
                    </div>

                    {/* Quantity Controller & Delete */}
                    <div className="cart-item-ctrls">
                      <button 
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setItemToDelete(product);
                        }}
                        className="cart-delete-btn"
                        title={language === 'ru' ? 'Удалить' : (language === 'en' ? 'Delete' : 'O\'chirish')}
                      >
                        <Trash2 size={15} />
                      </button>

                      <div className="cart-stepper-box">
                        <button 
                          type="button"
                          className="cart-stepper-btn"
                          onClick={() => {
                            triggerHaptic('light');
                            if (quantity <= min) {
                              setItemToDelete(product);
                            } else {
                              onUpdateQuantity(product.id, -1);
                            }
                          }}
                        >
                          <Minus size={12} />
                        </button>
                        
                        <span className="cart-stepper-val">
                          {quantity} {displayUnit}
                        </span>

                        <button 
                          type="button"
                          className="cart-stepper-btn"
                          onClick={() => {
                            triggerHaptic('light');
                            onUpdateQuantity(product.id, 1);
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
              <div style={{ marginTop: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  {t('cart.notes_placeholder')}
                </label>
                <textarea 
                  className="form-input"
                  rows="2"
                  placeholder={t('cart.notes_placeholder')}
                  value={pickerNotes}
                  onChange={(e) => setPickerNotes(e.target.value)}
                  style={{ resize: 'none', height: 'auto', padding: '8px 12px', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {cart.length > 0 && (
          <div className="modal-footer">
            <div className="cart-summary-line">
              <span>{t('cart.total')}</span>
              <span className="cart-summary-val">{itemsTotal.toLocaleString()} {currencyLabel}</span>
            </div>
            <div className="cart-summary-line">
              <span>{t('cart.delivery_fee')}</span>
              <span className="cart-summary-val highlight">{deliveryFee.toLocaleString()} {currencyLabel}</span>
            </div>
            
            <div className="cart-summary-total-line">
              <span>{t('cart.grand_total')}</span>
              <span>{grandTotal.toLocaleString()} {currencyLabel}</span>
            </div>

            <button 
              type="button"
              className="add-cart-btn"
              onClick={() => {
                triggerHaptic('medium');
                onCheckout();
              }}
            >
              <span>{t('cart.checkout_btn')}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

      </div>

      {/* Delete Item Confirmation Dialog */}
      {itemToDelete && (
        <div 
          className="modal-center-backdrop" 
          style={{ zIndex: 1200, background: 'rgba(15, 23, 42, 0.7)' }} 
          onClick={() => setItemToDelete(null)}
        >
          <div 
            className="modal-center-card animate-scale" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '380px', 
              width: '90%', 
              padding: '24px', 
              textAlign: 'center', 
              borderRadius: '22px',
              background: '#ffffff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div 
              style={{ 
                width: '52px', 
                height: '52px', 
                borderRadius: '50%', 
                background: '#fee2e2', 
                color: '#ef4444', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 14px' 
              }}
            >
              <Trash2 size={24} />
            </div>

            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              {language === 'ru' ? 'Удалить из корзины?' : (language === 'en' ? 'Remove from cart?' : 'Savatdan o\'chirasizmi?')}
            </h4>

            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '22px', lineHeight: 1.45 }}>
              <strong style={{ color: '#0f172a' }}>«{getLocalized(itemToDelete, 'name')}»</strong> {language === 'ru' ? 'будет удален из вашего заказа.' : (language === 'en' ? 'will be removed from your order.' : 'buyurtmangizdan olib tashlanadi.')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                style={{
                  height: '44px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {language === 'ru' ? 'Отмена' : (language === 'en' ? 'Cancel' : 'Bekor qilish')}
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onRemoveItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                style={{
                  height: '44px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                {language === 'ru' ? 'Да, удалить' : (language === 'en' ? 'Yes, delete' : 'Ha, o\'chirish')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
