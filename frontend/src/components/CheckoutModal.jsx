import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { X, CheckCircle, Clock, MapPin, CreditCard, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { triggerHaptic, getTelegramUser } from '../services/telegram';
import { api } from '../services/api';
import MapPicker from './MapPicker';
import { ClickLogo, PaymeLogo } from './PaymentLogos';

export default function CheckoutModal({ isOpen, onClose, cart = [], notes = '', grandTotal, onSubmitOrder, onOrderSuccess, pickerNotes = '' }) {
  const { t, language } = useLanguage();
  const tgUser = getTelegramUser();

  const [customerName, setCustomerName] = useState(
    tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : ''
  );
  const [customerPhone, setCustomerPhone] = useState('+998 ');
  const [district, setDistrict] = useState('Yunusobod');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  // The bazaar works 06:00–20:00 Tashkent time (UTC+5): offer only slots that can still be delivered
  const tashkentHour = ((new Date().getUTCHours() + 5) % 24) + new Date().getUTCMinutes() / 60;
  const slots = [
    { id: 'Express (45-60 min)', label: t('checkout.time_express'), open: tashkentHour >= 6 && tashkentHour < 19 },
    { id: 'Evening (18:00-20:00)', label: t('checkout.time_evening'), open: tashkentHour < 19 },
    { id: 'Morning (09:00-11:00)', label: t('checkout.time_morning'), open: true }
  ];
  const [timeSlot, setTimeSlot] = useState(() => slots.find((s) => s.open).id);
  const [paymentMethod, setPaymentMethod] = useState('click');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [zone, setZone] = useState({ bazaar: { lat: 41.36467, lng: 69.29089 }, delivery_radius_km: 3 });
  const radiusKm = zone.delivery_radius_km;

  // The bozorkom can change the radius, so read it from the server
  useEffect(() => {
    if (isOpen) api.getConfig().then(setZone).catch(() => {});
  }, [isOpen]);

  const itemsTotal = cart.reduce((sum, item) => sum + ((item.product?.price || 0) * (item.quantity || 1)), 0);
  const finalGrandTotal = (grandTotal !== undefined && grandTotal !== null) ? grandTotal : (itemsTotal + 15000);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || customerPhone.trim().length < 9 || !address.trim()) {
      setError(language === 'ru' ? 'Пожалуйста, заполните имя, телефон и адрес' : "Iltimos, ism, telefon va manzilni to'liq kiriting!");
      triggerHaptic('error');
      return;
    }
    if (!deliveryCoords) {
      setError(language === 'ru' ? 'Отметьте дом на карте' : (language === 'en' ? 'Mark your home on the map' : 'Uyingizni xaritada belgilang'));
      triggerHaptic('error');
      setShowMap(true);
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
      delivery_lat: deliveryCoords?.lat ?? null,
      delivery_lng: deliveryCoords?.lng ?? null,
      notes: notes || pickerNotes,
      items: cart.map(i => ({
        product_id: i.product.id,
        store_id: i.product.store_id,
        quantity: i.quantity
      }))
    };

    try {
      let order;
      if (onSubmitOrder) {
        order = await onSubmitOrder(orderPayload);
      } else {
        order = await api.createOrder(orderPayload);
      }

      triggerHaptic('success');
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
      
      if (onOrderSuccess) {
        onOrderSuccess(order?.order_number || order?.id || 'YB-1001');
      } else {
        onClose();
      }
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
                {[
                  { id: 'Yunusobod', uz: 'Yunusobod tumani', ru: 'Юнусабадский район', en: 'Yunusobod District' },
                  { id: "Mirzo Ulug'bek", uz: "Mirzo Ulug'bek tumani", ru: 'Мирзо-Улугбекский район', en: "Mirzo Ulug'bek District" },
                  { id: 'Shayxontohur', uz: 'Shayxontohur tumani', ru: 'Шайхантахурский район', en: 'Shaykhantakhur District' },
                  { id: 'Olmazor', uz: 'Olmazor tumani', ru: 'Алмазарский район', en: 'Olmazor District' },
                  { id: 'Chilonzor', uz: 'Chilonzor tumani', ru: 'Чиланзарский район', en: 'Chilanzar District' },
                  { id: 'Yakkasaroy', uz: 'Yakkasaroy tumani', ru: 'Яккасарайский район', en: 'Yakkasaray District' },
                  { id: 'Mirobod', uz: 'Mirobod tumani', ru: 'Мирабадский район', en: 'Mirabad District' },
                ].map(d => (
                  <option key={d.id} value={d.id}>
                    {language === 'ru' ? d.ru : (language === 'en' ? d.en : d.uz)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('checkout.address')} *</label>
              {/* The map point is required: it checks the 3 km zone and guides the porter and taxi */}
              <button
                type="button"
                onClick={() => setShowMap(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  padding: '12px 14px', borderRadius: 12, cursor: 'pointer', marginBottom: 8,
                  border: deliveryCoords ? '1.5px solid #10b981' : '1.5px dashed #f59e0b',
                  background: deliveryCoords ? '#f0fdf4' : '#fffbeb'
                }}
              >
                <MapPin size={20} color={deliveryCoords ? '#059669' : '#d97706'} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                  {deliveryCoords
                    ? (language === 'ru' ? '✅ Точка на карте выбрана — изменить' : (language === 'en' ? '✅ Map point set — change' : "✅ Xaritada belgilandi — o'zgartirish"))
                    : (language === 'ru' ? `Отметьте дом на карте (доставка до ${radiusKm} км от базара)` : (language === 'en' ? `Mark your home on the map (within ${radiusKm} km of the bazaar)` : `Uyingizni xaritada belgilang (bozordan ${radiusKm} km gacha)`))}
                </span>
              </button>
              <input 
                type="text" 
                className="form-input" 
                placeholder={t('checkout.address_placeholder')}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            {/* Map Picker Modal */}
            {showMap && (
              <MapPicker
                language={language}
                onAddressSelect={(addr, coords) => {
                  setAddress(addr);
                  setDeliveryCoords(coords || null);
                  setShowMap(false);
                }}
                onClose={() => setShowMap(false)}
                bazaar={zone.bazaar}
                radiusKm={radiusKm}
              />
            )}


            {/* Delivery Time Slot */}
            <div className="form-group">
              <label className="form-label">{t('checkout.time_slot')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {slots.filter((slot) => slot.open).map(slot => (
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {[
                  { id: 'click', label: 'Click', icon: CreditCard },
                  { id: 'payme', label: 'Payme', icon: CreditCard },
                ].map(pay => (
                  <button
                    key={pay.id}
                    type="button"
                    onClick={() => setPaymentMethod(pay.id)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '10px',
                      border: `1.5px solid ${paymentMethod === pay.id ? '#16a34a' : '#e2e8f0'}`,
                      background: paymentMethod === pay.id ? '#f0fdf4' : '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '44px',
                      boxShadow: paymentMethod === pay.id ? '0 2px 6px rgba(22, 163, 74, 0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {pay.id === 'click' ? (
                      <ClickLogo height={16} color="blue" />
                    ) : pay.id === 'payme' ? (
                      <PaymeLogo height={16} variant="color" />
                    ) : (
                      pay.label
                    )}
                  </button>
                ))}
              </div>

            </div>
          </div>

          <div className="modal-footer">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '1.1rem', fontWeight: 800, color: '#064e3b' }}>
              <span>{t('cart.grand_total')}</span>
              <span>{(finalGrandTotal || 0).toLocaleString()} UZS</span>
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
