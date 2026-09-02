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
