import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';

// A QR scanner for the plain website (bozorkom.bozorbot.uz in a browser), where Telegram's own camera is not there
// (Shuhrat, 2026-11-28). The phone's back camera; the browser's own BarcodeDetector where it exists (Chrome,
// Android), jsQR on every frame otherwise (iPhone Safari). Esc or «Yopish» closes it and stops the camera.
const T = {
  title: { uz: 'Varaqdagi QR kodni ramkaga keltiring', ru: 'Наведите камеру на QR-код листа', en: "Point the camera at the sheet's QR" },
  close: { uz: 'Yopish', ru: 'Закрыть', en: 'Close' },
  denied: {
    uz: "Kameraga ruxsat berilmadi. Brauzer sozlamalarida kamerani yoqing yoki kodni (BZR-…) qo'lda yozing.",
    ru: 'Нет доступа к камере. Разрешите камеру в настройках браузера или впишите код (BZR-…) вручную.',
    en: 'No camera access. Allow the camera in the browser settings or type the code (BZR-…) by hand.',
  },
  starting: { uz: 'Kamera ochilmoqda…', ru: 'Открываю камеру…', en: 'Opening the camera…' },
};

export default function CameraScanner({ lang, onResult, onClose }) {
  const t = (k) => T[k][lang] || T[k].uz;
  const videoRef = useRef(null);
  const [state, setState] = useState('starting'); // starting | live | denied
  useEffect(() => {
    let stream = null;
    let stopped = false;
    let raf = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    const done = (text) => { if (!stopped && text) { stopped = true; onResult(text); } };
    const tick = async () => {
      if (stopped) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        try {
          if (detector) {
            const found = await detector.detect(v);
            if (found[0]?.rawValue) { done(found[0].rawValue); return; }
          } else {
            const w = Math.min(640, v.videoWidth);
            const h = Math.round((v.videoHeight / v.videoWidth) * w);
            canvas.width = w; canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
            if (code?.data) { done(code.data); return; }
          }
        } catch { /* a frame that could not be read: try the next one */ }
      }
      raf = requestAnimationFrame(tick);
    };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setState('live');
        raf = requestAnimationFrame(tick);
      } catch {
        setState('denied');
      }
    })();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult, onClose]);

  return createPortal(
    <div className="kit-cam" role="dialog" aria-modal="true" aria-label={t('title')} data-testid="kit-camera">
      <div className="kit-cam-box">
        <div className="kit-cam-title">{t('title')}</div>
        <div className="kit-cam-view">
          <video ref={videoRef} playsInline muted />
          {state === 'live' && <div className="kit-cam-frame" aria-hidden="true" />}
          {state === 'starting' && <div className="kit-cam-msg">{t('starting')}</div>}
          {state === 'denied' && <div className="kit-cam-msg">{t('denied')}</div>}
        </div>
        <button type="button" className="kit-cam-close" onClick={onClose} autoFocus>{t('close')}</button>
      </div>
    </div>,
    document.body,
  );
}
