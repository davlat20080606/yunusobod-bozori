import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';
import '../nasiya.css';

// 📒 Nasiya daftari (Shuhrat, 2026-11-21): the stall's own notebook of goods given on credit.
// The buyer confirms in the bot; reminders only to those who confirmed; nothing is deleted, a mistake is cancelled.
// Opened from the cabinet card, from the bot's morning list (?nasiya=1) or from an order («📒 Nasiyaga yozish»).

const fmt = (n) => Math.round(n || 0).toLocaleString('ru-RU').replace(/ /g, ' ');
const digits = (s) => String(s || '').replace(/\D/g, '');
const keyOf = (d) => (d.customer_phone ? `p${digits(d.customer_phone).slice(-9)}` : `n${d.customer_name.trim().toLowerCase()}`);

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const shortDate = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : '');

export function openNasiya(prefill) {
  window.dispatchEvent(new CustomEvent('nasiya-open', { detail: prefill || null }));
}

// Esc closes, Tab stays inside, the first field gets focus
function useSheetKeys(ref, onClose, active) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!active) return undefined;
    const box = ref.current;
    const first = box?.querySelector('input, button:not([disabled])');
    first?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab' || !box) return;
      const items = [...box.querySelectorAll('button:not([disabled]), input, a[href]')];
      if (!items.length) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, ref]);
}

function Sheet({ title, sub, onClose, children, testid }) {
  const ref = useRef(null);
  useSheetKeys(ref, onClose, true);
  return (
    <div className="nz-sheet-back" onClick={onClose}>
      <div ref={ref} className="nz-sheet" role="dialog" aria-modal="true" aria-label={title} data-testid={testid} onClick={(e) => e.stopPropagation()}>
        <div className="nz-grab" />
        <h3>{title}</h3>
        {sub && <div className="nz-sheet-sub">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

function MainButton({ busy, children, ...rest }) {
  return (
    <button type="submit" className="nz-main" disabled={busy} aria-busy={busy} {...rest}>
      {busy ? <span className="nz-spin" aria-hidden /> : children}
    </button>
  );
}

export default function SellerDebts({ language, isOwner }) {
  const lang = language === 'en' ? 'en' : (language === 'ru' ? 'ru' : 'uz');
  const tr = useCallback((uz, ru, en) => (lang === 'ru' ? ru : (lang === 'en' ? en : uz)), [lang]);
  const cur = tr("so'm", 'сум', 'sum');

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('open');
  const [expanded, setExpanded] = useState({});
  const [sheet, setSheet] = useState(null); // {kind: new|pay|snooze|more, debt?, prefill?}
  const [toast, setToast] = useState('');
  const screenRef = useRef(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setData(await api.sellerDebts());
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // From the bot's morning list, or from an order in the cabinet
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('nasiya') === '1') setOpen(true);
    const onOpen = (e) => {
      setOpen(true);
      if (e.detail) setSheet({ kind: 'new', prefill: e.detail });
    };
    window.addEventListener('nasiya-open', onOpen);
    return () => window.removeEventListener('nasiya-open', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    load();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, load]);

  const closeScreen = useCallback(() => { setSheet(null); setOpen(false); }, []);
  useEffect(() => {
    if (!open || sheet) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeScreen(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sheet, closeScreen]);

  const say = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 2600);
  };

  // Replace one debt in the list after an action, without a reload
  const put = (debt) => setData((prev) => (prev ? { ...prev, debts: prev.debts.map((d) => (d.id === debt.id ? { ...d, ...debt } : d)) } : prev));

  const summary = data?.summary;
  const today = data?.today;

  const groups = useMemo(() => {
    if (!data) return [];
    const wanted = data.debts.filter((d) => (view === 'open' ? d.status === 'open' : d.status !== 'open'));
    const map = new Map();
    for (const d of wanted) {
      const k = keyOf(d);
      if (!map.has(k)) map.set(k, { key: k, name: d.customer_name, phone: d.customer_phone, debts: [] });
      map.get(k).debts.push(d);
    }
    const list = [...map.values()].map((g) => ({
      ...g,
      left: g.debts.reduce((s, d) => s + (d.status === 'open' ? d.left : 0), 0),
      total: g.debts.reduce((s, d) => s + d.amount, 0),
      worst: Math.max(...g.debts.map((d) => (d.status === 'open' ? d.days_late : -999))),
      claim: g.debts.some((d) => d.paid_claim),
      nextDue: g.debts.map((d) => d.due_date).sort()[0],
    }));
    return view === 'open'
      ? list.sort((a, b) => Number(b.claim) - Number(a.claim) || b.worst - a.worst || b.left - a.left)
      : list.sort((a, b) => (b.debts[0].closed_at || '').localeCompare(a.debts[0].closed_at || ''));
  }, [data, view]);

  const dueBadge = (d) => {
    if (d.status === 'paid') return <span className="nz-badge ok">✅ {tr("To'landi", 'Оплачено', 'Paid')}</span>;
    if (d.status === 'cancelled') return <span className="nz-badge muted">↩️ {tr('Bekor qilingan', 'Отменено', 'Cancelled')}</span>;
    if (d.days_late > 0) return <span className="nz-badge late">🔴 {d.days_late} {tr('kun kechikdi', 'дн. просрочки', 'days late')}</span>;
    if (d.days_late === 0) return <span className="nz-badge today">⏰ {tr('Bugun', 'Сегодня', 'Today')}</span>;
    return <span className="nz-badge muted">📅 {shortDate(d.due_date)}</span>;
  };

  const confirmBadge = (d) => ({
    waiting: <span className="nz-badge muted" title={tr('Mijozga botda yuborildi', 'Отправлено покупателю в бот', 'Sent to the buyer in the bot')}>⏳ {tr('Tasdiq kutilmoqda', 'Ждём подтверждения', 'Waiting to confirm')}</span>,
    confirmed: <span className="nz-badge ok">✅ {tr('Mijoz tasdiqladi', 'Покупатель подтвердил', 'Buyer confirmed')}</span>,
    disputed: <span className="nz-badge bad">❌ {tr("Mijoz tan olmadi", 'Покупатель не признал', 'Buyer disputes it')}</span>,
    none: <span className="nz-badge muted">📵 {tr('Botda emas', 'Не в боте', 'Not in the bot')}</span>,
  }[d.confirm]);

  const remind = async (d) => {
    try {
      put(await api.sellerDebtRemind(d.id));
      triggerHaptic('success');
      say(tr('📲 Eslatma yuborildi', '📲 Напоминание отправлено', '📲 Reminder sent'));
    } catch (e) {
      triggerHaptic('error');
      say(`⚠️ ${e.message}`);
    }
  };

  const remindBlocked = (d) => {
    if (d.confirm !== 'confirmed') return tr('Mijoz botda tasdiqlagach eslatish mumkin', 'Напомнить можно после подтверждения в боте', 'You can remind once the buyer confirms in the bot');
    if (d.paid_claim) return tr("Mijoz «to'ladim» dedi: avval javob bering", 'Покупатель сообщил об оплате: сначала ответьте', 'The buyer says it is paid: answer first');
    if (d.reminders_off) return tr("Mijoz eslatmalarni o'chirgan", 'Покупатель отключил напоминания', 'The buyer turned reminders off');
    if (d.reminded_on && today && addDays(d.reminded_on, 2) > today) return tr('Eslatma yuborilgan, 2 kunda bir marta', 'Напоминание было, не чаще раза в 2 дня', 'Reminded already, at most every 2 days');
    return '';
  };

  const entryCard = (
    <button type="button" className="nz-entry" data-testid="nasiya-entry" onClick={() => setOpen(true)}>
      <span style={{ minWidth: 0 }}>
        <span className="nz-entry-title">📒 {tr('Nasiya daftari', 'Тетрадь насии', 'Credit notebook')}</span>
        <span className="nz-entry-sub" style={{ display: 'block' }}>
          {summary && summary.open_count > 0
            ? tr(`${summary.open_count} ta ochiq yozuv`, `Открытых записей: ${summary.open_count}`, `${summary.open_count} open entries`)
            : tr("Qarzga mol berdingizmi? Shu yerga yozib qo'ying", 'Дали товар в долг? Запишите здесь', 'Gave goods on credit? Write it down here')}
        </span>
        {summary && (summary.due_today > 0 || summary.overdue > 0 || summary.paid_claims > 0) && (
          <span className="nz-entry-chips">
            {summary.paid_claims > 0 && <span className="nz-entry-chip claim" data-testid="nasiya-claims">💵 {tr("To'ladim", 'Оплатили', 'Paid')} · {summary.paid_claims}</span>}
            {summary.overdue > 0 && <span className="nz-entry-chip late">🔴 {tr('Kechikkan', 'Просрочено', 'Late')} · {summary.overdue}</span>}
            {summary.due_today > 0 && <span className="nz-entry-chip">⏰ {tr('Bugun', 'Сегодня', 'Today')} · {summary.due_today}</span>}
          </span>
        )}
      </span>
      {summary && summary.open_total > 0
        ? <span className="nz-entry-sum">{fmt(summary.open_total)}<span style={{ display: 'block', fontSize: 12, fontWeight: 600, opacity: 0.8, color: '#fff' }}>{cur}</span></span>
        : <span className="nz-entry-add" aria-hidden>＋ {tr('Yozish', 'Записать', 'Write')}</span>}
    </button>
  );

  const screen = open && createPortal(
    <div className="nz nz-screen" ref={screenRef} data-testid="nasiya" role="dialog" aria-modal="true" aria-label={tr('Nasiya daftari', 'Тетрадь насии', 'Credit notebook')}>
      <div className="nz-head">
        <div className="nz-head-row">
          <button type="button" className="nz-icon-btn" onClick={closeScreen} aria-label={tr('Yopish', 'Закрыть', 'Close')} data-testid="nasiya-close">←</button>
          <h2>📒 {tr('Nasiya daftari', 'Тетрадь насии', 'Credit notebook')}</h2>
        </div>
        <div className="nz-totals">
          <div className="nz-total">
            <div className="nz-total-label">{tr('Jami qarz', 'Всего в долг', 'Owed in total')}</div>
            <div className="nz-total-value" data-testid="nasiya-total">{summary ? `${fmt(summary.open_total)} ${cur}` : '…'}</div>
          </div>
          <div className={`nz-total ${summary?.overdue ? 'late' : ''}`}>
            <div className="nz-total-label">🔴 {tr('Kechikkan', 'Просрочено', 'Late')}{summary?.overdue ? ` · ${summary.overdue}` : ''}</div>
            <div className="nz-total-value">{summary ? `${fmt(summary.overdue_total)} ${cur}` : '…'}</div>
          </div>
        </div>
      </div>

      <div className="nz-seg" role="group">
        <button type="button" aria-pressed={view === 'open'} onClick={() => setView('open')} data-testid="nasiya-tab-open">{tr('Ochiq', 'Открытые', 'Open')}</button>
        <button type="button" aria-pressed={view === 'closed'} onClick={() => setView('closed')} data-testid="nasiya-tab-closed">{tr('Yopilgan', 'Закрытые', 'Closed')}</button>
      </div>

      <div className="nz-body">
        <div className="nz-body-inner">
          {loadError && !data && (
            <div className="nz-empty" data-testid="nasiya-error">
              <div className="nz-empty-icon">⚠️</div>
              <h3>{tr("Daftar ochilmadi", 'Тетрадь не открылась', 'Could not open the notebook')}</h3>
              <p>{loadError}</p>
              <button type="button" className="nz-ghost" style={{ marginTop: 14 }} onClick={load}>↻ {tr('Qayta urinish', 'Повторить', 'Try again')}</button>
            </div>
          )}
          {!data && !loadError && [0, 1, 2].map((i) => <div key={i} className="nz-skel" />)}
          {data && groups.length === 0 && (
            <div className="nz-empty" data-testid="nasiya-empty">
              <div className="nz-empty-icon">{view === 'open' ? '📒' : '🗂'}</div>
              <h3>{view === 'open' ? tr("Ochiq nasiya yo'q", 'Открытых долгов нет', 'Nobody owes you') : tr("Yopilganlar yo'q", 'Закрытых пока нет', 'Nothing closed yet')}</h3>
              <p>{view === 'open'
                ? tr("Tanish mijozga qarzga mol bersangiz, shu yerga yozing. Mijoz botda tasdiqlaydi, muddatida eslatamiz.",
                  'Дали товар в долг знакомому покупателю — запишите здесь. Покупатель подтвердит в боте, а мы напомним в срок.',
                  'Gave goods on credit to a buyer you know? Write it here. They confirm in the bot and we remind them on time.')
                : tr("To'langan va bekor qilingan yozuvlar 60 kun shu yerda turadi.", 'Оплаченные и отменённые записи хранятся здесь 60 дней.', 'Paid and cancelled entries stay here for 60 days.')}</p>
            </div>
          )}

          {groups.map((g) => {
            const isOpen = expanded[g.key] ?? (groups.length <= 3);
            const tone = view === 'open' ? (g.worst > 0 ? 'late' : (g.worst === 0 ? 'today' : '')) : '';
            return (
              <div key={g.key} className={`nz-cust ${tone}`} data-testid="nasiya-customer">
                <button type="button" className="nz-cust-head" aria-expanded={isOpen} onClick={() => setExpanded((p) => ({ ...p, [g.key]: !isOpen }))}>
                  <span className="nz-cust-left">
                    <span className="nz-cust-name" style={{ display: 'block' }}>{g.name}</span>
                    <span className="nz-cust-meta" style={{ display: 'block' }}>
                      {g.phone || tr('Telefonsiz', 'Без телефона', 'No phone')} · {g.debts.length} {tr('ta yozuv', 'зап.', 'entries')}
                      {view === 'open' && g.worst < 0 && ` · 📅 ${shortDate(g.nextDue)}`}
                    </span>
                  </span>
                  <span>
                    <span className="nz-cust-sum" style={{ display: 'block' }}>{fmt(view === 'open' ? g.left : g.total)}</span>
                    {view === 'open' && g.claim && <span className="nz-badge claim" style={{ marginTop: 4 }}>💵 {tr("To'ladim", 'Оплатил', 'Paid')}</span>}
                    {view === 'open' && !g.claim && g.worst > 0 && <span className="nz-badge late" style={{ marginTop: 4 }}>🔴 {g.worst} {tr('kun', 'дн.', 'd')}</span>}
                    {view === 'open' && !g.claim && g.worst === 0 && <span className="nz-badge today" style={{ marginTop: 4 }}>⏰ {tr('Bugun', 'Сегодня', 'Today')}</span>}
                  </span>
                </button>
                {isOpen && g.debts.map((d) => {
                  const blocked = remindBlocked(d);
                  return (
                    <div key={d.id} className="nz-debt" data-testid="nasiya-debt">
                      <div className="nz-debt-row">
                        <span className="nz-debt-note">{d.note || tr('Izohsiz', 'Без пометки', 'No note')}</span>
                        <span className="nz-debt-amt">
                          {d.paid > 0 && d.status === 'open' && <s>{fmt(d.amount)}</s>}
                          {fmt(d.status === 'open' ? d.left : d.amount)} {cur}
                        </span>
                      </div>
                      <div className="nz-debt-info">
                        {dueBadge(d)}
                        {confirmBadge(d)}
                        {d.paid > 0 && d.status === 'open' && <span>💵 {tr("To'langan", 'Оплачено', 'Paid')} {fmt(d.paid)}</span>}
                        {d.status === 'cancelled' && d.cancel_reason && <span>· {d.cancel_reason}</span>}
                      </div>
                      {d.status === 'open' && d.paid_claim && (
                        <ClaimBox tr={tr} cur={cur} debt={d} onDone={(r) => {
                          load();
                          say(r.status === 'paid' ? tr('✅ Nasiya yopildi', '✅ Насия закрыта', '✅ Closed') : tr('❌ Mijozga aytildi', '❌ Покупателю сообщили', '❌ The buyer was told'));
                        }} onError={(m) => say(`⚠️ ${m}`)} />
                      )}
                      {d.status === 'open' && (
                        <>
                          <div className="nz-actions">
                            <button type="button" className="nz-act primary" data-testid="nasiya-pay" onClick={() => setSheet({ kind: 'pay', debt: d })}>💵 {tr("To'lov", 'Оплата', 'Payment')}</button>
                            <button type="button" className="nz-act" data-testid="nasiya-snooze" onClick={() => setSheet({ kind: 'snooze', debt: d })}>⏰ {tr('Surish', 'Срок', 'Later')}</button>
                            <button type="button" className="nz-act" data-testid="nasiya-remind" disabled={Boolean(blocked)} onClick={() => remind(d)}>📲 {tr('Eslatish', 'Напомнить', 'Remind')}</button>
                            <button type="button" className="nz-act" data-testid="nasiya-more" onClick={() => setSheet({ kind: 'more', debt: d })} aria-label={tr('Tarix', 'История', 'History')}>⋯</button>
                          </div>
                          {blocked && <div className="nz-hint">📲 {blocked}</div>}
                        </>
                      )}
                      {d.status !== 'open' && (
                        <button type="button" className="nz-act" style={{ marginTop: 8, width: '100%' }} onClick={() => setSheet({ kind: 'more', debt: d })}>🗂 {tr('Tarix', 'История', 'History')}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="nz-bar">
        <button type="button" className="nz-main" data-testid="nasiya-new" onClick={() => setSheet({ kind: 'new' })}>＋ {tr('Yangi nasiya', 'Новая насия', 'New entry')}</button>
      </div>

      {sheet?.kind === 'new' && (
        <NewDebt tr={tr} cur={cur} today={today} prefill={sheet.prefill} onClose={() => setSheet(null)}
          onSaved={(d) => {
            setSheet(null);
            setView('open');
            setExpanded((p) => ({ ...p, [keyOf(d)]: true }));
            load();
            say(d.confirm === 'waiting'
              ? tr('📒 Yozildi. Mijozga botda tasdiq yuborildi', '📒 Записано. Покупателю отправлено подтверждение', '📒 Saved. The buyer was asked to confirm')
              : tr('📒 Yozildi', '📒 Записано', '📒 Saved'));
          }} />
      )}
      {sheet?.kind === 'pay' && (
        <PayDebt tr={tr} cur={cur} debt={sheet.debt} onClose={() => setSheet(null)}
          onSaved={(d) => { setSheet(null); load(); say(d.status === 'paid' ? tr('✅ Nasiya yopildi', '✅ Насия закрыта', '✅ Closed') : tr("💵 To'lov yozildi", '💵 Оплата записана', '💵 Payment recorded')); }} />
      )}
      {sheet?.kind === 'snooze' && (
        <SnoozeDebt tr={tr} today={today} debt={sheet.debt} onClose={() => setSheet(null)}
          onSaved={(d) => { setSheet(null); put(d); load(); say(`⏰ ${tr('Yangi muddat', 'Новый срок', 'New date')}: ${shortDate(d.due_date)}`); }} />
      )}
      {sheet?.kind === 'more' && (
        <MoreDebt tr={tr} cur={cur} debt={sheet.debt} isOwner={isOwner} onClose={() => setSheet(null)}
          onCancelled={() => { setSheet(null); load(); say(tr('↩️ Bekor qilindi, tarixda qoladi', '↩️ Отменено, останется в истории', '↩️ Cancelled, kept in history')); }} />
      )}
      {toast && <div className="nz-toast" role="status" data-testid="nasiya-toast">{toast}</div>}
    </div>,
    document.body,
  );

  return (
    <div className="nz">
      {entryCard}
      {screen}
    </div>
  );
}

// The buyer pressed «💵 To'ladim» in the bot: the stall says whether the money really came
function ClaimBox({ tr, cur, debt, onDone, onError }) {
  const [busy, setBusy] = useState(null);
  const go = async (accept) => {
    setBusy(accept ? 'yes' : 'no');
    try {
      const r = await api.sellerDebtClaim(debt.id, accept);
      triggerHaptic(accept ? 'success' : 'warning');
      onDone(r);
    } catch (e) {
      triggerHaptic('error');
      onError(e.message);
      setBusy(null);
    }
  };
  return (
    <div className="nz-claim" data-testid="nasiya-claim" role="group">
      <div className="nz-claim-title">💵 {tr("Mijoz «to'ladim» dedi", 'Покупатель говорит: «оплатил»', 'The buyer says: «paid»')} · {fmt(debt.left)} {cur}</div>
      <div className="nz-claim-sub">{tr('Pulni oldingizmi?', 'Деньги получили?', 'Did you get the money?')}</div>
      <div className="nz-claim-actions">
        <button type="button" className="nz-act primary" data-testid="nasiya-claim-yes" disabled={Boolean(busy)} aria-busy={busy === 'yes'} onClick={() => go(true)}>
          {busy === 'yes' ? <span className="nz-spin" aria-hidden /> : `✅ ${tr('Oldim, yopish', 'Получил, закрыть', 'Got it, close')}`}
        </button>
        <button type="button" className="nz-act" data-testid="nasiya-claim-no" disabled={Boolean(busy)} aria-busy={busy === 'no'} onClick={() => go(false)}>
          {busy === 'no' ? '…' : `❌ ${tr('Olmadim', 'Не получал', 'Not received')}`}
        </button>
      </div>
    </div>
  );
}

function NewDebt({ tr, cur, today, prefill, onClose, onSaved }) {
  const [name, setName] = useState(prefill?.customer_name || '');
  const [phone, setPhone] = useState(prefill?.customer_phone || '');
  // 👥 the stall's own customers: typing a name from the list fills in the phone
  const [clients, setClients] = useState([]);
  useEffect(() => { api.sellerClients().then((r) => setClients(r.clients)).catch(() => {}); }, []);
  const pickName = (value) => {
    setName(value);
    const c = clients.find((x) => x.name.toLowerCase() === value.trim().toLowerCase());
    if (c?.phone && !phone.trim()) setPhone(c.phone);
  };
  const [amount, setAmount] = useState(prefill?.amount ? fmt(prefill.amount) : '');
  const [note, setNote] = useState(prefill?.note || '');
  const base = today || new Date().toISOString().slice(0, 10);
  const dow = new Date(`${base}T00:00:00Z`).getUTCDay();
  const pills = [
    ['tomorrow', tr('Ertaga', 'Завтра', 'Tomorrow'), addDays(base, 1)],
    ['friday', tr('Juma', 'Пятница', 'Friday'), addDays(base, ((5 - dow + 7) % 7) || 7)],
    ['week', tr('1 hafta', '1 неделя', '1 week'), addDays(base, 7)],
    ['month', tr('1 oy', '1 месяц', '1 month'), addDays(base, 30)],
  ];
  const [due, setDue] = useState(pills[2][2]);
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const sum = Number(digits(amount));
  const phoneDigits = digits(phone);
  const phoneBad = phoneDigits.length > 0 && phoneDigits.slice(-9).length < 9;
  const nameBad = !name.trim();
  const sumBad = !sum || sum < 1000;

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (nameBad || sumBad || phoneBad || busy) return;
    setBusy(true);
    setError('');
    try {
      const d = await api.sellerAddDebt({
        customer_name: name.trim(), customer_phone: phone.trim() || null, amount: sum, note: note.trim() || null,
        due_date: due, order_id: prefill?.order_id ?? null,
      });
      triggerHaptic('success');
      onSaved(d);
    } catch (err) {
      triggerHaptic('error');
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Sheet title={`📒 ${tr('Yangi nasiya', 'Новая насия', 'New entry')}`} testid="nasiya-form" onClose={onClose}
      sub={prefill?.order_number ? `${tr('Buyurtma', 'Заказ', 'Order')} #${prefill.order_number}` : tr('Faqat tanish mijozlar uchun', 'Только для знакомых покупателей', 'Only for buyers you know')}>
      <form onSubmit={submit} noValidate>
        {error && <div className="nz-error" role="alert">⚠️ {error}</div>}
        <label className="nz-field">
          <span className="nz-label">{tr('Mijoz ismi', 'Имя покупателя', "Buyer's name")}</span>
          <input className="nz-input" data-testid="nasiya-name" value={name} maxLength={100} autoComplete="off" list="nz-clients"
            aria-invalid={touched && nameBad} onChange={(e) => pickName(e.target.value)} placeholder={tr('Masalan: Karim aka', 'Например: Карим ака', 'e.g. Karim aka')} />
          <datalist id="nz-clients">{clients.map((c) => <option key={c.id} value={c.name}>{c.phone || ''}</option>)}</datalist>
          {touched && nameBad && <div className="nz-err-text">{tr('Ismni yozing', 'Напишите имя', 'Write a name')}</div>}
        </label>
        <label className="nz-field">
          <span className="nz-label">{tr('Telefon (ixtiyoriy)', 'Телефон (необязательно)', 'Phone (optional)')}</span>
          <input className="nz-input" data-testid="nasiya-phone" value={phone} inputMode="tel" maxLength={20} autoComplete="off"
            aria-invalid={touched && phoneBad} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" />
          {touched && phoneBad
            ? <div className="nz-err-text">{tr("Raqamni to'liq yozing yoki bo'sh qoldiring", 'Введите номер полностью или оставьте пустым', 'Write the whole number or leave it empty')}</div>
            : <div className="nz-hint">{tr("Mijoz botda bo'lsa, undan tasdiq so'raymiz", 'Если покупатель в боте, попросим его подтвердить', 'If the buyer is in the bot, we ask them to confirm')}</div>}
        </label>
        <label className="nz-field">
          <span className="nz-label">{tr('Summa', 'Сумма', 'Amount')}, {cur}</span>
          <input className="nz-input money" data-testid="nasiya-amount" value={amount} inputMode="numeric" autoComplete="off"
            aria-invalid={touched && sumBad} onChange={(e) => setAmount(digits(e.target.value) ? fmt(Number(digits(e.target.value).slice(0, 9))) : '')} placeholder="0" />
          {touched && sumBad && <div className="nz-err-text">{tr("Kamida 1 000 so'm", 'Не меньше 1 000 сум', 'At least 1,000 sum')}</div>}
        </label>
        <label className="nz-field">
          <span className="nz-label">{tr('Nima berildi', 'Что взяли', 'What was taken')}</span>
          <input className="nz-input" data-testid="nasiya-note" value={note} maxLength={200} autoComplete="off"
            onChange={(e) => setNote(e.target.value)} placeholder={tr("2 kg mol go'shti", '2 кг говядины', '2 kg beef')} />
        </label>
        <div className="nz-field">
          <span className="nz-label">{tr('Qaytarish muddati', 'Вернуть до', 'Pay back by')}</span>
          <div className="nz-pills">
            {pills.map(([id, label, iso]) => (
              <button key={id} type="button" className="nz-pill" aria-pressed={!custom && due === iso} data-testid={`nasiya-due-${id}`}
                onClick={() => { setCustom(false); setDue(iso); }}>
                {label}<span className="nz-pill-date">{shortDate(iso)}</span>
              </button>
            ))}
            <button type="button" className="nz-pill" aria-pressed={custom} onClick={() => setCustom(true)}>📅 {tr('Sana', 'Дата', 'Date')}</button>
          </div>
          {custom && (
            <input type="date" className="nz-input" style={{ marginTop: 8 }} min={base} max={addDays(base, 366)} value={due} onChange={(e) => e.target.value && setDue(e.target.value)} />
          )}
        </div>
        <div className="nz-note">ℹ️ {tr(
          "Bu sizning shaxsiy daftaringiz: faqat rastangiz ko'radi, bozorkom ko'rmaydi. Bot faqat eslatadi, pulga javob bermaydi.",
          'Это ваша личная тетрадь: видит только ваша раста, бозорком не видит. Бот только напоминает и за деньги не отвечает.',
          'This is your own notebook: only your stall sees it, not the bozorkom. The bot only reminds; it is not responsible for the money.')}</div>
        <div className="nz-sheet-actions">
          <button type="button" className="nz-ghost" onClick={onClose}>{tr('Bekor', 'Отмена', 'Cancel')}</button>
          <MainButton busy={busy} data-testid="nasiya-save">{tr('Daftarga yozish', 'Записать', 'Save')}</MainButton>
        </div>
      </form>
    </Sheet>
  );
}

function PayDebt({ tr, cur, debt, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sum = Number(digits(amount));
  const submit = async (e) => {
    e.preventDefault();
    if (!sum || busy) return;
    setBusy(true);
    setError('');
    try {
      const d = await api.sellerDebtPay(debt.id, Math.min(sum, debt.left));
      triggerHaptic('success');
      onSaved(d);
    } catch (err) {
      triggerHaptic('error');
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Sheet title={`💵 ${tr("To'lov", 'Оплата', 'Payment')} · ${debt.customer_name}`} testid="nasiya-pay-sheet" onClose={onClose}
      sub={`${tr('Qoldi', 'Осталось', 'Left')}: ${fmt(debt.left)} ${cur}`}>
      <form onSubmit={submit} noValidate>
        {error && <div className="nz-error" role="alert">⚠️ {error}</div>}
        <div className="nz-pills" style={{ marginBottom: 10 }}>
          <button type="button" className="nz-pill" aria-pressed={sum === debt.left} data-testid="nasiya-pay-all" onClick={() => setAmount(fmt(debt.left))}>
            ✅ {tr("Hammasi", 'Всё', 'All')} · {fmt(debt.left)}
          </button>
          {debt.left >= 20000 && (
            <button type="button" className="nz-pill" aria-pressed={sum === Math.round(debt.left / 2)} onClick={() => setAmount(fmt(Math.round(debt.left / 2)))}>
              ½ · {fmt(Math.round(debt.left / 2))}
            </button>
          )}
        </div>
        <label className="nz-field">
          <span className="nz-label">{tr('Qancha berdi', 'Сколько отдал', 'Amount paid')}, {cur}</span>
          <input className="nz-input money" data-testid="nasiya-pay-amount" value={amount} inputMode="numeric" autoComplete="off"
            onChange={(e) => setAmount(digits(e.target.value) ? fmt(Number(digits(e.target.value).slice(0, 9))) : '')} placeholder="0" />
          {sum > debt.left && <div className="nz-hint">{tr(`Qarzdan ko'p: ${fmt(debt.left)} yoziladi va nasiya yopiladi`, `Больше долга: запишем ${fmt(debt.left)} и закроем`, `More than owed: ${fmt(debt.left)} is recorded and it closes`)}</div>}
          {sum > 0 && sum < debt.left && <div className="nz-hint">{tr('Qoladi', 'Останется', 'Will be left')}: {fmt(debt.left - sum)} {cur}</div>}
        </label>
        <div className="nz-sheet-actions">
          <button type="button" className="nz-ghost" onClick={onClose}>{tr('Bekor', 'Отмена', 'Cancel')}</button>
          <MainButton busy={busy} disabled={!sum || busy} data-testid="nasiya-pay-save">
            {sum >= debt.left ? tr('Nasiyani yopish', 'Закрыть насию', 'Close it') : tr("To'lovni yozish", 'Записать оплату', 'Record payment')}
          </MainButton>
        </div>
      </form>
    </Sheet>
  );
}

function SnoozeDebt({ tr, today, debt, onClose, onSaved }) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState('');
  const from = today && debt.due_date < today ? today : debt.due_date;
  const go = async (days) => {
    setBusy(days);
    setError('');
    try {
      const d = await api.sellerDebtSnooze(debt.id, days);
      triggerHaptic('success');
      onSaved(d);
    } catch (err) {
      setError(err.message);
      setBusy(0);
    }
  };
  return (
    <Sheet title={`⏰ ${tr('Muddatni surish', 'Перенести срок', 'Move the date')}`} testid="nasiya-snooze-sheet" onClose={onClose}
      sub={`${debt.customer_name} · ${tr('hozir', 'сейчас', 'now')} ${shortDate(debt.due_date)}`}>
      {error && <div className="nz-error" role="alert">⚠️ {error}</div>}
      <div className="nz-pills">
        {[[3, tr('+3 kun', '+3 дня', '+3 days')], [7, tr('+1 hafta', '+1 неделя', '+1 week')], [30, tr('+1 oy', '+1 месяц', '+1 month')]].map(([days, label]) => (
          <button key={days} type="button" className="nz-pill" disabled={Boolean(busy)} data-testid={`nasiya-snooze-${days}`} onClick={() => go(days)}>
            {busy === days ? '…' : label}<span className="nz-pill-date">{shortDate(addDays(from, days))}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

const EVENT_LABELS = {
  created: ['📒', 'Yozildi', 'Записано', 'Written'],
  sent: ['📨', "Mijozga yuborildi", 'Отправлено покупателю', 'Sent to the buyer'],
  confirmed: ['✅', 'Mijoz tasdiqladi', 'Покупатель подтвердил', 'Buyer confirmed'],
  disputed: ['❌', "Mijoz tan olmadi", 'Покупатель не признал', 'Buyer disputed'],
  payment: ['💵', "To'lov", 'Оплата', 'Payment'],
  snoozed: ['⏰', 'Muddat surildi', 'Срок перенесён', 'Date moved'],
  reminded: ['📲', 'Eslatildi', 'Напомнили', 'Reminded'],
  reminders_off: ['🔕', "Mijoz eslatmalarni o'chirdi", 'Покупатель отключил напоминания', 'Buyer stopped reminders'],
  cancelled: ['↩️', 'Bekor qilindi', 'Отменено', 'Cancelled'],
  claimed: ['💵', "Mijoz: «to'ladim»", 'Покупатель: «оплатил»', 'Buyer: «paid»'],
  claim_rejected: ['❌', "Sotuvchi: «olmadim»", 'Продавец: «не получал»', 'Stall: «not received»'],
};

function MoreDebt({ tr, cur, debt, isOwner, onClose, onCancelled }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.sellerDebt(debt.id).then(setDetail).catch((e) => setError(e.message));
  }, [debt.id]);

  const cancel = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      await api.sellerDebtCancel(debt.id, reason.trim());
      triggerHaptic('success');
      onCancelled();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Sheet title={`🗂 ${debt.customer_name}`} testid="nasiya-more-sheet" onClose={onClose}
      sub={`${debt.note || ''}${debt.note ? ' · ' : ''}${fmt(debt.amount)} ${cur}${debt.customer_phone ? ` · ${debt.customer_phone}` : ''}`}>
      {error && <div className="nz-error" role="alert">⚠️ {error}</div>}
      {debt.customer_phone && (
        <a className="nz-act" href={`tel:${debt.customer_phone.replace(/[^\d+]/g, '')}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', marginBottom: 12 }}>
          📞 {tr("Qo'ng'iroq qilish", 'Позвонить', 'Call')}
        </a>
      )}
      {!detail && !error && [0, 1].map((i) => <div key={i} className="nz-skel" style={{ height: 36 }} />)}
      {detail && (
        <ul className="nz-history" data-testid="nasiya-history">
          {detail.events.map((ev, i) => {
            const [icon, uz, ru, en] = EVENT_LABELS[ev.kind] || ['•', ev.kind, ev.kind, ev.kind];
            return (
              <li key={i}>
                <time>{ev.at.slice(8, 10)}.{ev.at.slice(5, 7)} {ev.at.slice(11, 16)}</time>
                <span>{icon} {tr(uz, ru, en)}{ev.amount ? ` · ${fmt(ev.amount)} ${cur}` : ''}{ev.kind === 'snoozed' && ev.note ? ` → ${shortDate(ev.note)}` : ''}{ev.kind !== 'snoozed' && ev.note ? ` · ${ev.note}` : ''}</span>
              </li>
            );
          })}
        </ul>
      )}
      {debt.status === 'open' && isOwner && !asking && (
        <button type="button" className="nz-ghost nz-danger" style={{ width: '100%', marginTop: 14 }} data-testid="nasiya-cancel" onClick={() => setAsking(true)}>
          ↩️ {tr('Xato yozilgan — bekor qilish', 'Записано по ошибке — отменить', 'Written by mistake — cancel')}
        </button>
      )}
      {debt.status === 'open' && !isOwner && (
        <div className="nz-hint" style={{ marginTop: 12 }}>{tr('Bekor qilishni faqat rasta egasi qila oladi', 'Отменить может только владелец расты', 'Only the stall owner can cancel')}</div>
      )}
      {asking && (
        <form onSubmit={cancel} style={{ marginTop: 14 }} noValidate>
          <label className="nz-field">
            <span className="nz-label">{tr('Sababi', 'Причина', 'Reason')}</span>
            <input className="nz-input" data-testid="nasiya-cancel-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)}
              placeholder={tr('Masalan: summani xato yozdim', 'Например: ошибся в сумме', 'e.g. wrong amount')} />
          </label>
          <div className="nz-note">{tr("O'chirilmaydi: yozuv tarixda «bekor qilingan» bo'lib qoladi. Mijoz botda bo'lsa, unga xabar boradi.",
            'Не удаляется: запись останется в истории как отменённая. Если покупатель в боте, он получит сообщение.',
            'Nothing is deleted: the entry stays in the history as cancelled. A buyer in the bot is told.')}</div>
          <div className="nz-sheet-actions">
            <button type="button" className="nz-ghost" onClick={() => setAsking(false)}>{tr('Orqaga', 'Назад', 'Back')}</button>
            <MainButton busy={busy} disabled={reason.trim().length < 2 || busy} data-testid="nasiya-cancel-save">{tr('Bekor qilish', 'Отменить запись', 'Cancel entry')}</MainButton>
          </div>
        </form>
      )}
    </Sheet>
  );
}
