import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Send, Bot, ExternalLink, Check, ShoppingBag, BellRing, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function TelegramBotSimulator({ onLaunchWebApp, onOpenSellerPanel }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'user',
      text: '/start',
      time: '11:30'
    },
    {
      id: 2,
      sender: 'bot',
      text: '🇺🇿 **Yunusobod Dehqon Bozoriga xush kelibsiz!**\n\nToshkentning eng saralangan va yangi mahsulotlari: sabzavotlar, mevalar, go\'sht, issiq tandir non va quruq mevalar to\'g\'ridan-to\'g\'ri rastalardan xonadoningizga!\n\n🇷🇺 **Добро пожаловать на Юнусабадский Базар!**\nСвежайшие продукты прямо с прилавков базара с доставкой.',
      time: '11:30',
      buttons: [
        { label: '🛒 Bozorni ochish (WebApp)', action: 'webapp' },
        { label: '🏪 Sotuvchi Kabineti (Narxlar)', action: 'seller' },
        { label: '📦 Buyurtmani tekshirish', action: 'track' }
      ]
    }
  ]);
  const [inputVal, setInputVal] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    triggerHaptic('light');
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: inputVal,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    const query = inputVal.trim().toLowerCase();
    setInputVal('');

    setTimeout(() => {
      let botReply = {
        id: Date.now() + 1,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (query.includes('narx') || query.includes('цена') || query.includes('/price')) {
        botReply.text = '🏪 **Sotuvchi uchun tezkor narx yangilash:**\nDo\'koningizdagi narxlarni o\'zgartirish uchun quyidagi tugmani bosing:';
        botReply.buttons = [{ label: '⚡️ Narxlarni o\'zgartirish', action: 'seller' }];
      } else if (query.includes('bozor') || query.includes('zakaz') || query.includes('купить')) {
        botReply.text = '🛒 **Yunusobod bozori rastalari ochiq!**\nSavatga mahsulot qo\'shish va yetkazib berishga buyurtma berish uchun ilovani oching:';
        botReply.buttons = [{ label: '🛒 WebApp Bozorini ochish', action: 'webapp' }];
      } else {
        botReply.text = `🤖 Sizning so'rovingiz qabul qilindi: "${query}". Yunusobod Bozoridan xarid qilish uchun ilovani ishga tushiring!`;
        botReply.buttons = [{ label: '🛒 WebApp ilovasini ochish', action: 'webapp' }];
      }

      setMessages(prev => [...prev, botReply]);
      triggerHaptic('success');
    }, 600);
  };

  const handleButtonClick = (action) => {
    triggerHaptic('medium');
    if (action === 'webapp') {
      onLaunchWebApp();
    } else if (action === 'seller') {
      onOpenSellerPanel();
    } else if (action === 'track') {
      onLaunchWebApp('orders');
    }
  };

  return (
    <div className="bozor-container animate-fade" style={{ paddingTop: '20px', maxWidth: '680px' }}>
      {/* TG Frame Container */}
      <div 
        style={{
          background: '#0e1621',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          border: '1px solid #242f3d',
          display: 'flex',
          flexDirection: 'column',
          height: '620px'
        }}
      >
        {/* Telegram Header */}
        <div 
          style={{
            background: '#17212b',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid #242f3d'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            🍈
          </div>
          <div>
            <h4 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700, margin: 0 }}>Yunusobod Dehqon Bozori Bot</h4>
            <div style={{ fontSize: '0.78rem', color: '#53b4fc' }}>bot • online (24/7)</div>
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messages.map(msg => (
            <div 
              key={msg.id}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              <div 
                style={{
                  background: msg.sender === 'user' ? '#2b5278' : '#182533',
                  color: '#ffffff',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  fontSize: '0.9rem',
                  lineHeight: '1.45',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#7e9cb6', marginTop: '4px' }}>
                  {msg.time} {msg.sender === 'user' && '✓✓'}
                </div>
              </div>

              {/* Inline Buttons */}
              {msg.buttons && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {msg.buttons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={() => handleButtonClick(btn.action)}
                      style={{
                        background: '#2b5278',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      <span>{btn.label}</span>
                      <ExternalLink size={14} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form 
          onSubmit={handleSend}
          style={{
            background: '#17212b',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderTop: '1px solid #242f3d'
          }}
        >
          <input 
            type="text" 
            placeholder="Xabar yozing (masalan: /start yoki narx)..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            style={{
              flex: 1,
              background: '#242f3d',
              border: 'none',
              borderRadius: '20px',
              padding: '10px 16px',
              color: '#ffffff',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
          <button 
            type="submit"
            style={{
              background: '#53b4fc',
              color: '#ffffff',
              border: 'none',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
