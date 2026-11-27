import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { api } from '../services/api';
import { triggerHaptic, scanQr, canScanQr, getTelegramInitData } from '../services/telegram';
import './kits.css';

// 📄 QR sheets (Shuhrat, 2026-11-26): print blank sheets before going to the bazaar, register a stall on the spot and
// bind its sheet by scanning it. The bozorkom, the founder and the partner can all do it; a stall registered by the
// founder or the partner still waits for the bozorkom's approval in «Arizalar».
const T = {
  register: { uz: '🏪 Yangi sotuvchini ro\'yxatga olish', ru: '🏪 Зарегистрировать продавца', en: '🏪 Register a seller' },
  register_hint: {
    uz: "Rasta oldida to'ldiring, varaqni skanerlang va sotuvchiga bering.",
    ru: 'Заполните у расты, отсканируйте лист и отдайте продавцу.',
    en: 'Fill it in at the stall, scan the sheet and hand it to the seller.',
  },
  name: { uz: 'Rasta nomi', ru: 'Название расты', en: 'Stall name' },
  stall: { uz: 'Rasta raqami (masalan M-17)', ru: 'Номер расты (например М-17)', en: 'Stall number (e.g. M-17)' },
  category: { uz: "Bo'lim", ru: 'Раздел', en: 'Section' },
  owner: { uz: 'Sotuvchi ismi', ru: 'Имя продавца', en: "Seller's name" },
  owner_phone: { uz: 'Sotuvchi telefoni', ru: 'Телефон продавца', en: "Seller's phone" },
  helpers: { uz: 'Yordamchilar telefoni (ixtiyoriy)', ru: 'Телефоны помощников (необязательно)', en: "Helpers' phones (optional)" },
  helpers_hint: {
    uz: "Bu raqamlar QR ni skanerlab, raqamini ulashsa — egasini kutmasdan kiradi.",
    ru: 'С этими номерами помощник войдёт сразу, без владельца: отсканирует QR и поделится номером.',
    en: 'With these numbers a helper gets in at once: scan the QR and share the number.',
  },
  add_helper: { uz: "+ Yana yordamchi", ru: '+ Ещё помощник', en: '+ Another helper' },
  sheet: { uz: 'Varaq', ru: 'Лист', en: 'Sheet' },
  scan: { uz: '📷 Varaqni skanerlash', ru: '📷 Сканировать лист', en: '📷 Scan the sheet' },
  scan_hint: { uz: 'Varaqdagi QR kodni ramkaga keltiring', ru: 'Наведите камеру на QR-код листа', en: "Point the camera at the sheet's QR" },
  code_ph: { uz: 'yoki kod: BZR-0042', ru: 'или код: BZR-0042', en: 'or the code: BZR-0042' },
  code_only: { uz: 'Varaq kodi: BZR-0042', ru: 'Код листа: BZR-0042', en: 'Sheet code: BZR-0042' },
  free: { uz: "bo'sh", ru: 'свободен', en: 'blank' },
  used: { uz: 'band', ru: 'занят', en: 'in use' },
  revoked: { uz: 'bekor qilingan', ru: 'отменён', en: 'cancelled' },
  submit: { uz: "Ro'yxatga olish", ru: 'Зарегистрировать', en: 'Register' },
  done_pending: {
    uz: "✅ {kit} biriktirildi. Bozorkom tasdiqlagach, sotuvchi QR ni skanerlab kiradi.",
    ru: '✅ {kit} привязан. После подтверждения бозоркома продавец входит, отсканировав QR.',
    en: '✅ {kit} linked. Once the bozorkom approves, the seller scans the QR to get in.',
  },
  done_approved: {
    uz: '✅ {kit} biriktirildi. Sotuvchi hoziroq QR ni skanerlab kirishi mumkin.',
    ru: '✅ {kit} привязан. Продавец может войти прямо сейчас, отсканировав QR.',
    en: '✅ {kit} linked. The seller can scan the QR and get in right now.',
  },
  seller_pin: {
    uz: 'Brauzerdan kirish uchun PIN: {pin} — sotuvchiga ayting.',
    ru: 'PIN для входа из браузера: {pin} — скажите продавцу.',
    en: 'PIN for the browser: {pin} — tell the seller.',
  },
  bind_title: { uz: '🔗 Mavjud rastaga varaq', ru: '🔗 Лист для существующей расты', en: '🔗 A sheet for an existing stall' },
  bind_hint: {
    uz: "Botdagi rastaga birinchi varaq yoki yo'qolgan varaq o'rniga yangisi.",
    ru: 'Первый лист для расты, которая уже в боте, или новый вместо потерянного.',
    en: 'A first sheet for a stall already in the bot, or a new one for a lost sheet.',
  },
  pick_stall: { uz: 'Rastani tanlang', ru: 'Выберите расту', en: 'Choose the stall' },
  bind: { uz: 'Biriktirish', ru: 'Привязать', en: 'Link' },
  bound_ok: { uz: 'Varaq biriktirildi', ru: 'Лист привязан', en: 'Sheet linked' },
  sheets: { uz: '📄 Varaqlar', ru: '📄 Листы', en: '📄 Sheets' },
  make: { uz: 'Chop etish uchun yangi varaqlar', ru: 'Новые листы для печати', en: 'New sheets to print' },
  make_btn: { uz: 'Yaratish va chop etish', ru: 'Создать и распечатать', en: 'Create and print' },
  print_free: { uz: "🖨 Bo'sh varaqlarni qayta chop etish", ru: '🖨 Перепечатать свободные листы', en: '🖨 Reprint blank sheets' },
  revoke: { uz: 'Bekor qilish', ru: 'Отменить', en: 'Cancel' },
  revoke_confirm: {
    uz: "{code} varag'ini bekor qilasizmi? U boshqa ishlamaydi. Rastadagi xodimlar qoladi.",
    ru: 'Отменить лист {code}? Он перестанет работать. Люди расты останутся.',
    en: 'Cancel sheet {code}? It will stop working. The stall\'s people stay.',
  },
  revoked_ok: { uz: 'Varaq bekor qilindi', ru: 'Лист отменён', en: 'Sheet cancelled' },
  empty: {
    uz: "Hali varaq yo'q. Bozorga borishdan oldin 20–50 tasini chop eting.",
    ru: 'Листов пока нет. Перед походом на базар распечатайте 20–50 штук.',
    en: 'No sheets yet. Print 20–50 before going to the bazaar.',
  },
  print: { uz: '🖨 Chop etish', ru: '🖨 Печать', en: '🖨 Print' },
  close: { uz: 'Yopish', ru: 'Закрыть', en: 'Close' },
  print_in_tg: {
    uz: "Telegram ichida chop etib bo'lmaydi: kompyuterda bozorkom.bozorbot.uz ni oching.",
    ru: 'В Telegram печать недоступна: откройте bozorkom.bozorbot.uz на компьютере.',
    en: 'Printing is not available in Telegram: open bozorkom.bozorbot.uz on a computer.',
  },
};

const STATUS_COLOR = { unbound: '#047857', bound: 'var(--naqsh-blue)', revoked: '#94a3b8' };
const input = { width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 15, marginBottom: 6, background: '#ffffff' };
const card = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 12, marginBottom: 8 };
const btn = (bg, color = '#ffffff') => ({ minHeight: 44, padding: '0 14px', borderRadius: 12, border: 'none', background: bg, color, fontWeight: 800, fontSize: 14, cursor: 'pointer' });
const phoneDigits = (p) => p.replace(/\D/g, '');

function SheetPicker({ value, onChange, lang, t }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!value.trim()) { setInfo(null); setError(''); return undefined; }
    const timer = setTimeout(() => {
      api.adminLookupKit(value).then((k) => { setInfo(k); setError(''); }).catch((e) => { setInfo(null); setError(e.message); });
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);
  const scan = async () => {
    const text = await scanQr(t('scan_hint'));
    if (text) { triggerHaptic('success'); onChange(text); }
  };
  const label = info ? `${info.code} · ${info.status === 'unbound' ? t('free') : info.status === 'bound' ? `${t('used')}${info.store ? `: ${info.store}` : ''}` : t('revoked')}` : '';
  return (
    <div>
      <div className="kit-label">{t('sheet')}</div>
      {canScanQr() && (
        <button type="button" data-testid="kit-scan" onClick={scan} style={{ ...btn('var(--naqsh-blue)', 'var(--naqsh-gold)'), width: '100%', marginBottom: 6 }}>{t('scan')}</button>
      )}
      <input data-testid="kit-code" value={value.startsWith('http') ? (info?.code || '…') : value} placeholder={t(canScanQr() ? 'code_ph' : 'code_only')}
        onChange={(e) => onChange(e.target.value)} style={{ ...input, textTransform: value ? 'uppercase' : 'none' }} autoCapitalize="characters" />
      {label && <div data-testid="kit-status" style={{ fontSize: 13, fontWeight: 800, color: info.status === 'unbound' ? '#047857' : '#b45309', marginBottom: 6 }}>📄 {label}</div>}
      {error && value.length > 3 && <div style={{ fontSize: 13, color: '#b91c1c', marginBottom: 6 }}>{error}</div>}
    </div>
  );
}

function PrintSheets({ bot, kits, onClose, t }) {
  const [images, setImages] = useState({});
  useEffect(() => {
    document.body.classList.add('kit-printing');
    Promise.all(kits.map(async (k) => [k.id, await QRCode.toDataURL(`https://t.me/${bot}?start=kit_${k.token}`, { width: 520, margin: 1, errorCorrectionLevel: 'M' })]))
      .then((pairs) => setImages(Object.fromEntries(pairs)));
    return () => document.body.classList.remove('kit-printing');
  }, [bot, kits]);
  const inTelegram = Boolean(getTelegramInitData());
  return createPortal(
    <div className="kit-print-root" data-testid="kit-print">
      <div className="kit-print-bar">
        <b>{kits.length} × 📄</b>
        {inTelegram ? <span style={{ fontSize: 13 }}>{t('print_in_tg')}</span>
          : <button type="button" onClick={() => window.print()} style={btn('var(--naqsh-blue)', 'var(--naqsh-gold)')}>{t('print')}</button>}
        <button type="button" onClick={onClose} style={btn('#f1f5f9', '#334155')}>{t('close')}</button>
      </div>
      {kits.map((k) => (
        <section key={k.id} className="kit-sheet">
          <header>
            <div className="kit-sheet-title">🏛 Yunusobod Dehqon Bozori</div>
            <div className="kit-sheet-sub">Sotuvchi va yordamchilar uchun · Для продавца и помощников</div>
          </header>
          <div className="kit-sheet-qr">{images[k.id] ? <img src={images[k.id]} alt={k.code} /> : null}</div>
          <div className="kit-sheet-code">KOD: {k.code}</div>
          <ol className="kit-sheet-steps">
            <li><b>Telefon kamerasi bilan QR kodni skanerlang.</b> Bot ochiladi.<br /><span>Отсканируйте QR камерой телефона — откроется бот.</span></li>
            <li><b>«📞 Raqamni ulashish» ni bosing.</b> Rasta egasi darhol kabinetga kiradi.<br /><span>Нажмите «Поделиться номером» — владелец сразу входит в кабинет.</span></li>
            <li><b>Yordamchilar ham shu QR ni skanerlaydi.</b> Raqami ro'yxatda bo'lsa — darhol kiradi; bo'lmasa — pastdagi kodni kiritadi yoki egasidan ruxsat so'raydi.<br /><span>Помощники сканируют тот же QR: по номеру из списка — сразу, иначе код ниже или разрешение владельца.</span></li>
          </ol>
          <div className="kit-sheet-pin">
            Faollashtirish kodi · Код активации: <b>{k.pin}</b>
            <div>Faqat o'z xodimlaringizga ayting · Сообщайте только своим работникам</div>
          </div>
          <footer>
            ⚠️ Bu varaqni rastaga yopishtirmang — u faqat xodimlar uchun. Yo'qolsa, bozorkomga ayting: eski varaq o'chiriladi.<br />
            Не вешайте этот лист на расту — он только для работников. Потеряли — скажите бозоркому, старый лист отключат.
          </footer>
        </section>
      ))}
    </div>,
    document.body,
  );
}

export default function KitsPanel({ lang, stores, categories, onError, onNotice, onChanged }) {
  const t = (key) => T[key]?.[lang] ?? key;
  const [kits, setKits] = useState([]);
  const [counts, setCounts] = useState({});
  const [count, setCount] = useState('20');
  const [printing, setPrinting] = useState(null);
  const [busy, setBusy] = useState(false);
  const empty = { name_uz: '', stall_number: '', category_slug: '', owner_name: '', owner_phone: '+998 ', helper_phones: [''], kit: '' };
  const [form, setForm] = useState(empty);
  const [result, setResult] = useState(null);
  const [bindForm, setBindForm] = useState({ store_id: '', kit: '' });

  const load = useCallback(() => api.adminKits().then((r) => { setKits(r.kits); setCounts(r.counts || {}); }).catch((e) => onError(e.message)), [onError]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, message) => {
    if (busy) return;
    setBusy(true);
    onError('');
    try {
      await fn();
      triggerHaptic('success');
      if (message) onNotice(message);
    } catch (e) {
      triggerHaptic('error');
      onError(e.message);
    } finally {
      setBusy(false);
      load();
    }
  };

  const fetchPrint = async (ids) => {
    const r = await api.adminPrintKits(ids);
    if (r.kits.length) setPrinting(r);
  };
  const openPrint = (ids) => run(() => fetchPrint(ids));

  const formOk = form.name_uz.trim().length >= 2 && form.stall_number.trim() && form.category_slug && form.owner_name.trim().length >= 2
    && phoneDigits(form.owner_phone).length >= 12 && form.kit.trim();

  const register = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api.adminFieldRegister({ ...form, helper_phones: form.helper_phones.filter((p) => phoneDigits(p).length > 3) });
      setResult(r);
      setForm(empty);
      onChanged();
    });
  };

  const field = (key, label, extra = {}) => (
    <input data-testid={`kit-${key}`} value={form[key]} placeholder={t(label)} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={input} {...extra} />
  );

  const categoryList = Object.values(categories);
  const freeIds = kits.filter((k) => k.status === 'unbound').map((k) => k.id);

  return (
    <div data-testid="kits-panel">
      {result && (
        <div data-testid="kit-result" style={{ ...card, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 14, fontWeight: 700 }}>
          {t(result.status === 'approved' ? 'done_approved' : 'done_pending').replace('{kit}', result.kit)}
          <div style={{ fontWeight: 600, marginTop: 4 }}>{t('seller_pin').replace('{pin}', result.seller_pin)}</div>
        </div>
      )}
      <form className="kit-form" style={{ ...card, border: '2px solid var(--naqsh-gold)' }} onSubmit={register}>
        <b style={{ fontSize: 16 }}>{t('register')}</b>
        <div style={{ fontSize: 13, color: '#64748b', margin: '2px 0 10px' }}>{t('register_hint')}</div>
        <SheetPicker value={form.kit} onChange={(kit) => setForm((f) => ({ ...f, kit }))} lang={lang} t={t} />
        <div className="kit-grid">
          {field('name_uz', 'name')}
          {field('stall_number', 'stall')}
          <select data-testid="kit-category" value={form.category_slug} onChange={(e) => setForm((f) => ({ ...f, category_slug: e.target.value }))} style={input}>
            <option value="">{t('category')}</option>
            {categoryList.map((c) => <option key={c.slug} value={c.slug}>{`${c.icon || ''} ${c[`name_${lang}`] || c.name_uz}`.trim()}</option>)}
          </select>
          {field('owner_name', 'owner')}
          {field('owner_phone', 'owner_phone', { type: 'tel', inputMode: 'tel' })}
        </div>
        <div className="kit-label">{t('helpers')}</div>
        {form.helper_phones.map((p, i) => (
          <input key={i} data-testid={`kit-helper-${i}`} type="tel" inputMode="tel" value={p} placeholder="+998" style={input}
            onChange={(e) => setForm((f) => ({ ...f, helper_phones: f.helper_phones.map((x, j) => (j === i ? e.target.value : x)) }))} />
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#64748b', minWidth: 0 }}>{t('helpers_hint')}</span>
          {form.helper_phones.length < 5 && (
            <button type="button" onClick={() => setForm((f) => ({ ...f, helper_phones: [...f.helper_phones, '+998 '] }))} style={{ ...btn('#f1f5f9', '#334155'), flexShrink: 0, fontSize: 13 }}>{t('add_helper')}</button>
          )}
        </div>
        <button type="submit" data-testid="kit-register" disabled={!formOk || busy} className="kit-submit" style={{ ...btn('#047857'), width: '100%' }}>
          {busy ? '…' : t('submit')}
        </button>
      </form>


      <form style={card} onSubmit={(e) => {
        e.preventDefault();
        run(() => api.adminBindKit(bindForm.kit, Number(bindForm.store_id)).then(() => setBindForm({ store_id: '', kit: '' })), t('bound_ok'));
      }}>
        <b style={{ fontSize: 15 }}>{t('bind_title')}</b>
        <div style={{ fontSize: 13, color: '#64748b', margin: '2px 0 8px' }}>{t('bind_hint')}</div>
        <select value={bindForm.store_id} onChange={(e) => setBindForm((f) => ({ ...f, store_id: e.target.value }))} style={input}>
          <option value="">{t('pick_stall')}</option>
          {stores.filter((s) => s.status === 'approved' || s.status === 'pending').map((s) => (
            <option key={s.id} value={s.id}>{s.stall_number} · {s.name_uz}</option>
          ))}
        </select>
        <SheetPicker value={bindForm.kit} onChange={(kit) => setBindForm((f) => ({ ...f, kit }))} lang={lang} t={t} />
        <button type="submit" disabled={!bindForm.store_id || !bindForm.kit.trim() || busy} style={{ ...btn('var(--naqsh-blue)', 'var(--naqsh-gold)'), width: '100%' }}>{t('bind')}</button>
      </form>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <b style={{ fontSize: 15 }}>{t('sheets')}</b>
          <span className="kit-counts">
            <span style={{ color: STATUS_COLOR.unbound }}>{counts.unbound || 0} {t('free')}</span> · {counts.bound || 0} {t('used')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
          <input data-testid="kit-count" type="number" min="1" max="200" value={count} onChange={(e) => setCount(e.target.value)} aria-label={t('make')} style={{ ...input, width: 90, marginBottom: 0 }} />
          <button type="button" data-testid="kit-make" disabled={busy || !(Number(count) >= 1 && Number(count) <= 200)} style={{ ...btn('var(--naqsh-blue)', 'var(--naqsh-gold)'), flex: 1 }}
            onClick={() => run(async () => { const r = await api.adminMakeKits(Number(count)); await fetchPrint(r.kits.map((k) => k.id)); })}>
            {t('make_btn')}
          </button>
        </div>
        {freeIds.length > 0 && <button type="button" onClick={() => openPrint(freeIds)} style={{ ...btn('#f1f5f9', '#334155'), width: '100%', marginBottom: 8 }}>{t('print_free')}</button>}
        {kits.length === 0 && <div style={{ color: '#64748b', fontSize: 14, padding: '8px 0' }}>{t('empty')}</div>}
        {kits.map((k) => (
          <div key={k.id} className="kit-row" data-testid="kit-row">
            <b className="kit-row-code">{k.code}</b>
            <span className="kit-row-store" style={{ color: STATUS_COLOR[k.status] }}>
              {k.status === 'bound' ? (k.store || t('used')) : k.status === 'unbound' ? t('free') : t('revoked')}
            </span>
            {k.status !== 'revoked' && (
              <button type="button" className="kit-row-btn" onClick={() => window.confirm(t('revoke_confirm').replace('{code}', k.code)) && run(() => api.adminRevokeKit(k.id), t('revoked_ok'))}>
                {t('revoke')}
              </button>
            )}
          </div>
        ))}
      </div>

      {printing && <PrintSheets bot={printing.bot} kits={printing.kits} t={t} onClose={() => setPrinting(null)} />}
    </div>
  );
}
