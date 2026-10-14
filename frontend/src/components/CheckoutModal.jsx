import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { X, CheckCircle, Clock, MapPin, CreditCard, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { triggerHaptic, getTelegramUser, requestPhone } from '../services/telegram';
import { api } from '../services/api';
import MapPicker, { distanceKm } from './MapPicker';
import { getCurrentPosition, reverseGeocode, loadAddresses, rememberAddress } from '../services/location';
import { ClickLogo, PaymeLogo } from './PaymentLogos';

export default function CheckoutModal({ isOpen, onClose, cart = [], notes = '', grandTotal, onSubmitOrder, onOrderSuccess, pickerNotes = '' }) {
  const { t, language } = useLanguage();
  const tgUser = getTelegramUser();

  const [customerName, setCustomerName] = useState(
    tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : ''
  );
  const [customerPhone, setCustomerPhone] = useState('+998 ');
  // Address: one tap (GPS / map / saved), then only entrance, floor and apartment
  const [place, setPlace] = useState(null); // { main, details, district, lat, lng }
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [landmark, setLandmark] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
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
  const [zone, setZone] = useState({ bazaar: { lat: 41.36467, lng: 69.29089 }, delivery_radius_km: 3 });
  const radiusKm = zone.delivery_radius_km;

  // The bozorkom can change the radius, so read it from the server
  useEffect(() => {
    if (isOpen) api.getConfig().then(setZone).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    // Like Yandex Go: the last address is already chosen, the user only checks it
    if (isOpen) loadAddresses().then((list) => {
      setSavedAddresses(list);
      if (list[0] && !place) applyPlace(list[0]);
    }).catch(() => {});
  }, [isOpen]);

  const deliveryCoords = place ? { lat: place.lat, lng: place.lng } : null;
  const placeDistance = place ? distanceKm(zone.bazaar, place) : null;

  const applyPlace = (p) => {
    setPlace(p);
    setLocateError('');
    if (p.entrance !== undefined) setEntrance(p.entrance || '');
    if (p.floor !== undefined) setFloor(p.floor || '');
    if (p.apartment !== undefined) setApartment(p.apartment || '');
    if (p.landmark !== undefined) setLandmark(p.landmark || '');
  };

  const locateMe = async () => {
    triggerHaptic('light');
    setLocating(true);
    setLocateError('');
    const pos = await getCurrentPosition();
    if (!pos) {
      setLocating(false);
      setLocateError(language === 'ru' ? 'Не удалось определить местоположение — выберите на карте' : (language === 'en' ? 'Could not get your location — pick it on the map' : "Joylashuvni aniqlab bo'lmadi — xaritadan tanlang"));
      return;
    }
    const found = await reverseGeocode(pos.lat, pos.lng, language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz'));
    setLocating(false);
    applyPlace({ main: found?.main || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`, details: found?.details || '', district: found?.district || 'Yunusobod', ...pos });
    triggerHaptic('success');
  };

  // Like Evos / Bellissimo: the phone and name come from the bot registration, not from this form
  const [profile, setProfile] = useState(null);
  const [phoneRequesting, setPhoneRequesting] = useState(false);
  useEffect(() => {
    if (isOpen) api.getMe().then(setProfile).catch(() => setProfile({ in_telegram: false, registered: false }));
  }, [isOpen]);
  const registered = Boolean(profile?.registered);
  const askPhoneInApp = profile?.in_telegram && !registered;

  const sharePhone = () => {
    const started = requestPhone((sent) => {
      if (!sent) return;
      setPhoneRequesting(true);
      // The bot receives the contact a moment later; check a few times
      let tries = 0;
      const timer = setInterval(async () => {
        tries += 1;
        const me = await api.getMe().catch(() => null);
        if (me?.registered || tries > 10) {
          clearInterval(timer);
          setPhoneRequesting(false);
          if (me) setProfile(me);
        }
      }, 1500);
    });
    if (!started) setProfile({ ...profile, in_telegram: false });
  };

  const itemsTotal = cart.reduce((sum, item) => sum + ((item.product?.price || 0) * (item.quantity || 1)), 0);
  const finalGrandTotal = (grandTotal !== undefined && grandTotal !== null) ? grandTotal : (itemsTotal + 15000);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!registered && (!customerName.trim() || customerPhone.replace(/\D/g, '').length < 9)) {
      setError(language === 'ru' ? 'Пожалуйста, заполните имя, телефон и адрес' : "Iltimos, ism, telefon va manzilni to'liq kiriting!");
      triggerHaptic('error');
      return;
    }
    if (askPhoneInApp) {
      setError(language === 'ru' ? 'Сначала отправьте номер телефона' : (language === 'en' ? 'Share your phone number first' : 'Avval telefon raqamingizni yuboring'));
      triggerHaptic('error');
      return;
    }
    if (placeDistance !== null && placeDistance > radiusKm) {
      setError(language === 'ru' ? `Пока доставляем только в радиусе ${radiusKm} км от базара` : (language === 'en' ? `For now we deliver only within ${radiusKm} km of the bazaar` : `Hozircha faqat bozordan ${radiusKm} km ichida yetkazamiz`));
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
      delivery_district: place?.district || 'Yunusobod',
      delivery_address: [
        place?.main,
        place?.details,
        entrance && `${language === 'ru' ? 'подъезд' : 'podyezd'} ${entrance}`,
        floor && `${language === 'ru' ? 'этаж' : 'qavat'} ${floor}`,
        apartment && `${language === 'ru' ? 'кв.' : 'xonadon'} ${apartment}`,
      ].filter(Boolean).join(', '),
      landmark: landmark.trim() || null,
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
      if (place) rememberAddress({ ...place, entrance, floor, apartment, landmark }).catch(() => {});
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

            {/* Registered in the bot: show who orders instead of asking again */}
            {registered && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #bbf7d0', marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>👤</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{profile.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>{profile.phone}</div>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'right' }}>
                  {language === 'ru' ? 'Изменить: /profile в боте' : (language === 'en' ? 'Change: /profile in the bot' : "O'zgartirish: botda /profile")}
                </span>
              </div>
            )}

            {/* Inside Telegram but not registered yet: one tap shares the phone */}
            {askPhoneInApp && (
              <button type="button" onClick={sharePhone} disabled={phoneRequesting} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', marginBottom: 14, opacity: phoneRequesting ? 0.7 : 1 }}>
                📱 {phoneRequesting
                  ? (language === 'ru' ? 'Получаем номер…' : (language === 'en' ? 'Getting your number…' : 'Raqam olinmoqda…'))
                  : (language === 'ru' ? 'Отправить номер телефона' : (language === 'en' ? 'Share phone number' : 'Telefon raqamni yuborish'))}
              </button>
            )}

            {/* Name & Phone: only outside Telegram (website in a browser) */}
            {profile && !profile.in_telegram && (
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
            )}


            <div className="form-group">
              <label className="form-label">{t('checkout.address')} *</label>

              {/* Saved addresses: next order is one tap */}
              {savedAddresses.length > 0 && !place && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {savedAddresses.map((a, idx) => (
                    <button key={idx} type="button" onClick={() => { triggerHaptic('selection'); applyPlace(a); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#ffffff', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 18 }}>{idx === 0 ? '🏠' : '📍'}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.main}</span>
                        <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[a.apartment && `${language === 'ru' ? 'кв.' : 'xonadon'} ${a.apartment}`, a.details].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* One tap: GPS or the map */}
              {!place && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button" onClick={locateMe} disabled={locating} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 8px', borderRadius: 14, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', opacity: locating ? 0.7 : 1 }}>
                    <span style={{ fontSize: 22 }}>{locating ? '⏳' : '📍'}</span>
                    {locating
                      ? (language === 'ru' ? 'Определяем…' : (language === 'en' ? 'Locating…' : 'Aniqlanmoqda…'))
                      : (language === 'ru' ? 'Моё местоположение' : (language === 'en' ? 'My location' : 'Joylashuvimni aniqlash'))}
                  </button>
                  <button type="button" onClick={() => setShowMap(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 8px', borderRadius: 14, border: '1.5px solid #10b981', background: '#f0fdf4', color: '#047857', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                    <span style={{ fontSize: 22 }}>🗺</span>
                    {language === 'ru' ? 'Выбрать на карте' : (language === 'en' ? 'Pick on map' : 'Xaritadan tanlash')}
                  </button>
                </div>
              )}
              {!place && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>
                  {language === 'ru' ? `Доставляем до ${radiusKm} км от базара` : (language === 'en' ? `We deliver within ${radiusKm} km of the bazaar` : `Bozordan ${radiusKm} km gacha yetkazamiz`)}
                </div>
              )}
              {locateError && <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: 6 }}>{locateError}</div>}

              {/* Chosen address */}
              {place && (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${placeDistance > radiusKm ? '#fecaca' : '#bbf7d0'}`, background: placeDistance > radiusKm ? '#fef2f2' : '#f0fdf4', marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>{placeDistance > radiusKm ? '⚠️' : '✅'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{place.main}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {[place.details, `🏪 ${placeDistance.toFixed(1)} km`].filter(Boolean).join(' · ')}
                      </div>
                      {placeDistance > radiusKm && (
                        <div style={{ fontSize: '0.8rem', color: '#b91c1c', fontWeight: 700, marginTop: 4 }}>
                          {language === 'ru' ? `Дальше ${radiusKm} км — пока не доставляем` : (language === 'en' ? `Farther than ${radiusKm} km — not delivered yet` : `${radiusKm} km'dan uzoq — hozircha yetkazmaymiz`)}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setShowMap(true)} style={{ border: 'none', background: 'none', color: '#047857', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                      {language === 'ru' ? 'Изменить' : (language === 'en' ? 'Change' : "O'zgartirish")}
                    </button>
                  </div>

                  {/* Only short numbers to type */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
                    {[
                      [entrance, setEntrance, language === 'ru' ? 'Подъезд' : (language === 'en' ? 'Entrance' : 'Podyezd')],
                      [floor, setFloor, language === 'ru' ? 'Этаж' : (language === 'en' ? 'Floor' : 'Qavat')],
                      [apartment, setApartment, language === 'ru' ? 'Квартира' : (language === 'en' ? 'Apt.' : 'Xonadon')],
                    ].map(([value, setter, label]) => (
                      <input key={label} className="form-input" inputMode="numeric" placeholder={label} value={value} maxLength={6} onChange={(e) => setter(e.target.value.replace(/[^\dA-Za-zА-Яа-я]/g, ''))} style={{ textAlign: 'center' }} />
                    ))}
                  </div>
                  <input
                    className="form-input"
                    placeholder={language === 'ru' ? 'Ориентир (необязательно): например, рядом с Макро' : (language === 'en' ? 'Landmark (optional): e.g. next to Makro' : "Mo'ljal (ixtiyoriy): masalan, Makro yonida")}
                    value={landmark}
                    maxLength={150}
                    onChange={(e) => setLandmark(e.target.value)}
                  />
                </>
              )}
            </div>

            {/* Map Picker Modal */}
            {showMap && (
              <MapPicker
                language={language}
                onAddressSelect={(addr, coords, details) => {
                  applyPlace({ main: details?.main || addr, details: details?.details || '', district: details?.district || 'Yunusobod', ...coords });
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
