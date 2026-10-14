// Telegram WebApp SDK Helper & Cross-Device Adapter

export const tg = window.Telegram?.WebApp;

export function initTelegramApp() {
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();
    if (tg.enableClosingConfirmation) {
      tg.enableClosingConfirmation();
    }
    // Set native header & background colors
    if (tg.setHeaderColor) {
      tg.setHeaderColor('#064e3b');
    }
    if (tg.setBackgroundColor) {
      tg.setBackgroundColor('#f8fafc');
    }
  } catch (e) {
    console.warn('Telegram WebApp init notice:', e);
  }
}

export function triggerHaptic(type = 'light') {
  if (!tg?.HapticFeedback) return;
  try {
    if (type === 'light' || type === 'medium' || type === 'heavy') {
      tg.HapticFeedback.impactOccurred(type);
    } else if (type === 'success' || type === 'warning' || type === 'error') {
      tg.HapticFeedback.notificationOccurred(type);
    } else if (type === 'selection') {
      tg.HapticFeedback.selectionChanged();
    }
  } catch {}
}

export function closeTelegramApp() {
  if (tg) {
    tg.close();
  }
}

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user || null;
}

// Signed launch data; the server checks it to know which Telegram account is using the app
export function getTelegramInitData() {
  return tg?.initData || '';
}

// Ask Telegram to share the user's phone with the bot (Bot API 6.9+); calls back with true when sent
export function requestPhone(callback) {
  if (!tg?.requestContact || !tg.isVersionAtLeast?.('6.9')) return false;
  try {
    tg.requestContact((sent) => callback(Boolean(sent)));
    return true;
  } catch {
    return false;
  }
}
