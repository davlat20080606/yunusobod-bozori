import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Activity, Database, Radio } from 'lucide-react';
import { api } from '../services/api';
import { triggerHaptic } from '../services/telegram';

// The founders' monitoring (Davlatbek and Shuhrat): numbers for any day, week or month against the period before,
// a live feed, what goes wrong, and the system's health. Read only; the bozorkom sees it too.

const T = {
  views: { uz: ["Ko'rsatkichlar", 'Jonli lenta', 'Tizim'], ru: ['Показатели', 'Лента', 'Система'], en: ['Numbers', 'Live feed', 'System'] },
  periods: { uz: ['Kun', 'Hafta', 'Oy'], ru: ['День', 'Неделя', 'Месяц'], en: ['Day', 'Week', 'Month'] },
  today: { uz: 'Bugun', ru: 'Сегодня', en: 'Today' },
  pick: { uz: 'Sanani tanlash', ru: 'Выбрать дату', en: 'Pick a date' },
  prev: { uz: 'Oldingi davr', ru: 'Предыдущий период', en: 'Previous period' },
  next: { uz: 'Keyingi davr', ru: 'Следующий период', en: 'Next period' },
  vs: { uz: 'oldingi davr', ru: 'прошлый период', en: 'previous period' },
  kpi: {
    orders: { uz: 'Buyurtmalar', ru: 'Заказы', en: 'Orders' },
    delivered: { uz: 'Yetkazildi', ru: 'Доставлено', en: 'Delivered' },
    revenue: { uz: 'Savdo, soʻm', ru: 'Продажи, сум', en: 'Sales, UZS' },
    avg_check: { uz: "O'rtacha chek", ru: 'Средний чек', en: 'Average order' },
    cancelled: { uz: 'Bekor qilindi', ru: 'Отменено', en: 'Cancelled' },
    no_show: { uz: 'Kelmadi', ru: 'Не пришли', en: 'No-show' },
  },
  chart_day: { uz: 'Soatlar boʻyicha buyurtmalar', ru: 'Заказы по часам', en: 'Orders by hour' },
  chart_days: { uz: 'Kunlar boʻyicha buyurtmalar', ru: 'Заказы по дням', en: 'Orders by day' },
  chart_hint: { uz: 'Ustunni bosing: aniq raqam', ru: 'Нажмите на столбик: точные цифры', en: 'Tap a bar for exact numbers' },
  regs: { uz: "Yangi ro'yxatdan o'tganlar", ru: 'Новые регистрации', en: 'New sign-ups' },
  reg: {
    stores: { uz: 'Rastalar', ru: 'Расты', en: 'Stalls' }, porters: { uz: 'Aravachilar', ru: 'Аравачи', en: 'Porters' },
    taxis: { uz: 'Taksichilar', ru: 'Таксисты', en: 'Taxi' }, customers: { uz: 'Xaridorlar', ru: 'Покупатели', en: 'Customers' },
  },
  problems: { uz: 'Muammolar', ru: 'Проблемы', en: 'Problems' },
  no_problems: { uz: "Bu davrda muammo yo'q", ru: 'За этот период проблем нет', en: 'No problems in this period' },
  late_stalls: { uz: 'Kechikkan rastalar', ru: 'Расты с опозданиями', en: 'Stalls that were late' },
  incidents: { uz: 'Xodimlar: kechikish va voz kechish', ru: 'Работники: опоздания и отказы', en: 'Workers: late or gave up' },
  low: { uz: 'Past baholar (1–3)', ru: 'Низкие оценки (1–3)', en: 'Low ratings (1–3)' },
  blocked: { uz: 'Bloklangan xaridorlar', ru: 'Заблокировано покупателей', en: 'Customers blocked' },
  times: { uz: 'marta', ru: 'раз', en: 'times' },
  feed_empty: { uz: "Hozircha voqealar yo'q. Birinchi buyurtma shu yerda ko'rinadi.", ru: 'Пока событий нет. Первый заказ появится здесь.', en: 'No events yet. The first order will show up here.' },
  more: { uz: "Yana ko'rsatish", ru: 'Показать ещё', en: 'Show more' },
  live: { uz: 'Jonli: har 15 soniyada yangilanadi', ru: 'Вживую: обновляется каждые 15 секунд', en: 'Live: refreshes every 15 seconds' },
  error: { uz: "Ma'lumot yuklanmadi", ru: 'Не удалось загрузить', en: 'Could not load' },
  retry: { uz: 'Qayta urinish', ru: 'Повторить', en: 'Try again' },
  db: { uz: "Ma'lumotlar bazasi", ru: 'База данных', en: 'Database' },
  db_note: { uz: 'Bepul limit: 500 MB. 80% dan oshsa, oldindan choralar koʻramiz.', ru: 'Бесплатный лимит 500 МБ. Если больше 80%, заранее принимаем меры.', en: 'Free limit 500 MB. Above 80% we act in advance.' },
  services: { uz: 'Xizmatlar', ru: 'Сервисы', en: 'Services' },
  rows: { uz: 'Yozuvlar', ru: 'Записи', en: 'Rows' },
  uptime: { uz: 'Server ishlayapti', ru: 'Сервер работает', en: 'Server up for' },
  min: { uz: 'daq', ru: 'мин', en: 'min' },
  r2: { uz: 'R2 (rasmlar)', ru: 'R2 (фото)', en: 'R2 (photos)' },
  backup: { uz: 'Zaxira nusxa', ru: 'Резервная копия', en: 'Backup' },
  row: {
    orders: { uz: 'buyurtma', ru: 'заказов', en: 'orders' }, stores: { uz: 'rasta', ru: 'раст', en: 'stalls' },
    staff: { uz: 'xodim', ru: 'работников', en: 'workers' }, customers: { uz: 'xaridor', ru: 'покупателей', en: 'customers' },
    events: { uz: 'voqea', ru: 'событий', en: 'events' },
  },
};

const EVENT = {
  created: { uz: 'Yangi buyurtma', ru: 'Новый заказ', en: 'New order', tone: 'blue' },
  taken: { uz: 'Aravachi buyurtmani oldi', ru: 'Аравачи взял заказ', en: 'A porter took the order', tone: 'turq' },
  taxi_taken: { uz: 'Taksichi buyurtmani oldi', ru: 'Таксист взял заказ', en: 'A taxi took the order', tone: 'turq' },
  seller_late: { uz: 'Rasta kechikmoqda', ru: 'Раста опаздывает', en: 'A stall is late', tone: 'warn' },
  no_show: { uz: 'Xaridor kelmadi', ru: 'Покупатель не пришёл', en: 'Customer did not come', tone: 'bad' },
  switched_to_self: { uz: "Xaridor o'zi olishga o'tdi", ru: 'Покупатель заберёт сам', en: 'Customer will collect', tone: 'turq' },
  taxi_released: { uz: 'Taksichi voz kechdi', ru: 'Таксист отказался', en: 'A taxi gave the order back', tone: 'warn' },
  returned: { uz: 'Mahsulot rastaga qaytdi', ru: 'Товар вернулся на расту', en: 'Goods back at the stall', tone: 'warn' },
  received: { uz: 'Xaridor qabul qildi', ru: 'Покупатель получил', en: 'Customer received it', tone: 'good' },
};
const STATUS = {
  accepted: { uz: 'Qabul qilindi', ru: 'Принят', en: 'Accepted', tone: 'blue' },
  picking: { uz: "Aravachi yig'moqda", ru: 'Аравачи собирает', en: 'Porter is collecting', tone: 'turq' },
  ready: { uz: 'Tayyor', ru: 'Готов', en: 'Ready', tone: 'turq' },
  at_point: { uz: 'Joyga keltirildi', ru: 'Доставлен на точку', en: 'At the meeting point', tone: 'turq' },
  handed_over: { uz: 'Taksiga berildi', ru: 'Передан таксисту', en: 'Handed to the taxi', tone: 'turq' },
  on_the_way: { uz: "Yo'lda", ru: 'В пути', en: 'On the way', tone: 'turq' },
  delivered: { uz: 'Yetkazildi', ru: 'Доставлен', en: 'Delivered', tone: 'good' },
  cancelled: { uz: 'Bekor qilindi', ru: 'Отменён', en: 'Cancelled', tone: 'bad' },
  no_show: { uz: 'Xaridor kelmadi', ru: 'Покупатель не пришёл', en: 'Customer did not come', tone: 'bad' },
  returned: { uz: 'Qaytarildi', ru: 'Возвращён', en: 'Returned', tone: 'warn' },
};
const ROLE = { porter: { uz: 'aravachi', ru: 'аравачи', en: 'porter' }, taxi: { uz: 'taksichi', ru: 'таксист', en: 'taxi driver' }, pattachi: { uz: 'pattachi', ru: 'паттачи', en: 'fee collector' } };
const INCIDENT = {
  late_to_gate: { uz: 'darvozaga kelmadi', ru: 'не приехал к воротам', en: 'never came to the gate' },
  released: { uz: 'buyurtmadan voz kechdi', ru: 'отказался от заказа', en: 'gave the order back' },
  late_delivery: { uz: 'kech yetkazdi', ru: 'опоздал с доставкой', en: 'late delivery' },
};
const TONE = {
  blue: { dot: '#12355b', bg: '#eef2f7' }, turq: { dot: '#17777a', bg: '#eef5f5' }, good: { dot: '#15803d', bg: '#f0f7f1' },
  warn: { dot: '#b45309', bg: '#fdf6e7' }, bad: { dot: '#b91c1c', bg: '#fdf0f0' },
};
const MONTHS = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const MONTHS_NOM = {
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const PERIOD_KEYS = ['day', 'week', 'month'];
// Fewer cancellations and no-shows is good news
const LOWER_IS_BETTER = new Set(['cancelled', 'no_show']);

const num = { fontVariantNumeric: 'tabular-nums' };
const card = { background: '#ffffff', border: '1px solid var(--naqsh-line, #eadfca)', borderRadius: 18, padding: 14, marginBottom: 10 };
const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

function tashkentToday() {
  const now = new Date(Date.now() + 5 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

function shift(iso, period, step) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (period === 'day') d.setUTCDate(d.getUTCDate() + step);
  else if (period === 'week') d.setUTCDate(d.getUTCDate() + 7 * step);
  else { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + step); }
  return d.toISOString().slice(0, 10);
}

function rangeLabel(data, lang) {
  if (!data) return '';
  const [fy, fm, fd] = data.from.split('-').map(Number);
  const [ty, tm, td] = data.to.split('-').map(Number);
  if (data.period === 'month') return `${MONTHS_NOM[lang][fm - 1]} ${fy}`;
  if (data.period === 'day') return `${fd} ${MONTHS[lang][fm - 1]} ${fy}`;
  return fm === tm ? `${fd}–${td} ${MONTHS[lang][tm - 1]}` : `${fd} ${MONTHS[lang][fm - 1]} – ${td} ${MONTHS[lang][tm - 1]}`;
}

const money = (v) => Math.round(v || 0).toLocaleString('ru-RU');

function timeAgo(iso, lang) {
  const at = new Date(`${iso}+05:00`).getTime();
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 1) return lang === 'ru' ? 'только что' : (lang === 'en' ? 'just now' : 'hozirgina');
  if (m < 60) return lang === 'ru' ? `${m} мин назад` : (lang === 'en' ? `${m} min ago` : `${m} daq oldin`);
  const h = Math.round(m / 60);
  if (h < 24) return lang === 'ru' ? `${h} ч назад` : (lang === 'en' ? `${h} h ago` : `${h} soat oldin`);
  return iso.slice(0, 16).replace('T', ' ');
}

function Skeleton({ h = 18, w = '100%', r = 10, style }) {
  return <div aria-hidden="true" className="mon-skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

function Pressable({ children, style, ...rest }) {
  return <button type="button" className="mon-press" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', ...style }} {...rest}>{children}</button>;
}

function ErrorBox({ text, retryLabel, onRetry }) {
  return (
    <div role="alert" style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, background: '#fdf0f0', borderColor: '#f3d2d2', color: '#991b1b' }}>
      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{text}</span>
      <Pressable onClick={onRetry} style={{ minHeight: 40, padding: '0 12px', borderRadius: 12, background: '#ffffff', color: '#991b1b', fontWeight: 800, fontSize: 13 }}>{retryLabel}</Pressable>
    </div>
  );
}

function Kpi({ k, data, lang, tt }) {
  const { value, before, change } = data;
  const better = change == null ? null : (LOWER_IS_BETTER.has(k) ? change < 0 : change > 0);
  const flat = change === 0;
  const color = change == null || flat ? '#64748b' : (better ? '#15803d' : '#b91c1c');
  const Icon = change == null || flat ? null : (change > 0 ? TrendingUp : TrendingDown);
  return (
    <div data-testid={`kpi-${k}`} style={{ ...card, marginBottom: 0, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{T.kpi[k][lang]}</span>
      <span style={{ ...num, fontSize: 24, fontWeight: 800, color: 'var(--naqsh-blue, #12355b)', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {k === 'revenue' || k === 'avg_check' ? money(value) : value}
      </span>
      <span style={{ ...num, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color }}>
        {Icon && <Icon size={14} aria-hidden="true" />}
        {change == null ? '—' : `${change > 0 ? '+' : ''}${change}%`}
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {tt('vs')} {k === 'revenue' || k === 'avg_check' ? money(before) : before}</span>
      </span>
    </div>
  );
}

function Chart({ data, lang, tt }) {
  const [picked, setPicked] = useState(null);
  const series = data.series;
  const max = Math.max(1, ...series.map((b) => b.orders));
  const label = (b) => (data.period === 'day' ? `${b.label}:00` : `${Number(b.label.slice(8, 10))} ${MONTHS[lang][Number(b.label.slice(5, 7)) - 1]}`);
  const shown = picked != null ? series[picked] : null;
  useEffect(() => setPicked(null), [data.from, data.period]);
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 16, fontWeight: 700, color: 'var(--naqsh-blue, #12355b)' }}>
          {data.period === 'day' ? tt('chart_day') : tt('chart_days')}
        </span>
        <span aria-live="polite" style={{ ...num, fontSize: 12, fontWeight: 700, color: shown ? 'var(--naqsh-blue, #12355b)' : '#94a3b8', textAlign: 'right' }}>
          {shown ? `${label(shown)} · ${shown.orders} · ${money(shown.revenue)}` : tt('chart_hint')}
        </span>
      </div>
      <div role="group" aria-label={data.period === 'day' ? tt('chart_day') : tt('chart_days')} style={{ display: 'flex', alignItems: 'flex-end', gap: series.length > 24 ? 2 : 3, height: 120 }}>
        {series.map((b, i) => (
          <button
            key={b.label} type="button" aria-label={`${label(b)}: ${b.orders}`} aria-pressed={picked === i}
            onClick={() => { triggerHaptic('selection'); setPicked(picked === i ? null : i); }}
            className="mon-bar"
            style={{ flex: 1, minWidth: 0, height: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'flex-end' }}
          >
            <span style={{
              display: 'block', width: '100%', borderRadius: '4px 4px 2px 2px',
              height: `${Math.max(b.orders ? 6 : 2, (100 * b.orders) / max)}%`,
              background: picked === i ? 'var(--naqsh-gold, #e9c46a)' : (b.orders ? 'var(--naqsh-blue, #12355b)' : '#eadfca'),
              transition: `height 420ms ${ease}, background 160ms ${ease}`,
            }} />
          </button>
        ))}
      </div>
      <div style={{ ...num, display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
        <span>{label(series[0])}</span><span>{label(series[series.length - 1])}</span>
      </div>
    </div>
  );
}

function Numbers({ lang, tt }) {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(tashkentToday);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const dateInput = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.adminMonitor(period, date)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message || tt('error')); setLoading(false); });
  }, [period, date]);
  useEffect(load, [load]);

  const today = tashkentToday();
  const atNewest = data && data.to >= today;
  const p = data?.problems;
  const noProblems = p && !p.late_stalls.length && !p.staff_incidents.length && !p.low_ratings.length && !p.blocked_customers;

  return (
    <>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div role="tablist" aria-label="period" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, background: 'var(--naqsh-sand, #f5efe2)', borderRadius: 14, padding: 4 }}>
          {PERIOD_KEYS.map((key, i) => (
            <Pressable key={key} role="tab" aria-selected={period === key} data-testid={`period-${key}`}
              onClick={() => { triggerHaptic('selection'); setPeriod(key); }}
              style={{ minHeight: 40, borderRadius: 11, fontSize: 14, fontWeight: 800, background: period === key ? 'var(--naqsh-blue, #12355b)' : 'transparent', color: period === key ? '#ffffff' : '#334155', transition: `background 160ms ${ease}, color 160ms ${ease}` }}>
              {T.periods[lang][i]}
            </Pressable>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Pressable aria-label={tt('prev')} onClick={() => setDate(shift(date, period, -1))} style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--naqsh-sand, #f5efe2)', color: 'var(--naqsh-blue, #12355b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={20} />
          </Pressable>
          <label style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12, background: '#ffffff', border: '1.5px solid var(--naqsh-line, #eadfca)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span data-testid="period-label" style={{ ...num, fontWeight: 800, fontSize: 15, color: 'var(--naqsh-blue, #12355b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>
              {data ? rangeLabel(data, lang) : '…'}
            </span>
            {/* The native picker: any day inside the wanted week or month */}
            <input ref={dateInput} type="date" aria-label={tt('pick')} value={date} max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
          </label>
          <Pressable aria-label={tt('next')} disabled={atNewest} onClick={() => setDate(shift(date, period, 1))} style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--naqsh-sand, #f5efe2)', color: 'var(--naqsh-blue, #12355b)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: atNewest ? 0.35 : 1, cursor: atNewest ? 'not-allowed' : 'pointer' }}>
            <ChevronRight size={20} />
          </Pressable>
          {date !== today && (
            <Pressable onClick={() => setDate(today)} style={{ minHeight: 44, padding: '0 12px', borderRadius: 12, background: 'var(--naqsh-gold, #e9c46a)', color: 'var(--naqsh-blue, #12355b)', fontWeight: 800, fontSize: 13 }}>{tt('today')}</Pressable>
          )}
        </div>
      </div>

      {error && <ErrorBox text={`${tt('error')}: ${error}`} retryLabel={tt('retry')} onRetry={load} />}

      {loading && !data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ ...card, marginBottom: 0 }}><Skeleton h={12} w="55%" /><Skeleton h={26} w="70%" style={{ marginTop: 8 }} /><Skeleton h={12} w="80%" style={{ marginTop: 8 }} /></div>)}
          </div>
          <div style={card}><Skeleton h={120} r={12} /></div>
        </>
      ) : data && (
        <div style={{ opacity: loading ? 0.55 : 1, transition: `opacity 160ms ${ease}` }} aria-busy={loading}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 45%), 1fr))', gap: 8, marginBottom: 10 }}>
            {['orders', 'revenue', 'delivered', 'avg_check', 'cancelled', 'no_show'].map((k) => <Kpi key={k} k={k} data={data.kpi[k]} lang={lang} tt={tt} />)}
          </div>
          <Chart data={data} lang={lang} tt={tt} />

          <div style={card}>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 16, fontWeight: 700, color: 'var(--naqsh-blue, #12355b)', marginBottom: 10 }}>{tt('regs')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {['stores', 'porters', 'taxis', 'customers'].map((k) => (
                <div key={k} style={{ background: 'var(--naqsh-sand, #f5efe2)', borderRadius: 12, padding: '10px 6px', textAlign: 'center', minWidth: 0 }}>
                  <div style={{ ...num, fontSize: 20, fontWeight: 800, color: 'var(--naqsh-blue, #12355b)' }}>{data.registrations[k]}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{T.reg[k][lang]}</div>
                </div>
              ))}
            </div>
          </div>

          <div data-testid="problems" style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Lora', Georgia, serif", fontSize: 16, fontWeight: 700, color: 'var(--naqsh-blue, #12355b)', marginBottom: 8 }}>
              <AlertTriangle size={17} aria-hidden="true" /> {tt('problems')}
            </div>
            {noProblems ? (
              <div style={{ padding: '14px 12px', borderRadius: 12, background: '#f0f7f1', color: '#166534', fontSize: 14, fontWeight: 700 }}>{tt('no_problems')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {p.late_stalls.length > 0 && <ProblemList title={tt('late_stalls')} rows={p.late_stalls.map((r) => [r.stall, `${r.count} ${tt('times')}`])} />}
                {p.staff_incidents.length > 0 && <ProblemList title={tt('incidents')} rows={p.staff_incidents.map((r) => [`${r.name} · ${ROLE[r.role]?.[lang] || r.role}`, `${INCIDENT[r.kind]?.[lang] || r.kind} · ${r.count}`])} />}
                {p.low_ratings.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>{tt('low')}</div>
                    {p.low_ratings.map((r) => (
                      <div key={r.order} style={{ padding: '8px 0', borderTop: '1px solid #f3ecdd' }}>
                        <div style={{ ...num, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}>
                          <span>#{r.order}</span><span style={{ color: '#b45309' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        </div>
                        {r.comment && <div style={{ fontSize: 13, color: '#334155', marginTop: 2, overflowWrap: 'anywhere' }}>«{r.comment}»</div>}
                      </div>
                    ))}
                  </div>
                )}
                {p.blocked_customers > 0 && <ProblemList title={tt('blocked')} rows={[['', String(p.blocked_customers)]]} />}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ProblemList({ title, rows }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 4 }}>{title}</div>
      {rows.map(([a, b], i) => (
        <div key={`${a}-${i}`} style={{ ...num, display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderTop: '1px solid #f3ecdd', fontSize: 14 }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{a}</span>
          <span style={{ flexShrink: 0, fontWeight: 800, color: '#b45309' }}>{b}</span>
        </div>
      ))}
    </div>
  );
}

function Feed({ lang, tt }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState(new Set());
  const [more, setMore] = useState(false);
  const seen = useRef(new Set());

  const key = (i) => `${i.type}-${i.id ?? i.name}-${i.at}`;
  const load = useCallback(() => {
    api.adminFeed().then((list) => {
      const isFirst = seen.current.size === 0;
      const added = new Set(list.map(key).filter((k) => !seen.current.has(k)));
      list.forEach((i) => seen.current.add(key(i)));
      setItems((old) => {
        if (!old) return list;
        const older = old.filter((o) => !list.some((n) => key(n) === key(o)));
        return [...list, ...older.filter((o) => o.at < (list[list.length - 1]?.at || ''))];
      });
      if (!isFirst && added.size) {
        setFresh(added);
        setTimeout(() => setFresh(new Set()), 2400);
      }
      setError('');
    }).catch((e) => setError(e.message || tt('error')));
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const loadMore = () => {
    const last = [...(items || [])].reverse().find((i) => i.id);
    if (!last) return;
    setMore(true);
    api.adminFeed(last.id).then((list) => {
      list.forEach((i) => seen.current.add(key(i)));
      setItems((old) => [...old, ...list]);
    }).catch((e) => setError(e.message)).finally(() => setMore(false));
  };

  const text = (i) => {
    if (i.type === 'store') return lang === 'ru' ? `Новая раста: ${i.name}` : (lang === 'en' ? `New stall: ${i.name}` : `Yangi rasta: ${i.name}`);
    if (i.type === 'staff') return `${lang === 'ru' ? 'Новый работник' : (lang === 'en' ? 'New worker' : 'Yangi xodim')}: ${i.name} · ${ROLE[i.role]?.[lang] || i.role}`;
    if (i.kind === 'status') return (STATUS[i.to_status] || { [lang]: i.to_status })[lang];
    return (EVENT[i.kind] || { [lang]: i.kind })[lang];
  };
  const tone = (i) => (i.type !== 'order' ? 'blue' : (i.kind === 'status' ? STATUS[i.to_status]?.tone : EVENT[i.kind]?.tone) || 'blue');

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
        <span className="mon-pulse" aria-hidden="true" /> {tt('live')}
      </div>
      {error && <ErrorBox text={`${tt('error')}: ${error}`} retryLabel={tt('retry')} onRetry={load} />}
      {items === null && !error && [0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0' }}><Skeleton h={10} w={10} r={5} style={{ marginTop: 4 }} /><div style={{ flex: 1 }}><Skeleton h={14} w="70%" /><Skeleton h={11} w="40%" style={{ marginTop: 6 }} /></div></div>
      ))}
      {items && items.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 4px', color: '#64748b', fontSize: 14 }}>
          <Radio size={20} aria-hidden="true" /> {tt('feed_empty')}
        </div>
      )}
      {items && items.length > 0 && (
        <ol data-testid="feed" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((i) => {
            const c = TONE[tone(i)];
            const isNew = fresh.has(key(i));
            return (
              <li key={key(i)} className={isNew ? 'mon-new' : undefined} style={{ display: 'flex', gap: 10, padding: '10px 8px', margin: '0 -8px', borderTop: '1px solid #f3ecdd', borderRadius: 10 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, marginTop: 5, flexShrink: 0, boxShadow: `0 0 0 4px ${c.bg}` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', overflowWrap: 'anywhere' }}>
                    {text(i)}
                    {i.kind === 'seller_late' && i.data?.minutes ? <span style={{ ...num, color: '#b45309' }}> · {i.data.minutes} {tt('min')}</span> : null}
                  </div>
                  <div style={{ ...num, fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {i.order ? `#${i.order} · ${money(i.amount)} · ` : ''}{timeAgo(i.at, lang)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {items && items.some((i) => i.id) && items.length >= 40 && (
        <Pressable onClick={loadMore} disabled={more} style={{ width: '100%', minHeight: 44, marginTop: 8, borderRadius: 12, background: 'var(--naqsh-sand, #f5efe2)', color: 'var(--naqsh-blue, #12355b)', fontWeight: 800, fontSize: 14, opacity: more ? 0.6 : 1 }}>
          {more ? '…' : tt('more')}
        </Pressable>
      )}
    </div>
  );
}

function System({ lang, tt }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api.adminSystem().then((d) => { setS(d); setError(''); }).catch((e) => setError(e.message || tt('error')));
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <ErrorBox text={`${tt('error')}: ${error}`} retryLabel={tt('retry')} onRetry={load} />;
  if (!s) return <div style={card}><Skeleton h={16} w="40%" /><Skeleton h={12} style={{ marginTop: 12 }} /><Skeleton h={16} w="60%" style={{ marginTop: 18 }} /></div>;

  const pct = Math.min(100, s.db_used_pct);
  const dbColor = pct >= 80 ? '#b91c1c' : (pct >= 60 ? '#b45309' : 'var(--naqsh-turq, #17777a)');
  const okText = (v) => typeof v === 'string' && (v === 'ok' || v.startsWith('ok') || v === 'on');
  const services = [['Telegram bot', s.bot], ['Webhook', s.webhook], [tt('r2'), s.r2], [tt('backup'), s.backup]];
  return (
    <>
      <div data-testid="system-db" style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Lora', Georgia, serif", fontSize: 16, fontWeight: 700, color: 'var(--naqsh-blue, #12355b)' }}>
          <Database size={17} aria-hidden="true" /> {tt('db')}
        </div>
        <div style={{ ...num, display: 'flex', alignItems: 'baseline', gap: 6, margin: '8px 0 6px' }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: dbColor }}>{s.db_mb}</span>
          <span style={{ fontSize: 14, color: '#64748b', fontWeight: 700 }}>/ {s.db_limit_mb} MB · {s.db_used_pct}%</span>
        </div>
        <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={tt('db')} style={{ height: 10, borderRadius: 5, background: 'var(--naqsh-sand, #f5efe2)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(pct, 1)}%`, height: '100%', background: dbColor, borderRadius: 5, transition: `width 600ms ${ease}` }} />
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.45 }}>{tt('db_note')}</div>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Lora', Georgia, serif", fontSize: 16, fontWeight: 700, color: 'var(--naqsh-blue, #12355b)', marginBottom: 6 }}>
          <Activity size={17} aria-hidden="true" /> {tt('services')}
        </div>
        {services.map(([name, value]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid #f3ecdd' }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: okText(value) ? '#15803d' : '#b91c1c', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{name}</span>
            <span style={{ fontSize: 12, color: okText(value) ? '#166534' : '#991b1b', fontWeight: 700, maxWidth: '55%', textAlign: 'right', overflowWrap: 'anywhere' }}>{value || '—'}</span>
          </div>
        ))}
        <div style={{ ...num, display: 'flex', justifyContent: 'space-between', paddingTop: 9, borderTop: '1px solid #f3ecdd', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          <span>{tt('uptime')}</span><span>{s.uptime_min} {tt('min')}</span>
        </div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>{tt('rows')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6 }}>
          {Object.entries(s.rows).map(([k, v]) => (
            <div key={k} style={{ background: 'var(--naqsh-sand, #f5efe2)', borderRadius: 12, padding: '8px 10px' }}>
              <div style={{ ...num, fontSize: 18, fontWeight: 800, color: 'var(--naqsh-blue, #12355b)' }}>{v.toLocaleString('ru-RU')}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{T.row[k]?.[lang] || k}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function MonitorPanel({ lang }) {
  const tt = (key) => (T[key] && T[key][lang] !== undefined ? T[key][lang] : key);
  const [view, setView] = useState(0);
  return (
    <div data-testid="monitor" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <style>{`
        .mon-press { transition: transform 120ms ${ease}, background 160ms ${ease}; }
        .mon-press:active:not(:disabled) { transform: scale(0.97); }
        .mon-press:focus-visible, .mon-bar:focus-visible { outline: 2px solid #12355b; outline-offset: 2px; }
        .mon-bar:hover span { filter: brightness(1.25); }
        .mon-skel { background: linear-gradient(90deg, #f3ecdd 0%, #faf6ee 50%, #f3ecdd 100%); background-size: 200% 100%; animation: mon-shimmer 1.2s linear infinite; }
        @keyframes mon-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .mon-pulse { width: 8px; height: 8px; border-radius: 50%; background: #15803d; box-shadow: 0 0 0 0 rgba(21,128,61,0.5); animation: mon-pulse 1.8s ease-out infinite; }
        @keyframes mon-pulse { to { box-shadow: 0 0 0 8px rgba(21,128,61,0); } }
        .mon-new { animation: mon-new 2.4s ${ease}; }
        @keyframes mon-new { from { background: #fbf1d3; } to { background: transparent; } }
        @media (prefers-reduced-motion: reduce) { .mon-skel, .mon-pulse, .mon-new { animation: none; } .mon-press:active { transform: none; } }
      `}</style>
      <div role="tablist" aria-label="monitoring" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginBottom: 10 }}>
        {T.views[lang].map((name, i) => (
          <Pressable key={name} role="tab" aria-selected={view === i} data-testid={`monitor-view-${i}`}
            onClick={() => { triggerHaptic('selection'); setView(i); }}
            style={{ minHeight: 44, borderRadius: 14, fontSize: 14, fontWeight: 800, background: view === i ? 'var(--naqsh-blue, #12355b)' : '#ffffff', color: view === i ? 'var(--naqsh-gold, #e9c46a)' : '#334155', border: view === i ? 'none' : '1px solid var(--naqsh-line, #eadfca)' }}>
            {name}
          </Pressable>
        ))}
      </div>
      {view === 0 && <Numbers lang={lang} tt={tt} />}
      {view === 1 && <Feed lang={lang} tt={tt} />}
      {view === 2 && <System lang={lang} tt={tt} />}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}><RefreshCw size={12} aria-hidden="true" /> bozorbot.uz</span>
      </div>
    </div>
  );
}
