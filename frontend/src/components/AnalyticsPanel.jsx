import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';

// «📊 Tahlil»: what the pilot shows. Numbers come from /api/admin/analytics (counted from the orders and their event log).
const T = {
  today: { uz: 'Bugun', ru: 'Сегодня', en: 'Today' },
  d7: { uz: '7 kun', ru: '7 дней', en: '7 days' },
  d30: { uz: '30 kun', ru: '30 дней', en: '30 days' },
  orders: { uz: 'Buyurtmalar', ru: 'Заказы', en: 'Orders' },
  delivered: { uz: 'Yetkazildi', ru: 'Доставлено', en: 'Delivered' },
  revenue: { uz: 'Savdo', ru: 'Выручка', en: 'Sales' },
  avg_check: { uz: "O'rtacha chek", ru: 'Средний чек', en: 'Average check' },
  cancelled: { uz: 'Bekor qilindi', ru: 'Отменено', en: 'Cancelled' },
  no_show: { uz: 'Kelmadi', ru: 'Не пришли', en: 'No-shows' },
  open: { uz: 'Hali ochiq', ru: 'Ещё открыты', en: 'Still open' },
  how: { uz: 'Qanday olishadi', ru: 'Как получают', en: 'How they get it' },
  self: { uz: "O'zi oladi", ru: 'Самовывоз', en: 'Self pickup' },
  point: { uz: 'Tochka', ru: 'Точка', en: 'Point' },
  courier: { uz: 'Uyga', ru: 'Домой', en: 'Home' },
  when: { uz: 'Qachon buyurtma qilishadi', ru: 'Когда заказывают', en: 'When people order' },
  stages: { uz: 'Har bosqich necha daqiqa', ru: 'Сколько минут каждый этап', en: 'Minutes per stage' },
  stage_hint: { uz: "o'rtacha · 10 tadan 9 tasi shundan tez", ru: 'среднее · 9 из 10 быстрее этого', en: 'average · 9 in 10 are faster' },
  to_porter: { uz: 'Aravachi olguncha', ru: 'Пока аравачи возьмёт', en: 'Until a porter takes it' },
  collecting: { uz: "Yig'ish", ru: 'Сборка', en: 'Collecting' },
  to_customer: { uz: "Xaridorga yetguncha", ru: 'До покупателя', en: 'To the customer' },
  total: { uz: 'Jami', ru: 'Всего', en: 'Total' },
  missing: { uz: 'Ko\'p «Tugadi»', ru: 'Чаще всего «Закончилось»', en: 'Most often sold out' },
  weight_refused: { uz: 'Vaznga rozi bo\'lmadi', ru: 'Отказ по весу', en: 'Weight refused' },
  stalls: { uz: 'Rastalar (savdo)', ru: 'Расты (выручка)', en: 'Stalls (sales)' },
  porters: { uz: 'Aravachilar', ru: 'Аравачи', en: 'Porters' },
  taxis: { uz: 'Taksichilar', ru: 'Таксисты', en: 'Taxi drivers' },
  none: { uz: "Hali ma'lumot yo'q", ru: 'Пока нет данных', en: 'No data yet' },
  csv: { uz: '📄 Excel faylni botga yuborish', ru: '📄 Прислать Excel-файл в бот', en: '📄 Send the Excel file to the bot' },
  csv_sent: { uz: 'Fayl botga yuborildi', ru: 'Файл отправлен в бот', en: 'The file is in the bot' },
  backup: { uz: 'Zaxira nusxa', ru: 'Резервная копия', en: 'Backup' },
  backup_now: { uz: '💾 Hozir nusxa olish', ru: '💾 Сделать копию сейчас', en: '💾 Back up now' },
  backup_off: { uz: "O'chiq: Render'da BACKUP_KEY yo'q", ru: 'Выключена: в Render нет BACKUP_KEY', en: 'Off: no BACKUP_KEY in Render' },
  days_short: { uz: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'], ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] },
  min: { uz: 'daq', ru: 'мин', en: 'min' },
};

const card = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 12, marginBottom: 8 };
const money = (v) => Math.round(v || 0).toLocaleString('ru-RU');
// The bazaar is open 06:00–20:00; the map shows those hours (and a little around them)
const HOURS = Array.from({ length: 17 }, (_, i) => i + 5);

export default function AnalyticsPanel({ lang }) {
  const t = (key) => T[key]?.[lang] ?? T[key]?.uz ?? key;
  const [days, setDays] = useState(7);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.adminAnalytics(days).then((r) => { setReport(r); setError(''); }).catch((e) => setError(e.message));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, done) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); triggerHaptic('success'); setNotice(done); load(); }
    catch (e) { triggerHaptic('error'); setError(e.message); }
    finally { setBusy(false); }
  };

  const stat = (label, value, sub, color = '#0f172a') => (
    <div style={{ ...card, marginBottom: 0 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b' }}>{sub}</div>}
    </div>
  );
  const list = (title, rows, render) => (
    <div style={card}>
      <b style={{ fontSize: 14 }}>{title}</b>
      {rows.length === 0 ? <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>{t('none')}</div>
        : rows.map((r, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '5px 0', borderTop: i ? '1px solid #f1f5f9' : 'none' }}>{render(r)}</div>)}
    </div>
  );

  const r = report;
  const maxCell = r ? Math.max(1, ...r.heatmap.flat()) : 1;

  return (
    <div data-testid="analytics">
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[[1, t('today')], [7, t('d7')], [30, t('d30')]].map(([d, label]) => (
          <button key={d} type="button" onClick={() => setDays(d)} style={{ flex: 1, padding: '9px 6px', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer', border: days === d ? '2px solid #0f172a' : '1.5px solid #e2e8f0', background: days === d ? '#0f172a' : '#ffffff', color: days === d ? '#ffffff' : '#334155' }}>{label}</button>
        ))}
      </div>
      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: '10px 12px', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>}
      {notice && <div style={{ background: '#ecfdf5', color: '#047857', borderRadius: 12, padding: '10px 12px', marginBottom: 8, fontSize: 13, fontWeight: 700 }}>✅ {notice}</div>}
      {r && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            {stat(t('orders'), r.orders, `${t('delivered')}: ${r.delivered}${r.open ? ` · ${t('open')}: ${r.open}` : ''}`)}
            {stat(t('revenue'), `${money(r.revenue)}`, `UZS · ${t('avg_check')} ${money(r.avg_check)}`, '#047857')}
            {stat(t('cancelled'), `${r.cancelled_pct}%`, `${r.cancelled}`, r.cancelled_pct > 15 ? '#dc2626' : '#0f172a')}
            {stat(t('no_show'), `${r.no_show_pct}%`, `${r.no_show}`, r.no_show_pct > 10 ? '#dc2626' : '#0f172a')}
          </div>

          <div style={card}>
            <b style={{ fontSize: 14 }}>{t('how')}</b>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 13 }}>
              {['self', 'point', 'courier'].map((f) => <span key={f}>{t(f)}: <b>{r.by_fulfillment[f]}</b></span>)}
            </div>
          </div>

          <div style={card}>
            <b style={{ fontSize: 14 }}>{t('stages')}</b>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{t('stage_hint')}</div>
            {['to_porter', 'collecting', 'to_customer', 'total'].map((key) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', fontWeight: key === 'total' ? 800 : 500 }}>
                <span>{t(key)}</span>
                <span>{r.stages[key].avg == null ? '—' : `${Math.round(r.stages[key].avg)} · ${Math.round(r.stages[key].p90)} ${t('min')}`}</span>
              </div>
            ))}
          </div>

          <div style={card}>
            <b style={{ fontSize: 14 }}>{t('when')}</b>
            <div style={{ overflowX: 'auto', marginTop: 6 }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 9, color: '#64748b' }}>
                <thead><tr><th />{HOURS.map((h) => <th key={h} style={{ fontWeight: 600 }}>{h % 3 === 0 ? h : ''}</th>)}</tr></thead>
                <tbody>
                  {r.heatmap.map((row, d) => (
                    <tr key={d}>
                      <td style={{ paddingRight: 4, fontWeight: 700 }}>{t('days_short')[d]}</td>
                      {HOURS.map((h) => (
                        <td key={h} title={`${row[h]}`} style={{ width: 14, height: 14, borderRadius: 3, background: row[h] ? `rgba(5,150,105,${0.15 + 0.85 * row[h] / maxCell})` : '#f1f5f9' }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {list(t('missing'), r.missing, (m) => <><span>{m.product} <span style={{ color: '#94a3b8' }}>{m.stall}</span></span><b>{m.count}</b></>)}
          {r.weight_refused > 0 && <div style={card}>{t('weight_refused')}: <b>{r.weight_refused}</b></div>}
          {list(t('stalls'), r.stalls, (s) => <><span>{s.stall}</span><b>{money(s.sales)}</b></>)}
          {list(t('porters'), r.porters, (p) => <><span>{p.name}</span><b>{p.delivered}</b></>)}
          {list(t('taxis'), r.taxis, (p) => <><span>{p.name}</span><b>{p.delivered}</b></>)}

          <button type="button" disabled={busy} onClick={() => act(() => api.adminSendCsv(days), t('csv_sent'))} style={{ width: '100%', padding: 13, borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#ffffff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>{t('csv')}</button>

          <div style={card}>
            <b style={{ fontSize: 14 }}>💾 {t('backup')}</b>
            <div data-testid="backup-state" style={{ fontSize: 13, color: r.backup.startsWith('ok') ? '#047857' : '#b45309', margin: '4px 0 8px' }}>
              {r.backup.startsWith('off (missing: BACKUP_KEY)') ? t('backup_off') : r.backup}
            </div>
            {!r.backup.startsWith('off') && (
              <button type="button" disabled={busy} onClick={() => act(() => api.adminBackupNow(), t('backup'))} style={{ padding: '9px 12px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#ffffff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{t('backup_now')}</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
