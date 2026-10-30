// Location helpers shared by checkout and the map picker
import { tg } from './telegram';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const ADDRESS_KEY = 'yunusobod_addresses';
const MAX_SAVED = 3;

// Why the last location attempt failed: 'denied' (no permission), 'unavailable', or ''
export let lastLocationError = '';

// Desktop Telegram (Mac, Windows, web) rarely has GPS and shows its own "Permission Denied" toast
export function isDesktopTelegram() {
  return ['macos', 'tdesktop', 'weba', 'webk', 'web'].includes(tg?.platform);
}

// Opens Telegram's location permission for this bot (only works right after a tap)
export function openLocationSettings() {
  try {
    if (tg?.LocationManager?.openSettings) { tg.LocationManager.openSettings(); return true; }
  } catch {}
  return false;
}

// Telegram location first (Bot API 8.0+), then the browser; resolves null instead of hanging.
// silent: only use a permission already given, never pop a prompt or an error toast
export function getCurrentPosition({ timeoutMs = 12000, silent = false } = {}) {
  lastLocationError = '';
  return new Promise((resolve) => {
    let finished = false;
    const finish = (pos, error = '') => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      lastLocationError = pos ? '' : error;
      resolve(pos);
    };
    const timer = setTimeout(() => finish(null, 'unavailable'), timeoutMs);
    if (silent && isDesktopTelegram()) return finish(null);

    const fromBrowser = async () => {
      if (!navigator.geolocation) return finish(null, 'unavailable');
      if (silent) {
        try {
          const state = (await navigator.permissions?.query({ name: 'geolocation' }))?.state;
          if (state !== 'granted') return finish(null);
        } catch {
          return finish(null);
        }
      }
      navigator.geolocation.getCurrentPosition(
        (p) => finish({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (err) => finish(null, err?.code === 1 ? 'denied' : 'unavailable'),
        { timeout: timeoutMs - 1000, enableHighAccuracy: true, maximumAge: 60000 }
      );
    };

    const lm = tg?.LocationManager;
    if (lm && tg.isVersionAtLeast?.('8.0')) {
      const ask = () => {
        if (!lm.isLocationAvailable) return fromBrowser();
        // Asked before and refused: asking again only brings Telegram's bare toast
        if (lm.isAccessRequested && !lm.isAccessGranted) return finish(null, silent ? '' : 'denied');
        if (silent && !lm.isAccessGranted) return finish(null);
        lm.getLocation((loc) => (loc
          ? finish({ lat: loc.latitude, lng: loc.longitude })
          : finish(null, lm.isAccessGranted ? 'unavailable' : 'denied')));
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
  });
}

export function formatAddress(data) {
  const a = data?.address;
  if (!a) return null;
  const street = a.road || a.pedestrian || a.footway || a.residential || a.neighbourhood || a.suburb || a.quarter;
  const main = [street, a.house_number].filter(Boolean).join(', ');
  const detailParts = [a.neighbourhood || a.quarter, a.suburb, a.city_district || a.county]
    .filter((part, i, arr) => part && part !== street && arr.indexOf(part) === i);
  const details = detailParts.join(', ');
  if (!main && !details) return null;
  const district = (a.city_district || a.county || a.suburb || '').replace(/ (tumani|район|District)$/i, '') || 'Yunusobod';
  return { main: main || details, details: main ? details : '', district };
}

export async function reverseGeocode(lat, lng, lang = 'uz') {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1&accept-language=${lang}`);
    return formatAddress(await res.json());
  } catch {
    return null;
  }
}

// Saved delivery addresses: Telegram CloudStorage (follows the user to other phones), else this device
function cloud() {
  return tg?.CloudStorage && tg.isVersionAtLeast?.('6.9') ? tg.CloudStorage : null;
}

export function loadAddresses() {
  return new Promise((resolve) => {
    const fromDevice = () => {
      try { resolve(JSON.parse(localStorage.getItem(ADDRESS_KEY) || '[]')); } catch { resolve([]); }
    };
    const store = cloud();
    if (!store) return fromDevice();
    try {
      store.getItem(ADDRESS_KEY, (err, value) => {
        if (err || !value) return fromDevice();
        try { resolve(JSON.parse(value)); } catch { fromDevice(); }
      });
    } catch {
      fromDevice();
    }
  });
}

export async function rememberAddress(entry) {
  const sameSpot = (a, b) => Math.abs(a.lat - b.lat) < 0.0002 && Math.abs(a.lng - b.lng) < 0.0002 && a.apartment === b.apartment;
  const list = [entry, ...(await loadAddresses()).filter((a) => !sameSpot(a, entry))].slice(0, MAX_SAVED);
  const value = JSON.stringify(list);
  try { localStorage.setItem(ADDRESS_KEY, value); } catch {}
  try { cloud()?.setItem(ADDRESS_KEY, value); } catch {}
  return list;
}
