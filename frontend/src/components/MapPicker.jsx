import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, X, Check, Loader } from 'lucide-react';

export default function MapPicker({ onAddressSelect, language, onClose }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [coords, setCoords] = useState({ lat: 41.3300, lng: 69.2900 }); // Yunusobod center

  const t = {
    title: language === 'ru' ? 'Выбрать адрес на карте' : (language === 'en' ? 'Pick address on map' : 'Xaritadan manzil tanlash'),
    gps: language === 'ru' ? 'Моя геолокация' : (language === 'en' ? 'My Location' : 'Mening joylashuvim'),
    instruction: language === 'ru' ? 'Нажмите на карту чтобы выбрать точку доставки' : (language === 'en' ? 'Tap the map to set delivery point' : 'Yetkazib berish nuqtasini tanlash uchun xaritaga bosing'),
    detecting: language === 'ru' ? 'Определяем...' : (language === 'en' ? 'Detecting...' : 'Aniqlanmoqda...'),
    confirm: language === 'ru' ? 'Подтвердить адрес' : (language === 'en' ? 'Confirm Address' : 'Manzilni tasdiqlash'),
    loading: language === 'ru' ? 'Загружаем адрес...' : (language === 'en' ? 'Loading address...' : 'Manzil yuklanmoqda...'),
    noAddress: language === 'ru' ? 'Адрес не найден, попробуйте другую точку' : (language === 'en' ? 'Address not found, try another point' : 'Manzil topilmadi'),
    gpsError: language === 'ru' ? 'GPS недоступен' : (language === 'en' ? 'GPS unavailable' : 'GPS ishlamayapti'),
  };

  const reverseGeocode = async (lat, lng) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz')}`,
        { headers: { 'Accept-Language': language } }
      );
      const data = await res.json();
      if (data && data.display_name) {
        // Shorten: take first 3 parts of address
        const parts = data.display_name.split(',').slice(0, 4).join(',').trim();
        setSelectedAddress(parts);
      } else {
        setSelectedAddress(t.noAddress);
      }
    } catch {
      setSelectedAddress(t.noAddress);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let L;
    const initMap = async () => {
      L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      // Fix leaflet default icon
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (mapInstanceRef.current) return;
      
      const map = L.map(mapRef.current, { zoomControl: true }).setView([coords.lat, coords.lng], 15);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(map);
      markerRef.current = marker;

      // Reverse geocode initial position
      reverseGeocode(coords.lat, coords.lng);

      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
      });

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
      });
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleGPS = () => {
    setGpsErrorMsg('');
    setGpsLoading(true);

    const onSuccess = (lat, lng) => {
      setCoords({ lat, lng });
      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.setView([lat, lng], 17);
        markerRef.current.setLatLng([lat, lng]);
      }
      reverseGeocode(lat, lng);
      setGpsLoading(false);
    };

    const onError = () => {
      setGpsLoading(false);
      setGpsErrorMsg(
        language === 'ru'
          ? '⚠️ GPS заблокирован. Нажмите на карту вручную чтобы выбрать адрес.'
          : (language === 'en'
            ? '⚠️ GPS blocked. Tap on the map to pick your address manually.'
            : "⚠️ GPS ishlamadi. Xaritaga bosib manzilni qo'lda tanlang.")
      );
    };

    // Try Telegram WebApp LocationManager first (Bot API 8.0+)
    const tg = window.Telegram?.WebApp;
    if (tg?.LocationManager?.isInited !== undefined) {
      if (!tg.LocationManager.isLocationAvailable) {
        tg.LocationManager.init(() => {
          tg.LocationManager.getLocation((loc) => {
            if (loc) onSuccess(loc.latitude, loc.longitude);
            else onError();
          });
        });
      } else {
        tg.LocationManager.getLocation((loc) => {
          if (loc) onSuccess(loc.latitude, loc.longitude);
          else onError();
        });
      }
      return;
    }

    // Fallback: standard browser geolocation
    if (!navigator.geolocation) {
      onError();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onSuccess(pos.coords.latitude, pos.coords.longitude),
      onError,
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    if (selectedAddress && selectedAddress !== t.noAddress) {
      onAddressSelect(selectedAddress, coords);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: '#ffffff',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #064e3b, #059669)',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1rem' }}>
          <MapPin size={20} />
          {t.title}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }}>
          <X size={22} />
        </button>
      </div>

      {/* GPS Button */}
      <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
        <button
          onClick={handleGPS}
          disabled={gpsLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#10b981', color: 'white',
            border: 'none', borderRadius: 10,
            padding: '8px 16px', fontWeight: 700, fontSize: '0.85rem',
            cursor: gpsLoading ? 'wait' : 'pointer', opacity: gpsLoading ? 0.7 : 1
          }}
        >
          {gpsLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Navigation size={15} />}
          {gpsLoading ? t.detecting : t.gps}
        </button>
        <p style={{ fontSize: '0.78rem', color: gpsErrorMsg ? '#dc2626' : '#64748b', margin: 0, alignSelf: 'center', lineHeight: 1.4 }}>
          {gpsErrorMsg || t.instruction}
        </p>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ flex: 1, minHeight: 0 }} />

      {/* Selected address + Confirm */}
      <div style={{
        padding: '12px 14px',
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          background: '#f0fdf4',
          border: '1.5px solid #10b981',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          minHeight: 44
        }}>
          <MapPin size={16} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: '0.85rem', color: '#0f172a', lineHeight: 1.4 }}>
            {loading ? (
              <span style={{ color: '#94a3b8' }}>{t.loading}</span>
            ) : (
              selectedAddress || t.instruction
            )}
          </span>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selectedAddress || selectedAddress === t.noAddress || loading}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 12,
            border: 'none',
            background: (!selectedAddress || loading) ? '#cbd5e1' : 'linear-gradient(135deg, #059669, #10b981)',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: (!selectedAddress || loading) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}
        >
          <Check size={18} />
          {t.confirm}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .leaflet-container { font-family: inherit; }
      `}</style>
    </div>
  );
}
