import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { X, Play, Volume2, VolumeX, ShoppingCart, Plus, Minus, Check, Sparkles, Film, Image as ImageIcon } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function ProductMediaModal({ isOpen, onClose, product, onAddToCart }) {
  const { getLocalized, t } = useLanguage();
  const [activeMedia, setActiveMedia] = useState(product?.video_url ? 'video' : 'photo');
  const [isMuted, setIsMuted] = useState(true);
  const [quantity, setQuantity] = useState(product?.min_weight || 1.0);
  const [isAdded, setIsAdded] = useState(false);

  if (!isOpen || !product) return null;

  const step = product.step_weight || 0.5;
  const min = product.min_weight || 0.5;

  const handleIncrement = () => {
    triggerHaptic('light');
    setQuantity(prev => +(prev + step).toFixed(2));
  };

  const handleDecrement = () => {
    if (quantity > min) {
      triggerHaptic('light');
      setQuantity(prev => +(prev - step).toFixed(2));
    }
  };

  const handleAdd = () => {
    triggerHaptic('medium');
    onAddToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1200);
  };

  const totalPrice = (product.price * quantity).toLocaleString();

  return (
    <div className="modal-center-backdrop" onClick={onClose}>
      <div 
        className="modal-center-card animate-scale" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px', borderRadius: '24px', overflow: 'hidden' }}
      >
        {/* Media Container (Video / Photo) */}
        <div style={{ position: 'relative', height: '320px', background: '#000000', overflow: 'hidden' }}>
          {activeMedia === 'video' && product.video_url ? (
            <video 
              src={product.video_url}
              autoPlay
              loop
              playsInline
              muted={isMuted}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <img 
              src={product.image_url} 
              alt={getLocalized(product, 'name')}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}

          {/* Close button */}
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            <X size={18} />
          </button>

          {/* Video / Photo Tab Switcher */}
          {product.video_url && (
            <div 
              style={{
                position: 'absolute',
                bottom: '14px',
                left: '14px',
                display: 'flex',
                gap: '6px',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                padding: '3px',
                borderRadius: '20px',
                zIndex: 10
              }}
            >
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveMedia('photo');
                }}
                style={{
                  background: activeMedia === 'photo' ? '#10b981' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <ImageIcon size={13} />
                <span>Rasm (Photo)</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveMedia('video');
                }}
                style={{
                  background: activeMedia === 'video' ? '#10b981' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Film size={13} />
                <span>Video Reel</span>
              </button>
            </div>
          )}

          {/* Sound Toggle Button (if video) */}
          {activeMedia === 'video' && product.video_url && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              style={{
                position: 'absolute',
                bottom: '14px',
                right: '14px',
                background: 'rgba(0,0,0,0.6)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          )}
        </div>

        {/* Product Details & Actions */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {getLocalized(product, 'name')}
              </h3>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#064e3b' }}>
                {product.price.toLocaleString()} UZS
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              Bozor narxi / {product.unit}
            </div>
          </div>

          <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.45' }}>
            {getLocalized(product, 'description')}
          </p>

          {/* Weight selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-subtle)', padding: '6px 12px', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
              Miqdor / Vazn:
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                className="qty-btn" 
                onClick={handleDecrement}
                disabled={quantity <= min}
                style={{ opacity: quantity <= min ? 0.4 : 1 }}
              >
                <Minus size={14} />
              </button>
              
              <span style={{ fontWeight: 800, color: '#064e3b', minWidth: '55px', textAlign: 'center' }}>
                {quantity} {product.unit}
              </span>

              <button className="qty-btn" onClick={handleIncrement}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Add to Cart button */}
          <button 
            className={`add-cart-btn ${isAdded ? 'added' : ''}`}
            onClick={handleAdd}
            style={{ height: '48px', fontSize: '0.95rem', borderRadius: '12px' }}
          >
            {isAdded ? (
              <>
                <Check size={18} />
                <span>{t('products.added')}!</span>
              </>
            ) : (
              <>
                <ShoppingCart size={18} />
                <span>{t('products.add_to_cart')} • {totalPrice} UZS</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
