// Telegram WebApp helper utilities

export const tg = window.Telegram?.WebApp;

export const initTelegramApp = () => {
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
      // Apply telegram header color
      if (tg.setHeaderColor) {
        tg.setHeaderColor('#064E3B'); // Emerald green
      }
      if (tg.setBackgroundColor) {
        tg.setBackgroundColor('#F8FAFC');
      }
    } catch (e) {
      console.log('Telegram WebApp init notice:', e);
    }
  }
};

export const triggerHaptic = (style = 'medium') => {
  if (tg?.HapticFeedback) {
    try {
      if (style === 'light' || style === 'medium' || style === 'heavy' || style === 'rigid' || style === 'soft') {
        tg.HapticFeedback.impactOccurred(style);
      } else if (style === 'success' || style === 'warning' || style === 'error') {
        tg.HapticFeedback.notificationOccurred(style);
      } else if (style === 'selection') {
        tg.HapticFeedback.selectionChanged();
      }
    } catch (e) {
      // Haptics ignore
    }
  }
};

export const getTelegramUser = () => {
  return tg?.initDataUnsafe?.user || null;
};
