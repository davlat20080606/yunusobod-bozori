import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { X, CheckCircle, Clock, MapPin, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { triggerHaptic, getTelegramUser } from '../services/telegram';

export default function CheckoutModal({ isOpen, onClose, cart, notes, grandTotal, onSubmitOrder }) {
  const { t } = useLanguage();
  const tgUser = getTelegramUser();

  const [customerName, setCustomerName] = useState(
    tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : ''
  );
  const [customerPhone, setCustomerPhone] = useState('+998 ');
  const [district, setDistrict] = useState('Yunusobod');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [timeSlot, setTimeSlot] = useState('Express (45-60 min)');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || customerPhone.trim().length < 9 || !address.trim()) {
      setError('Iltimos, ism, telefon va manzilni to\'liq kiriting!');
      triggerHaptic('error');
      return;
    }

    setLoading(true);
    setError('');

    const orderPayload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_tg_id: tgUser ? String(tgUser.id) : null,
      customer_tg_username: tgUser?.username || null,
      delivery_district: district,
      delivery_address: address,
      landmark: landmark,
      delivery_time_slot: timeSlot,
      payment_method: paymentMethod,
      notes: notes,
      items: cart.map(i => ({
        product_id: i.product.id,
        store_id: i.product.store_id,
        quantity: i.quantity
      }))
    };

    try {
      const order = await onSubmitOrder(orderPayload);
      triggerHaptic('success');
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-center-backdrop" onClick={onClose}>
      <div className="modal-center-card animate-scale" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} color="#064e3b" />
            <h3>{t('checkout.title')}</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '14px' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Name & Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">{t('checkout.name')} *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={t('checkout.name_placeholder')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('checkout.phone')} *</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  placeholder="+998 90 123-45-67"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* District & Address */}
            <div className="form-group">
              <label className="form-label">{t('checkout.district')}</label>
              <select 
                className="form-select"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="Yunusobod">Yunusobod tumani</option>
                <option value="Mirzo Ulug'bek">Mirzo Ulug'bek tumani</option>
                <option value="Shayxontohur">Shayxontohur tumani</option>
                <option value="Olmazor">Olmazor tumani</option>
                <option value="Chilonzor">Chilonzor tumani</option>
                <option value="Yakkasaroy">Yakkasaroy tumani</option>
                <option value="Mirobod">Mirobod tumani</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('checkout.address')} *</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder={t('checkout.address_placeholder')}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('checkout.landmark')}</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder={t('checkout.landmark_placeholder')}
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
              />
            </div>

            {/* Delivery Time Slot */}
            <div className="form-group">
              <label className="form-label">{t('checkout.time_slot')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { id: 'Express (45-60 min)', label: t('checkout.time_express') },
                  { id: 'Evening (18:00-20:00)', label: t('checkout.time_evening') },
                  { id: 'Morning (09:00-11:00)', label: t('checkout.time_morning') }
                ].map(slot => (
                  <label 
                    key={slot.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `1.5px solid ${timeSlot === slot.id ? '#10b981' : '#e2e8f0'}`,
                      background: timeSlot === slot.id ? '#ecfdf5' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: 600
                    }}
                  >
                    <input 
                      type="radio" 
                      name="timeSlot" 
                      checked={timeSlot === slot.id}
                      onChange={() => setTimeSlot(slot.id)}
                    />
                    <span>{slot.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label className="form-label">{t('checkout.payment')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'cash', label: '💵 Naqd / Karta', icon: Banknote },
                  { id: 'click', label: '🔵 Click', icon: CreditCard },
                  { id: 'payme', label: '🟢 Payme', icon: CreditCard },
                ].map(pay => (
                  <button
                    key={pay.id}
                    type="button"
                    onClick={() => setPaymentMethod(pay.id)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '8px',
                      border: `1.5px solid ${paymentMethod === pay.id ? '#064e3b' : '#e2e8f0'}`,
                      background: paymentMethod === pay.id ? '#d1fae5' : '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {pay.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '1.1rem', fontWeight: 800, color: '#064e3b' }}>
              <span>{t('cart.grand_total')}</span>
              <span>{grandTotal.toLocaleString()} UZS</span>
            </div>

            <button 
              type="submit" 
              className="add-cart-btn"
              disabled={loading}
              style={{ height: '48px', fontSize: '0.95rem' }}
            >
              {loading ? t('checkout.processing') : `🛍️ ${t('checkout.submit')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
