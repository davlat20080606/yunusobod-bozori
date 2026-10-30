import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { UserPlus, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';

// The stall's team: the owner shows a QR code, a helper (son, apprentice, brother) scans it
// with the phone camera and gets into the same cabinet with their own Telegram, no PIN
export default function SellerTeam({ language }) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz));
  const [team, setTeam] = useState({ my_role: 'owner', members: [] });
  const [qr, setQr] = useState(null); // { image, link, expires }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.sellerMembers().then(setTeam).catch(() => {});
  useEffect(() => { load(); }, []);
  // A helper who scanned the code appears in the list without reloading
  useEffect(() => {
    if (!qr) return undefined;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [qr]);

  const isOwner = team.my_role === 'owner';

  const showQr = async () => {
    setBusy(true);
    setError('');
    try {
      const { link, expires_at: expiresAt } = await api.sellerInvite();
      const image = await QRCode.toDataURL(link, { width: 260, margin: 1, errorCorrectionLevel: 'M' });
      setQr({ image, link, expires: new Date(`${expiresAt}Z`) });
      triggerHaptic('success');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m) => {
    if (!window.confirm(tr(`${m.name} kabinetdan chiqarilsinmi?`, `Убрать ${m.name} из кабинета?`, `Remove ${m.name} from the cabinet?`))) return;
    await api.sellerRemoveMember(m.id).catch((e) => setError(e.message));
    load();
  };

  const expiresAt = qr?.expires ? qr.expires.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';

  return (
    <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>👥 {tr('Rasta jamoasi', 'Команда расты', 'Stall team')}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
        {isOwner
          ? tr(
            "O'g'lingiz, shogirdingiz yoki akangiz QR kodni telefon kamerasi bilan skanerlasa, shu kabinetga o'z Telegrami bilan kiradi — PIN kerak emas. Yangi buyurtmalar ularga ham keladi.",
            'Сын, ученик или брат сканирует QR-код камерой телефона и входит в этот кабинет со своего Telegram — без PIN. Новые заказы будут приходить и им.',
            'Your son, apprentice or brother scans the QR code with the phone camera and gets into this cabinet with their own Telegram — no PIN. New orders reach them too.')
          : tr("Siz bu rastada yordamchisiz. PIN va jamoani faqat rasta egasi o'zgartiradi.", 'Вы помощник в этой расте. PIN и команду меняет только владелец.', 'You are a helper in this stall. Only the owner changes the PIN and the team.')}
      </p>

      {team.members.map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 20 }}>{m.role === 'owner' ? '👑' : '🧑‍🔧'}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700 }}>{m.name}{m.is_me ? ` (${tr('siz', 'вы', 'you')})` : ''}</span>
            <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>{m.role === 'owner' ? tr('Rasta egasi', 'Владелец', 'Owner') : tr('Yordamchi', 'Помощник', 'Helper')}</span>
          </span>
          {isOwner && m.role !== 'owner' && (
            <button type="button" onClick={() => remove(m)} aria-label="remove" style={{ width: 36, height: 36, border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={16} /></button>
          )}
        </div>
      ))}

      {isOwner && !qr && (
        <button type="button" onClick={showQr} disabled={busy} style={{ width: '100%', height: 48, marginTop: 10, borderRadius: 12, border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}>
          <UserPlus size={18} /> {tr("Yordamchi qo'shish (QR)", 'Добавить помощника (QR)', 'Add a helper (QR)')}
        </button>
      )}

      {qr && (
        <div style={{ marginTop: 12, textAlign: 'center', padding: 14, borderRadius: 16, background: '#f8fafc', border: '1.5px dashed #94a3b8' }}>
          <img src={qr.image} alt="QR" style={{ width: 220, height: 220, imageRendering: 'pixelated' }} />
          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 6 }}>
            📷 {tr('Yordamchi telefon kamerasi bilan skanerlasin', 'Пусть помощник наведёт камеру телефона', 'Let the helper scan it with the phone camera')}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {tr(`Bir martalik · ${expiresAt} gacha amal qiladi`, `Одноразовый · действует до ${expiresAt}`, `One-time · valid until ${expiresAt}`)}
          </div>
          <button type="button" onClick={() => setQr(null)} style={{ marginTop: 10, padding: '8px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
            {tr('Yopish', 'Закрыть', 'Close')}
          </button>
        </div>
      )}
      {error && <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>}
    </div>
  );
}
