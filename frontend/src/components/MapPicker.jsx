import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Search, X, Navigation, Loader, MapPin, ChevronRight } from 'lucide-react';
import { formatAddress, getCurrentPosition, lastLocationError, isDesktopTelegram, openLocationSettings } from '../services/location';

// Yunusobod Dehqon Bozori area
const DEFAULT_CENTER = { lat: 41.36467, lng: 69.29089 };
// Tashkent bounding box for address search: west, north, east, south
const TASHKENT_VIEWBOX = '69.10,41.45,69.45,41.20';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

const TEXTS = {
  search: { uz: "Ko'cha yoki uy qidirish", ru: 'Поиск улицы или дома', en: 'Search street or building' },
  confirm: { uz: 'Shu yerga', ru: 'Доставить сюда', en: 'Deliver here' },
  change: { uz: "Manzilni o'zgartirish", ru: 'Изменить адрес', en: 'Change address' },
  title: { uz: 'Yetkazish manzili', ru: 'Адрес доставки', en: 'Delivery location' },
  hint: { uz: 'Pinni surib uyingizni belgilang', ru: 'Передвиньте метку к вашему дому', en: 'You can move the pin to your home' },
  loading: { uz: 'Manzil aniqlanmoqda…', ru: 'Определяем адрес…', en: 'Finding address…' },
  moving: { uz: 'Xaritani suring — pin markazda', ru: 'Двигайте карту — точка в центре', en: 'Move the map — pin stays centered' },
  noAddress: { uz: 'Manzil topilmadi, boshqa nuqtani tanlang', ru: 'Адрес не найден, выберите другую точку', en: 'Address not found, try another point' },
  noResults: { uz: 'Hech narsa topilmadi', ru: 'Ничего не найдено', en: 'Nothing found' },
  gpsError: {
    uz: "Joylashuvni aniqlab bo'lmadi. Xaritani surib manzilni tanlang.",
    ru: 'Не удалось определить местоположение. Передвиньте карту к своему дому.',
    en: 'Could not get your location. Move the map to your home.'
  },
  gpsDenied: {
    uz: "Joylashuvga ruxsat berilmagan. Pastdagi tugma orqali ruxsat bering yoki xaritani uyingizgacha suring.",
    ru: 'Нет доступа к местоположению. Разрешите его кнопкой ниже или передвиньте карту к своему дому.',
    en: 'No access to your location. Allow it with the button below, or move the map to your home.'
  },
  gpsDeniedDesktop: {
    uz: "Kompyuterda joylashuv odatda ishlamaydi. Manzilni qidiring yoki xaritani suring. Mac'da: Tizim sozlamalari → Maxfiylik → Joylashuv xizmatlari → Telegram.",
    ru: 'На компьютере местоположение обычно недоступно. Найдите адрес поиском или передвиньте карту. На Mac: Системные настройки → Конфиденциальность → Службы геолокации → Telegram.',
    en: 'On a computer location is usually unavailable. Search the address or move the map. On a Mac: System Settings → Privacy → Location Services → Telegram.'
  },
  openSettings: { uz: '⚙️ Joylashuvga ruxsat berish', ru: '⚙️ Разрешить местоположение', en: '⚙️ Allow location' },
  deliveryPoint: { uz: 'Yetkazib berish manzili', ru: 'Адрес доставки', en: 'Delivery address' },
};


// Straight-line distance in km (haversine), same formula as the server
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function circlePolygon(center, radiusKm, steps = 96) {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusKm / 111.32) * Math.sin(angle);
    const dLng = (radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180))) * Math.cos(angle);
    coords.push([center.lng + dLng, center.lat + dLat]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
}

export default function MapPicker({ onAddressSelect, language, onClose, bazaar = DEFAULT_CENTER, radiusKm = 3 }) {
  const t = (key) => TEXTS[key]?.[language] || TEXTS[key]?.uz || key;

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const maplibreRef = useRef(null);
  const userDotRef = useRef(null);
  const geocodeTimerRef = useRef(null);
  const geocodeIdRef = useRef(0);
  const searchTimerRef = useRef(null);
  const searchRef = useRef(null);

  const [coords, setCoords] = useState(DEFAULT_CENTER);
  const [address, setAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [gpsDenied, setGpsDenied] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');

  const reverseGeocode = useCallback((lat, lng) => {
    clearTimeout(geocodeTimerRef.current);
    setAddressLoading(true);
    // Wait until the map stops moving (and respect Nominatim's 1 request/second limit)
    geocodeTimerRef.current = setTimeout(async () => {
      const requestId = ++geocodeIdRef.current;
      try {
        const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1&accept-language=${lang}`);
        const data = await res.json();
        if (requestId !== geocodeIdRef.current) return;
        setAddress(formatAddress(data));
      } catch {
        if (requestId === geocodeIdRef.current) setAddress(null);
      } finally {
        if (requestId === geocodeIdRef.current) setAddressLoading(false);
      }
    }, 700);
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (cancelled || mapRef.current) return;
      maplibreRef.current = maplibregl;

      // Free vector map without API keys (OpenFreeMap, OpenStreetMap data)
      const map = new maplibregl.Map({
        container: mapElRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
        zoom: 16,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false
      });
      map.touchZoomRotate.disableRotation();
      mapRef.current = map;
      // Keep the attribution as a small (i) button, like map apps do
      map.once('load', () => {
        mapElRef.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        // Delivery zone around the bazaar
        map.addSource('zone', { type: 'geojson', data: circlePolygon(bazaar, radiusKm) });
        map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': '#10b981', 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'zone-line', type: 'line', source: 'zone', paint: { 'line-color': '#059669', 'line-width': 2, 'line-dasharray': [3, 2] } });
      });
      const bazaarPin = document.createElement('div');
      bazaarPin.style.cssText = 'width:30px;height:30px;border-radius:50%;background:#059669;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:14px';
      bazaarPin.textContent = '🏪';
      new maplibregl.Marker({ element: bazaarPin }).setLngLat([bazaar.lng, bazaar.lat]).addTo(map);

      map.on('movestart', () => setDragging(true));
      map.on('moveend', () => {
        setDragging(false);
        const c = map.getCenter();
        setCoords({ lat: c.lat, lng: c.lng });
        reverseGeocode(c.lat, c.lng);
      });

      reverseGeocode(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
      // Like taxi apps: try to start at the customer's location
      locate(true);
    })();

    return () => {
      cancelled = true;
      clearTimeout(geocodeTimerRef.current);
      clearTimeout(searchTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showUserLocation = (lat, lng) => {
    const maplibregl = maplibreRef.current;
    const map = mapRef.current;
    if (!maplibregl || !map) return;
    if (userDotRef.current) {
      userDotRef.current.setLngLat([lng, lat]);
    } else {
      const dot = document.createElement('div');
      dot.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,0.2)';
      userDotRef.current = new maplibregl.Marker({ element: dot }).setLngLat([lng, lat]).addTo(map);
    }
    map.flyTo({ center: [lng, lat], zoom: 17, duration: 800 });
  };

  // Telegram location first, then the browser. On opening the map we only use a permission
  // already given, so Telegram never flashes its bare "Permission Denied" toast
  const locate = async (silent = false) => {
    setGpsError('');
    setGpsDenied(false);
    setGpsLoading(true);
    const pos = await getCurrentPosition({ silent });
    setGpsLoading(false);
    if (pos) return showUserLocation(pos.lat, pos.lng);
    if (silent) return;
    if (lastLocationError === 'denied') {
      setGpsDenied(true);
      setGpsError(t(isDesktopTelegram() ? 'gpsDeniedDesktop' : 'gpsDenied'));
    } else {
      setGpsError(t('gpsError'));
    }
  };

  const handleSearchChange = (value) => {
    setQuery(value);
    clearTimeout(searchTimerRef.current);
    if (value.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const q = encodeURIComponent(value.trim());
        const res = await fetch(`${NOMINATIM}/search?q=${q}&format=json&addressdetails=1&limit=6&countrycodes=uz&viewbox=${TASHKENT_VIEWBOX}&bounded=1&accept-language=${lang}`);
        const data = await res.json();
        // The same street often comes back as several map pieces: show it once
        const seen = new Set();
        setResults(data.filter((item) => {
          const f = formatAddress(item);
          const key = f ? `${f.main}|${f.details}` : item.display_name;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
  };

  const pickResult = (item) => {
    setSearchOpen(false);
    setQuery('');
    setResults([]);
    mapRef.current?.flyTo({ center: [parseFloat(item.lon), parseFloat(item.lat)], zoom: 17, duration: 800 });
  };

  const distance = distanceKm(bazaar, coords);
  const outside = distance > radiusKm;
  const canConfirm = address && !addressLoading && !dragging && !outside;
  const handleConfirm = () => {
    if (!canConfirm) return;
    onAddressSelect([address.main, address.details].filter(Boolean).join(', '), coords, address);
  };

  const roundBtn = {
    width: 44, height: 44, borderRadius: '50%', border: 'none',
    background: '#ffffff', color: '#0f172a',
    boxShadow: '0 2px 10px rgba(15,23,42,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0
  };

  // Rendered at the page root: an animated parent (transform) would otherwise trap a fixed overlay
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#e5e7eb', overflow: 'hidden' }}>
      {/* Map fills the whole screen */}
      <div ref={mapElRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Center pin: the map moves under it */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', zIndex: 500, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', left: -6, top: -3, width: 12, height: 6, borderRadius: '50%',
          background: 'rgba(15,23,42,0.35)',
          transform: dragging ? 'scale(0.6)' : 'scale(1)', transition: 'transform 0.15s ease'
        }} />
        <div style={{
          position: 'absolute', left: -20, top: -52,
          transform: dragging ? 'translateY(-12px)' : 'translateY(0)',
          transition: 'transform 0.15s ease',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#059669', border: '3px solid #ffffff',
            boxShadow: '0 4px 12px rgba(5,150,105,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffffff' }} />
          </div>
          <div style={{ width: 3, height: 12, background: '#059669', borderRadius: 2 }} />
        </div>
      </div>

      {/* Top bar: back + search */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 600, padding: '12px 12px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px',
            background: '#ffffff', borderRadius: 22, boxShadow: '0 2px 10px rgba(15,23,42,0.18)'
          }}>
            <Search size={18} color="#64748b" style={{ flexShrink: 0 }} />
            <input
              value={query}
              ref={searchRef}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('search')}
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 16, background: 'transparent', color: '#0f172a' }}
            />
            {searching && <Loader size={16} color="#64748b" style={{ animation: 'mp-spin 1s linear infinite', flexShrink: 0 }} />}
            {query && !searching && (
              <button type="button" onClick={() => handleSearchChange('')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex' }} aria-label="clear">
                <X size={18} color="#64748b" />
              </button>
            )}
          </div>

          {searchOpen && query.trim().length >= 3 && !searching && (
            <div style={{ marginTop: 8, background: '#ffffff', borderRadius: 16, boxShadow: '0 6px 20px rgba(15,23,42,0.18)', overflow: 'hidden', maxHeight: '50vh', overflowY: 'auto' }}>
              {results.length === 0 && (
                <div style={{ padding: '14px 16px', fontSize: 14, color: '#64748b' }}>{t('noResults')}</div>
              )}
              {results.map((item) => {
                const f = formatAddress(item) || { main: item.display_name.split(',')[0], details: '' };
                return (
                  <button
                    key={item.place_id}
                    type="button"
                    onClick={() => pickResult(item)}
                    style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#ffffff', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <MapPin size={18} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{f.main}</span>
                      {f.details && <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{f.details}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom sheet */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 12px 12px' }}>
          <button type="button" onClick={onClose} style={{ ...roundBtn, width: 48, height: 48 }} aria-label="back">
            <ArrowLeft size={22} />
          </button>
          {/* Telegram on a computer cannot locate (no GPS) and answers every try with a bare
              "Permission Denied" toast, so the button is only offered on phones */}
          {!isDesktopTelegram() && (
            <button type="button" onClick={() => locate(false)} disabled={gpsLoading} style={{ ...roundBtn, width: 48, height: 48 }} aria-label="my location">
              {gpsLoading
                ? <Loader size={20} color="#2563eb" style={{ animation: 'mp-spin 1s linear infinite' }} />
                : <Navigation size={20} color="#2563eb" fill="#2563eb" />}
            </button>
          )}
        </div>

        <div style={{
          background: '#ffffff', borderRadius: '22px 22px 0 0',
          boxShadow: '0 -6px 24px rgba(15,23,42,0.15)',
          padding: '10px 16px calc(16px + env(safe-area-inset-bottom))'
        }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e2e8f0', margin: '0 auto 12px' }} />

          {gpsError && (
            <div style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 10px', marginBottom: 10 }}>
              {gpsError}
              {gpsDenied && !isDesktopTelegram() && (
                <button type="button" onClick={() => { if (!openLocationSettings()) setGpsError(t('gpsError')); }} style={{ display: 'block', marginTop: 8, padding: '8px 12px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
                  {t('openSettings')}
                </button>
              )}
            </div>
          )}

          {outside && !dragging && (
            <div style={{ fontSize: 14, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 12px', marginBottom: 10, fontWeight: 600 }}>
              {language === 'ru'
                ? `Этот адрес в ${distance.toFixed(1)} км от базара. Пока доставляем только в зелёном круге (${radiusKm} км).`
                : (language === 'en'
                  ? `This address is ${distance.toFixed(1)} km from the bazaar. For now we deliver only inside the green circle (${radiusKm} km).`
                  : `Bu manzil bozordan ${distance.toFixed(1)} km uzoqda. Hozircha faqat yashil doira ichiga (${radiusKm} km) yetkazamiz.`)}
            </div>
          )}

          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>{t('title')}</h2>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 10 }}>
            {!dragging && <span style={{ color: outside ? '#b91c1c' : '#047857', fontWeight: 700 }}>🏪 {distance.toFixed(1)} km · </span>}
            {t('hint')}
          </div>

          <button type="button" onClick={() => searchRef.current?.focus()} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', border: 'none', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', background: 'none', textAlign: 'left', cursor: 'pointer', minHeight: 64, marginBottom: 14 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {dragging ? (
                <span style={{ fontSize: 17, fontWeight: 700, color: '#94a3b8' }}>{t('moving')}</span>
              ) : addressLoading ? (
                <>
                  <span style={{ display: 'block', height: 18, width: '70%', borderRadius: 6, background: '#e2e8f0', marginBottom: 8, animation: 'mp-pulse 1.2s ease-in-out infinite' }} />
                  <span style={{ display: 'block', height: 12, width: '45%', borderRadius: 6, background: '#f1f5f9', animation: 'mp-pulse 1.2s ease-in-out infinite' }} />
                </>
              ) : address ? (
                <>
                  <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{address.main}</span>
                  <span style={{ display: 'block', fontSize: 14, color: '#64748b', marginTop: 2 }}>{address.details || 'Toshkent'}</span>
                </>
              ) : (
                <span style={{ fontSize: 15, color: '#b91c1c', fontWeight: 600 }}>{t('noAddress')}</span>
              )}
            </span>
            <ChevronRight size={20} color="#94a3b8" />
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={handleConfirm} disabled={!canConfirm} style={{ flex: 1, height: 56, borderRadius: 18, border: 'none', background: canConfirm ? '#f1f5f9' : '#f8fafc', color: canConfirm ? '#0f172a' : '#cbd5e1', fontWeight: 800, fontSize: 16, cursor: canConfirm ? 'pointer' : 'not-allowed' }}>
              {t('confirm')}
            </button>
            <button type="button" onClick={() => searchRef.current?.focus()} style={{ flex: 1, height: 56, borderRadius: 18, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
              {t('change')}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes mp-spin { to { transform: rotate(360deg); } }
        @keyframes mp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        .maplibregl-ctrl-bottom-right { bottom: auto; top: 64px; }
        .maplibregl-ctrl-attrib { font-size: 10px; }
      `}</style>
    </div>
  , document.body);
}
