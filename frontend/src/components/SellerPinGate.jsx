import React, { useState } from 'react';
import { Store, Delete, ShieldCheck, AlertCircle } from 'lucide-react';

const CORRECT_PIN = '2008';

export default function SellerPinGate({ onUnlock, onCancel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = (digit) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);

    if (newPin.length === 4) {
      setTimeout(() => {
        if (newPin === CORRECT_PIN) {
          onUnlock();
        } else {
          setShake(true);
          setError(true);
          setPin('');
          setTimeout(() => setShake(false), 600);
        }
      }, 200);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f2027 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px'
    }}>
      {/* Icon */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        boxShadow: '0 0 40px rgba(16,185,129,0.4)'
      }}>
        <Store size={34} color="white" />
      </div>

      {/* Title */}
      <h2 style={{
        color: 'white', fontSize: 22, fontWeight: 700,
        marginBottom: 6, textAlign: 'center'
      }}>
        Кабинет продавца
      </h2>
      <p style={{
        color: '#94a3b8', fontSize: 14, marginBottom: 32,
        textAlign: 'center'
      }}>
        Введите PIN-код для входа
      </p>

      {/* PIN Dots */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 16,
        animation: shake ? 'pinShake 0.5s ease' : 'none'
      }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: i < pin.length
              ? (error ? '#ef4444' : '#10b981')
              : 'rgba(255,255,255,0.2)',
            transition: 'all 0.15s ease',
            boxShadow: i < pin.length && !error
              ? '0 0 12px rgba(16,185,129,0.7)' : 'none'
          }} />
        ))}
      </div>

      {/* Error message */}
      <div style={{
        height: 24, display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 24, opacity: error ? 1 : 0,
        transition: 'opacity 0.2s ease'
      }}>
        <AlertCircle size={15} color="#ef4444" />
        <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
          Неверный PIN-код
        </span>
      </div>

      {/* Numpad */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14, marginBottom: 28, width: '100%', maxWidth: 280
      }}>
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />;
          const isDelete = d === '⌫';
          return (
            <button
              key={i}
              onClick={() => isDelete ? handleDelete() : handleDigit(d)}
              style={{
                height: 70, borderRadius: 16,
                background: isDelete
                  ? 'rgba(239,68,68,0.15)'
                  : 'rgba(255,255,255,0.07)',
                border: isDelete
                  ? '1.5px solid rgba(239,68,68,0.3)'
                  : '1.5px solid rgba(255,255,255,0.1)',
                color: isDelete ? '#ef4444' : 'white',
                fontSize: isDelete ? 22 : 26,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
                backdropFilter: 'blur(8px)'
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.background = isDelete
                  ? 'rgba(239,68,68,0.3)'
                  : 'rgba(255,255,255,0.18)';
                e.currentTarget.style.transform = 'scale(0.94)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.background = isDelete
                  ? 'rgba(239,68,68,0.15)'
                  : 'rgba(255,255,255,0.07)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          fontSize: 15,
          cursor: 'pointer',
          padding: '10px 24px',
          borderRadius: 10
        }}
      >
        Назад
      </button>

      <style>{`
        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
