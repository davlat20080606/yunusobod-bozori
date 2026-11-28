import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Phone, Trash2, Pencil } from 'lucide-react';
import { api } from '../services/api';
import { triggerHaptic, tg } from '../services/telegram';
import './clients.css';

// 👥 Mijozlarim (Shuhrat, 2026-11-28): the stall's own customers. 1) a list by hand, filled by the nasiya notebook
// too; 2) a personal QR per customer: scanned on this screen, «Start», the name is already there, the stall opens;
// 3) the stall's invite for buyers (fine on the counter): straight to this stall's goods.
const T = {
  title: { uz: '👥 Mijozlarim', ru: '👥 Мои покупатели', en: '👥 My customers' },
  sub: {
    uz: "Doimiy xaridorlaringiz. Nasiyaga yozganlaringiz va havola orqali kelganlar bu yerga o'zi tushadi.",
    ru: 'Ваши постоянные покупатели. Те, кому вы дали в насию, и пришедшие по ссылке, попадают сюда сами.',
    en: 'Your regulars. Whoever you give credit to, and those who came by your link, appear here by themselves.',
  },
  shop_title: { uz: '🛒 Rastamga taklif', ru: '🛒 Пригласить в расту', en: '🛒 Invite to my stall' },
  shop_hint: {
    uz: "Xaridor shu QR yoki havola orqali to'g'ri rastangiz mahsulotlariga tushadi. Bu QR ni peshtaxtaga ilsa bo'ladi.",
    ru: 'По этому QR или ссылке покупатель попадает прямо в товары вашей расты. Этот QR можно повесить на прилавок.',
    en: 'With this QR or link a buyer lands straight in your stall\'s goods. This QR may hang on the counter.',
  },
  show_qr: { uz: "QR va havolani ko'rsatish", ru: 'Показать QR и ссылку', en: 'Show the QR and link' },
  share: { uz: '📤 Ulashish', ru: '📤 Поделиться', en: '📤 Share' },
  copy: { uz: '📋 Nusxa olish', ru: '📋 Скопировать', en: '📋 Copy' },
  copied: { uz: 'Nusxa olindi', ru: 'Скопировано', en: 'Copied' },
  share_text: { uz: "Mening rastamdagi mahsulotlar — bozorga bormasdan buyurtma bering", ru: 'Товары моей расты — заказывайте, не выходя из дома', en: 'The goods of my stall — order without going to the bazaar' },
  add: { uz: "+ Mijoz qo'shish", ru: '+ Добавить покупателя', en: '+ Add a customer' },
  name: { uz: 'Ismi', ru: 'Имя', en: 'Name' },
  phone: { uz: 'Telefon (ixtiyoriy)', ru: 'Телефон (необязательно)', en: 'Phone (optional)' },
  note: { uz: "Izoh: masalan «har juma keladi»", ru: 'Заметка: например «приходит по пятницам»', en: 'Note: e.g. «comes on Fridays»' },
  save: { uz: 'Saqlash', ru: 'Сохранить', en: 'Save' },
  cancel: { uz: 'Bekor', ru: 'Отмена', en: 'Cancel' },
  search: { uz: 'Ism yoki telefon', ru: 'Имя или телефон', en: 'Name or phone' },
  empty: {
    uz: "Hali mijoz yo'q. Nasiyaga yozganlaringiz o'zi tushadi — yoki «+ Mijoz qo'shish» ni bosing.",
    ru: 'Покупателей пока нет. Записанные в насию появятся сами — или нажмите «+ Добавить покупателя».',
    en: 'No customers yet. Those you give credit to appear by themselves — or tap «+ Add a customer».',
  },
  nothing: { uz: 'Hech kim topilmadi', ru: 'Никого не найдено', en: 'Nobody found' },
  in_bot: { uz: '✅ botda', ru: '✅ в боте', en: '✅ in the bot' },
  from_nasiya: { uz: '📒 nasiya', ru: '📒 насия', en: '📒 credit' },
  from_link: { uz: '🛒 havola', ru: '🛒 по ссылке', en: '🛒 link' },
  invite: { uz: '📲 Botga taklif', ru: '📲 Пригласить в бот', en: '📲 Invite to the bot' },
  invite_title: { uz: '📲 {name} uchun shaxsiy QR', ru: '📲 Личный QR для {name}', en: '📲 A personal QR for {name}' },
  invite_hint: {
    uz: "Mijoz shu QR ni o'z telefoni kamerasi bilan skanerlasin va «Start» ni bossin. Ismi tayyor — faqat «📱 Raqamni yuborish» qoladi, keyin rastangiz mahsulotlari ochiladi.",
    ru: 'Пусть покупатель отсканирует этот QR камерой своего телефона и нажмёт «Start». Имя уже вписано — останется «Отправить номер», затем откроются товары вашей расты.',
    en: 'Let the customer scan this QR with their phone camera and tap «Start». The name is already in — only «Share number» is left, then your stall\'s goods open.',
  },
  invite_rule: { uz: "Telegram qoidasi: «Start» ni odam o'zi bosishi kerak.", ru: 'Правило Telegram: «Start» человек нажимает сам.', en: 'Telegram rule: the person taps «Start» themselves.' },
  close: { uz: 'Yopish', ru: 'Закрыть', en: 'Close' },
  delete_confirm: {
    uz: "{name} ro'yxatdan o'chirilsinmi? Nasiya yozuvlari saqlanib qoladi.",
    ru: 'Убрать {name} из списка? Записи в насии останутся.',
    en: 'Remove {name} from the list? Credit entries stay.',
  },
  saved: { uz: 'Saqlandi', ru: 'Сохранено', en: 'Saved' },
};

function QrDialog({ title, hint, rule, link, shareText, lang, t, onClose, testid }) {
  const [img, setImg] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { QRCode.toDataURL(link, { width: 520, margin: 1, errorCorrectionLevel: 'M' }).then(setImg); }, [link]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const share = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank', 'noopener');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); triggerHaptic('success'); setTimeout(() => setCopied(false), 2000); } catch { /* the link is on the screen */ }
  };
  return createPortal(
    <div className="cl-dialog" role="dialog" aria-modal="true" aria-label={title} data-testid={testid} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cl-dialog-box">
        <div className="cl-dialog-title">{title}</div>
        {img ? <img src={img} alt="QR" className="cl-qr" /> : <div className="cl-qr cl-qr-skel" />}
        <div className="cl-dialog-hint">{hint}</div>
        {rule && <div className="cl-dialog-rule">{rule}</div>}
        <div className="cl-link" data-testid="cl-link">{link}</div>
        <div className="cl-row2">
          <button type="button" className="cl-btn cl-btn-primary" onClick={share}>{t('share')}</button>
          <button type="button" className="cl-btn" onClick={copy}>{copied ? `✅ ${t('copied')}` : t('copy')}</button>
        </div>
        <button type="button" className="cl-btn" onClick={onClose} autoFocus>{t('close')}</button>
      </div>
    </div>,
    document.body,
  );
}

export default function SellerClients({ language }) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const t = (k) => T[k]?.[lang] ?? k;
  const [clients, setClients] = useState(null); // null while loading
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(null); // { id?, name, phone, note }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // { kind: 'shop' | 'client', link, name }

  const load = useCallback(() => api.sellerClients().then((r) => setClients(r.clients)).catch((e) => { setClients([]); setError(e.message); }), []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return (clients || []).filter((c) => !q || c.name.toLowerCase().includes(q) || (digits && (c.phone || '').replace(/\D/g, '').includes(digits)));
  }, [clients, query]);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await fn(); triggerHaptic('success'); } catch (e) { triggerHaptic('error'); setError(e.message); } finally { setBusy(false); }
  };

  const save = (e) => {
    e.preventDefault();
    const body = { name: form.name.trim(), phone: form.phone.replace(/\D/g, '').length > 3 ? form.phone : null, note: form.note.trim() || null };
    run(async () => {
      if (form.id) await api.sellerEditClient(form.id, body); else await api.sellerAddClient(body);
      setForm(null);
      await load();
    });
  };

  const openShop = () => run(async () => {
    const { link } = await api.sellerShopLink();
    setDialog({ kind: 'shop', link });
  });
  const openInvite = (c) => run(async () => {
    const { link } = await api.sellerInviteClient(c.id);
    setDialog({ kind: 'client', link, name: c.name });
  });
  const remove = (c) => {
    if (!window.confirm(t('delete_confirm').replace('{name}', c.name))) return;
    run(async () => { await api.sellerDeleteClient(c.id); await load(); });
  };
  const closeDialog = useCallback(() => { setDialog(null); load(); }, [load]);

  const formOk = form && form.name.trim().length >= 2 && (!form.phone.replace(/\D/g, '').length || form.phone.replace(/\D/g, '').length >= 9);

  return (
    <section className="cl-card" data-testid="seller-clients">
      <div className="cl-head">
        <h3 className="cl-title">{t('title')}{clients?.length ? <span className="cl-count">{clients.length}</span> : null}</h3>
      </div>
      <p className="cl-sub">{t('sub')}</p>

      <div className="cl-shop">
        <div className="cl-shop-title">{t('shop_title')}</div>
        <div className="cl-shop-hint">{t('shop_hint')}</div>
        <button type="button" className="cl-btn cl-btn-green" data-testid="cl-shop" onClick={openShop} disabled={busy}>{t('show_qr')}</button>
      </div>

      {error && <div className="cl-error" role="alert">⚠️ {error}</div>}

      {form ? (
        <form className="cl-form" onSubmit={save} data-testid="cl-form">
          <input className="cl-input" data-testid="cl-name" value={form.name} maxLength={100} placeholder={t('name')} autoFocus
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="cl-input" data-testid="cl-phone" value={form.phone} type="tel" inputMode="tel" maxLength={20} placeholder={t('phone')}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <input className="cl-input" data-testid="cl-note" value={form.note} maxLength={200} placeholder={t('note')}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          <div className="cl-row2">
            <button type="submit" className="cl-btn cl-btn-primary" data-testid="cl-save" disabled={!formOk || busy}>{busy ? '…' : t('save')}</button>
            <button type="button" className="cl-btn" onClick={() => setForm(null)}>{t('cancel')}</button>
          </div>
        </form>
      ) : (
        <button type="button" className="cl-btn cl-btn-outline" data-testid="cl-add" onClick={() => setForm({ name: '', phone: '+998 ', note: '' })}>{t('add')}</button>
      )}

      {clients === null && <div className="cl-skel" aria-hidden="true"><div /><div /><div /></div>}
      {clients?.length > 4 && (
        <input className="cl-input cl-search" data-testid="cl-search" value={query} placeholder={`🔎 ${t('search')}`} onChange={(e) => setQuery(e.target.value)} />
      )}
      {clients?.length === 0 && <div className="cl-empty" data-testid="cl-empty">{t('empty')}</div>}
      {clients?.length > 0 && shown.length === 0 && <div className="cl-empty">{t('nothing')}</div>}

      <ul className="cl-list">
        {shown.map((c) => (
          <li key={c.id} className="cl-item" data-testid="cl-item">
            <div className="cl-item-main">
              <div className="cl-item-name">{c.name}</div>
              <div className="cl-item-meta">
                {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="cl-phone"><Phone size={12} /> {c.phone}</a>}
                {c.in_bot && <span className="cl-badge cl-badge-ok">{t('in_bot')}</span>}
                {c.source === 'nasiya' && <span className="cl-badge">{t('from_nasiya')}</span>}
                {c.source === 'link' && <span className="cl-badge">{t('from_link')}</span>}
              </div>
              {c.note && <div className="cl-item-note">{c.note}</div>}
            </div>
            <div className="cl-item-actions">
              {!c.in_bot && <button type="button" className="cl-btn cl-btn-small" data-testid="cl-invite" onClick={() => openInvite(c)}>{t('invite')}</button>}
              <button type="button" className="cl-icon" aria-label="edit" onClick={() => setForm({ id: c.id, name: c.name, phone: c.phone || '+998 ', note: c.note || '' })}><Pencil size={15} /></button>
              <button type="button" className="cl-icon cl-icon-red" aria-label="remove" onClick={() => remove(c)}><Trash2 size={15} /></button>
            </div>
          </li>
        ))}
      </ul>

      {dialog?.kind === 'shop' && (
        <QrDialog testid="cl-shop-dialog" title={t('shop_title')} hint={t('shop_hint')} link={dialog.link} shareText={t('share_text')} lang={lang} t={t} onClose={closeDialog} />
      )}
      {dialog?.kind === 'client' && (
        <QrDialog testid="cl-invite-dialog" title={t('invite_title').replace('{name}', dialog.name)} hint={t('invite_hint')} rule={t('invite_rule')}
          link={dialog.link} shareText={t('share_text')} lang={lang} t={t} onClose={closeDialog} />
      )}
    </section>
  );
}
