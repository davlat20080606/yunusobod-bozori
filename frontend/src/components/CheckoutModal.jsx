import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ArrowLeft, ChevronRight, Home, MessageCircle, Phone, DoorOpen } from 'lucide-react';
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
  const [doorPhone, setDoorPhone] = useState('');
  const [leaveAtDoor, setLeaveAtDoor] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
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
  const [paymentMethod, setPaymentMethod] = useState('cash');
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
    if (p.doorPhone !== undefined) setDoorPhone(p.doorPhone || '');
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
        doorPhone && `${language === 'ru' ? 'домофон' : 'domofon'} ${doorPhone}`,
      ].filter(Boolean).join(', '),
      landmark: landmark.trim() || null,
      delivery_time_slot: timeSlot,
      payment_method: paymentMethod,
      delivery_lat: deliveryCoords?.lat ?? null,
      delivery_lng: deliveryCoords?.lng ?? null,
      notes: [
        notes || pickerNotes,
        leaveAtDoor && (language === 'ru' ? 'Оставить у двери' : "Eshik oldiga qoldirish"),
      ].filter(Boolean).join(' · ') || null,
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
      if (place) rememberAddress({ ...place, entrance, floor, apartment, landmark, doorPhone }).catch(() => {});
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

  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));
  const cur = tr("so'm", 'сум', 'UZS');
  const oldItemsTotal = cart.reduce((sum, item) => sum + ((item.product.old_price && item.product.old_price > item.product.price ? item.product.old_price : item.product.price) * item.quantity), 0);
  const deliveryFee = finalGrandTotal - itemsTotal;
  const slotInfo = {
    'Express (45-60 min)': [tr('Tezkor', 'Быстро', 'Express'), tr('45–60 daq', '45–60 мин', '45–60 min')],
    'Evening (18:00-20:00)': [tr('Bugun kechqurun', 'Сегодня вечером', 'This evening'), '18:00–20:00'],
    'Morning (09:00-11:00)': [tr('Ertaga ertalab', 'Завтра утром', 'Tomorrow'), '09:00–11:00'],
  };
  const section = { background: '#ffffff', borderRadius: 26, padding: '18px 16px', marginBottom: 10 };
  const h = { fontSize: 24, fontWeight: 800, margin: '0 0 10px' };
  const row = { width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', border: 'none', borderBottom: '1px solid #f1f5f9', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 16, color: '#0f172a' };
  const line = { width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid #e2e8f0', padding: '14px 0', fontSize: 16, outline: 'none', background: 'transparent' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8800, background: '#f1f5f9', display: 'flex', flexDirection: 'column' }} className="animate-fade">
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: '#ffffff' }}>
        <button type="button" onClick={onClose} aria-label="back" style={{ width: 44, height: 44, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ArrowLeft size={24} /></button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, marginRight: 44 }}>{tr('Buyurtmani rasmiylashtirish', 'Оформление заказа', 'Placing an order')}</div>
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 16px' }}>

          {/* Delivery time */}
          <div style={{ ...section, borderRadius: '0 0 26px 26px' }}>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
              {slots.filter((slot) => slot.open).map((slot) => {
                const [name, time] = slotInfo[slot.id] || [slot.label, ''];
                const active = timeSlot === slot.id;
                return (
                  <button key={slot.id} type="button" onClick={() => { triggerHaptic('selection'); setTimeSlot(slot.id); }} style={{ flexShrink: 0, padding: '10px 16px', borderRadius: 18, border: active ? '2px solid #0f172a' : '1.5px solid #e2e8f0', background: '#ffffff', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{name}</span>
                    <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{time}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Where to */}
          <div style={section}>
            <h3 style={h}>{tr('Qayerga', 'Куда', 'Where to')}</h3>
            {place ? (
              <>
                <button type="button" onClick={() => setShowMap(true)} style={row}>
                  <Home size={22} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{place.main}</span>
                    <span style={{ display: 'block', fontSize: 13, color: placeDistance > radiusKm ? '#b91c1c' : '#64748b' }}>
                      {placeDistance > radiusKm
                        ? tr(`${placeDistance.toFixed(1)} km — hozircha faqat ${radiusKm} km ichida yetkazamiz`, `${placeDistance.toFixed(1)} км — пока доставляем до ${radiusKm} км`, `${placeDistance.toFixed(1)} km — we deliver within ${radiusKm} km`)
                        : `${place.details || 'Toshkent'} · 🏪 ${placeDistance.toFixed(1)} km`}
                    </span>
                  </span>
                  <ChevronRight size={20} color="#94a3b8" />
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 20 }}>
                  {[
                    [entrance, setEntrance, tr('Podyezd', 'Подъезд', 'Entrance'), 'numeric', 6],
                    [floor, setFloor, tr('Qavat', 'Этаж', 'Floor'), 'numeric', 6],
                    [apartment, setApartment, tr('Xonadon', 'Квартира', 'Apartment'), 'numeric', 6],
                    [doorPhone, setDoorPhone, tr('Domofon', 'Домофон', 'Door phone'), 'text', 10],
                  ].map(([value, setter, label, mode, max]) => (
                    <label key={label} style={{ display: 'block', borderBottom: '1px solid #e2e8f0', padding: value ? '6px 0 8px' : '14px 0' }}>
                      {/* Keep the label visible once filled, like Yandex Go */}
                      {value && <span style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>{label}</span>}
                      <input inputMode={mode} maxLength={max} placeholder={label} value={value} onChange={(e) => setter(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 16, padding: 0, background: 'transparent' }} />
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                {savedAddresses.map((a, idx) => (
                  <button key={idx} type="button" onClick={() => { triggerHaptic('selection'); applyPlace(a); }} style={row}>
                    <Home size={22} />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.main}{a.apartment ? `, ${tr('xonadon', 'кв.', 'apt')} ${a.apartment}` : ''}</span>
                    <ChevronRight size={20} color="#94a3b8" />
                  </button>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={locateMe} disabled={locating} style={{ height: 56, borderRadius: 18, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: locating ? 0.7 : 1 }}>
                    📍 {locating ? tr('Aniqlanmoqda…', 'Определяем…', 'Locating…') : tr('Joylashuvim', 'Где я', 'My location')}
                  </button>
                  <button type="button" onClick={() => setShowMap(true)} style={{ height: 56, borderRadius: 18, border: 'none', background: '#f1f5f9', color: '#0f172a', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                    🗺 {tr('Xaritadan', 'На карте', 'On the map')}
                  </button>
                </div>
                <div style={{ fontSize: 13, color: locateError ? '#b45309' : '#64748b', marginTop: 8 }}>
                  {locateError || tr(`Bozordan ${radiusKm} km gacha yetkazamiz`, `Доставляем до ${radiusKm} км от базара`, `We deliver within ${radiusKm} km of the bazaar`)}
                </div>
              </>
            )}

            {/* Courier note */}
            <button type="button" onClick={() => setNoteOpen((v) => !v)} style={row}>
              <MessageCircle size={22} color="#64748b" />
              <span style={{ flex: 1, color: landmark ? '#0f172a' : '#94a3b8' }}>{landmark || tr('Kuryerga izoh, mo\'ljal', 'Комментарий для курьера', 'Instructions for courier')}</span>
              <ChevronRight size={20} color="#94a3b8" />
            </button>
            {noteOpen && (
              <textarea value={landmark} onChange={(e) => setLandmark(e.target.value)} rows={2} maxLength={150} autoFocus placeholder={tr('Masalan: Makro yonida, sariq darvoza', 'Например: рядом с Макро, жёлтые ворота', 'E.g. next to Makro, yellow gate')} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 12, fontSize: 15, fontFamily: 'inherit', resize: 'none', margin: '8px 0' }} />
            )}

            {/* Recipient */}
            {registered && (
              <div style={{ ...row, cursor: 'default' }}>
                <Phone size={22} color="#64748b" />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{tr('Qabul qiluvchi', 'Получатель', "Recipient's phone number")}</span>
                  <span style={{ display: 'block' }}>{profile.phone} · {profile.name}</span>
                </span>
              </div>
            )}
            {askPhoneInApp && (
              <button type="button" onClick={sharePhone} disabled={phoneRequesting} style={{ width: '100%', height: 52, margin: '12px 0 4px', borderRadius: 16, border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                📱 {phoneRequesting ? tr('Raqam olinmoqda…', 'Получаем номер…', 'Getting your number…') : tr('Telefon raqamni yuborish', 'Отправить номер телефона', 'Share phone number')}
              </button>
            )}
            {profile && !profile.in_telegram && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 20 }}>
                <input style={line} placeholder={t('checkout.name_placeholder')} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <input style={line} type="tel" placeholder="+998 90 123-45-67" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
            )}

            {/* Leave at the door */}
            <label style={{ ...row, borderBottom: 'none' }}>
              <DoorOpen size={22} color="#64748b" />
              <span style={{ flex: 1 }}>{tr("Eshik oldiga qoldirish", 'Оставить у двери', 'Leave at the door')}</span>
              <input type="checkbox" checked={leaveAtDoor} onChange={(e) => setLeaveAtDoor(e.target.checked)} style={{ display: 'none' }} />
              <span style={{ width: 52, height: 32, borderRadius: 16, background: leaveAtDoor ? '#059669' : '#e2e8f0', position: 'relative', transition: 'background 0.15s' }}>
                <span style={{ position: 'absolute', top: 3, left: leaveAtDoor ? 23 : 3, width: 26, height: 26, borderRadius: '50%', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.15s' }} />
              </span>
            </label>
          </div>

          {/* Payment */}
          <div style={section}>
            <h3 style={h}>{tr("To'lov", 'Оплата', 'Payment')}</h3>
            <button type="button" onClick={() => { triggerHaptic('selection'); setPaymentMethod('cash'); }} style={{ width: '100%', height: 64, marginBottom: 10, borderRadius: 18, border: paymentMethod === 'cash' ? '2px solid #0f172a' : '1.5px solid transparent', background: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 26 }}>💵</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{tr('Naqd pul', 'Наличными', 'Cash')}</span>
                <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{tr("Kuryerga, qabul qilganda to'laysiz", 'Курьеру при получении', 'Pay the courier on delivery')}</span>
              </span>
            </button>
            {/* Click/Payme are not connected to a merchant account yet, so they cannot be chosen */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[['click', <ClickLogo key="c" height={20} color="blue" />], ['payme', <PaymeLogo key="p" height={20} variant="color" />]].map(([id, logo]) => (
                <div key={id} aria-disabled="true" style={{ flex: 1, height: 72, borderRadius: 18, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.55 }}>
                  {logo}
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{tr('Tez orada', 'Скоро', 'Coming soon')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price details */}
          <div style={section}>
            <h3 style={h}>{tr('Narx tafsiloti', 'Детали цены', 'Price details')}</h3>
            {[
              [tr('Savatdagi mahsulotlar', 'Товары в корзине', 'Items in the cart'), `${Math.round(oldItemsTotal).toLocaleString()} ${cur}`],
              oldItemsTotal > itemsTotal ? [tr('Chegirma', 'Скидка', 'Discount'), `−${Math.round(oldItemsTotal - itemsTotal).toLocaleString()} ${cur}`, '#047857'] : null,
              [tr('Yetkazish', 'Доставка', 'Delivery'), `${Math.round(deliveryFee).toLocaleString()} ${cur}`],
            ].filter(Boolean).map(([label, value, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, padding: '6px 0' }}>
                <span>{label}</span><span style={{ color: color || '#0f172a' }}>{value}</span>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ margin: '0 12px', padding: '12px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: 14, fontSize: 14, fontWeight: 600 }}>⚠️ {error}</div>
          )}
        </div>

        {/* Total + big button */}
        <div style={{ background: '#ffffff', padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', borderRadius: '26px 26px 0 0', boxShadow: '0 -4px 16px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{tr('Jami', 'Итого', 'Total')}</span>
            <span>
              {oldItemsTotal > itemsTotal && <s style={{ color: '#94a3b8', fontSize: 16, marginRight: 8 }}>{Math.round(oldItemsTotal + deliveryFee).toLocaleString()}</s>}
              <b style={{ fontSize: 24, color: '#047857' }}>{Math.round(finalGrandTotal).toLocaleString()} {cur}</b>
            </span>
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', height: 58, borderRadius: 18, border: 'none', background: '#059669', color: '#ffffff', fontSize: 18, fontWeight: 800, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '…' : tr('Buyurtma berish', 'Заказать', 'Place order')}
          </button>
        </div>
      </form>

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
    </div>
  );
}
