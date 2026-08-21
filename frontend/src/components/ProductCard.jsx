import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ShoppingCart, Check, Plus, Minus, Sparkles, Play, Film } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function ProductCard({ product, onAddToCart, onOpenMediaModal }) {
  const { getLocalized, t } = useLanguage();
  const [quantity, setQuantity] = useState(product.min_weight || 1.0);
  const [isAdded, setIsAdded] = useState(false);

  const step = product.step_weight || 0.5;
  const min = product.min_weight || 0.5;

  const handleIncrement = () => {
    triggerHaptic('light');
    setQuantity((prev) => +(prev + step).toFixed(2));
  };

  const handleDecrement = () => {
    if (quantity > min) {
      triggerHaptic('light');
      setQuantity((prev) => +(prev - step).toFixed(2));
    }
  };

  const handleAdd = () => {
    triggerHaptic('medium');
    onAddToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1200);
  };

  const getBadgeLabel = (badgeKey) => {
    if (!badgeKey) return null;
    return t(`products.badge_${badgeKey}`) || badgeKey;
  };

  const totalPrice = (product.price * quantity).toLocaleString();

  return (
    <div className="product-card animate-fade">
      {/* Product Image & Video Trigger */}
      <div 
        className="product-img-wrap"
        onClick={() => {
          triggerHaptic('medium');
          if (onOpenMediaModal) onOpenMediaModal(product);
        }}
        style={{ cursor: 'pointer' }}
      >
        <img 
          src={product.image_url || "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&auto=format&fit=crop&q=80"} 
          alt={getLocalized(product, 'name')}
          loading="lazy"
        />
        
        {product.badge && (
          <div className="product-badge">
            ✨ {getBadgeLabel(product.badge)}
          </div>
        )}

        {/* Video Reel Badge */}
        {product.video_url && (
          <div 
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
            }}
          >
            <Play size={10} fill="#ffffff" />
            <span>Video Reel</span>
          </div>
        )}
      </div>

      <div className="product-content">
        <h4 
          className="product-title"
          onClick={() => {
            if (onOpenMediaModal) onOpenMediaModal(product);
          }}
          style={{ cursor: 'pointer' }}
        >
          {getLocalized(product, 'name')}
        </h4>
        <p className="product-desc">{getLocalized(product, 'description')}</p>

        <div className="product-price-row">
          <span className="current-price">{product.price.toLocaleString()} UZS</span>
          <span className="price-unit">/ {product.unit}</span>
          {product.old_price && (
            <span className="old_price">{product.old_price.toLocaleString()} UZS</span>
          )}
        </div>

        {/* Weight / Qty Selector */}
        <div className="qty-controller">
          <button 
            className="qty-btn" 
            onClick={handleDecrement}
            disabled={quantity <= min}
            style={{ opacity: quantity <= min ? 0.4 : 1 }}
          >
            <Minus size={14} />
          </button>
          
          <div className="qty-display">
            {quantity} {product.unit}
          </div>

          <button className="qty-btn" onClick={handleIncrement}>
            <Plus size={14} />
          </button>
        </div>

        {/* Add button */}
        <button 
          className={`add-cart-btn ${isAdded ? 'added' : ''}`}
          onClick={handleAdd}
          disabled={!product.is_available}
        >
          {isAdded ? (
            <>
              <Check size={16} />
              <span>{t('products.added')}</span>
            </>
          ) : (
            <>
              <ShoppingCart size={16} />
              <span>{t('products.add_to_cart')} ({totalPrice} UZS)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
