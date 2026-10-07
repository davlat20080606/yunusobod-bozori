import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Search, X, Navigation, Loader, MapPin } from 'lucide-react';

// Yunusobod Dehqon Bozori area
const DEFAULT_CENTER = { lat: 41.3655, lng: 69.2885 };
// Tashkent bounding box for address search: west, north, east, south
const TASHKENT_VIEWBOX = '69.10,41.45,69.45,41.20';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

const TEXTS = {
  search: { uz: "Ko'cha yoki uy qidirish", ru: 'Поиск улицы или дома', en: 'Search street or building' },
  confirm: { uz: 'Shu yerga yetkazing', ru: 'Доставить сюда', en: 'Deliver here' },
  loading: { uz: 'Manzil aniqlanmoqda…', ru: 'Определяем адрес…', en: 'Finding address…' },
  moving: { uz: 'Xaritani suring — pin markazda', ru: 'Двигайте карту — точка в центре', en: 'Move the map — pin stays centered' },
  noAddress: { uz: 'Manzil topilmadi, boshqa nuqtani tanlang', ru: 'Адрес не найден, выберите другую точку', en: 'Address not found, try another point' },
  noResults: { uz: 'Hech narsa topilmadi', ru: 'Ничего не найдено', en: 'Nothing found' },
  gpsError: {
    uz: "Joylashuvni aniqlab bo'lmadi. Xaritani surib manzilni tanlang.",
    ru: 'Не удалось определить местоположение. Передвиньте карту к своему дому.',
    en: 'Could not get your location. Move the map to your home.'
  },
  deliveryPoint: { uz: 'Yetkazib berish manzili', ru: 'Адрес доставки', en: 'Delivery address' },
};

function formatAddress(data) {
  const a = data?.address;
  if (!a) return null;
  const street = a.road || a.pedestrian || a.footway || a.residential || a.neighbourhood || a.suburb || a.quarter;
  const main = [street, a.house_number].filter(Boolean).join(', ');
  const detailParts = [a.neighbourhood || a.quarter, a.suburb, a.city_district || a.county]
    .filter((part, i, arr) => part && part !== street && arr.indexOf(part) === i);
  const details = detailParts.join(', ');
  if (!main && !details) return null;
  return { main: main || details, details: main ? details : '' };
}

export default function MapPicker({ onAddressSelect, language, onClose }) {
  const t = (key) => TEXTS[key]?.[language] || TEXTS[key]?.uz || key;

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const maplibreRef = useRef(null);
  const userDotRef = useRef(null);
  const geocodeTimerRef = useRef(null);
  const geocodeIdRef = useRef(0);
  const searchTimerRef = useRef(null);

  const [coords, setCoords] = useState(DEFAULT_CENTER);
  const [address, setAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
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
      });

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

  // Telegram location first (Bot API 8.0+), then the browser; never waits forever
  const locate = (silent = false) => {
    setGpsError('');
    setGpsLoading(true);
    let finished = false;
    const finish = (lat, lng) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      setGpsLoading(false);
      if (lat != null && lng != null) showUserLocation(lat, lng);
      else if (!silent) setGpsError(t('gpsError'));
    };
    const timer = setTimeout(() => finish(null), 12000);

    const fromBrowser = () => {
      if (!navigator.geolocation) return finish(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => finish(pos.coords.latitude, pos.coords.longitude),
        () => finish(null),
        { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
      );
    };

    const tg = window.Telegram?.WebApp;
    const lm = tg?.LocationManager;
    if (lm && tg.isVersionAtLeast?.('8.0')) {
      const ask = () => {
        if (!lm.isLocationAvailable) return fromBrowser();
        lm.getLocation((loc) => (loc ? finish(loc.latitude, loc.longitude) : finish(null)));
      };
      try {
        if (lm.isInited) ask();
        else lm.init(ask);
      } catch {
        fromBrowser();
      }
    } else {
      fromBrowser();
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

  const canConfirm = address && !addressLoading && !dragging;
  const handleConfirm = () => {
    if (!canConfirm) return;
    onAddressSelect([address.main, address.details].filter(Boolean).join(', '), coords);
  };

  const roundBtn = {
    width: 44, height: 44, borderRadius: '50%', border: 'none',
    background: '#ffffff', color: '#0f172a',
    boxShadow: '0 2px 10px rgba(15,23,42,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0
  };

  return (
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
        <button type="button" onClick={onClose} style={roundBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px',
            background: '#ffffff', borderRadius: 22, boxShadow: '0 2px 10px rgba(15,23,42,0.18)'
          }}>
            <Search size={18} color="#64748b" style={{ flexShrink: 0 }} />
            <input
              value={query}
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 12px 12px' }}>
          <button type="button" onClick={() => locate(false)} disabled={gpsLoading} style={{ ...roundBtn, width: 48, height: 48 }} aria-label="my location">
            {gpsLoading
              ? <Loader size={20} color="#2563eb" style={{ animation: 'mp-spin 1s linear infinite' }} />
              : <Navigation size={20} color="#2563eb" fill="#2563eb" />}
          </button>
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
            </div>
          )}

          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
            {t('deliveryPoint')}
          </div>
          <div style={{ minHeight: 48, marginBottom: 14 }}>
            {dragging ? (
              <div style={{ fontSize: 17, fontWeight: 700, color: '#94a3b8' }}>{t('moving')}</div>
            ) : addressLoading ? (
              <>
                <div style={{ height: 18, width: '70%', borderRadius: 6, background: '#e2e8f0', marginBottom: 8, animation: 'mp-pulse 1.2s ease-in-out infinite' }} />
                <div style={{ height: 12, width: '45%', borderRadius: 6, background: '#f1f5f9', animation: 'mp-pulse 1.2s ease-in-out infinite' }} />
              </>
            ) : address ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{address.main}</div>
                {address.details && <div style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>{address.details}</div>}
              </>
            ) : (
              <div style={{ fontSize: 15, color: '#b91c1c', fontWeight: 600 }}>{t('noAddress')}</div>
            )}
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              width: '100%', height: 52, borderRadius: 14, border: 'none',
              background: canConfirm ? '#059669' : '#cbd5e1',
              color: '#ffffff', fontWeight: 800, fontSize: 16,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s ease'
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes mp-spin { to { transform: rotate(360deg); } }
        @keyframes mp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        .maplibregl-ctrl-bottom-right { bottom: auto; top: 64px; }
        .maplibregl-ctrl-attrib { font-size: 10px; }
      `}</style>
    </div>
  );
}
