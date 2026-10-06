'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------
// MonthInReview.jsx
// A tap-through, story-style recap of one month of trades.
// Props:
//   trades    - ALL of the user's trades (rows from your `trades` table)
//   monthDate - any Date inside the month you want to review
//   onClose   - called when the user closes the recap
//   startAt   - (optional) slide number to start on, handy for testing
// ---------------------------------------------------------------

const GREEN = '#3ecf8e';
const RED = '#f2555a';
const AMBER = '#e0b45a';
const DIM = '#8b93a3';
const CARD = '#0b0d10';
const MONO = 'inherit'; // numbers and labels use the same clean font as the rest of the app
const SERIF = 'inherit';

// Privacy mode: when on, every dollar amount in the recap shows as $•••
let MASK_MONEY = false;

function money(n, { sign = false, decimals = 2 } = {}) {
  if (MASK_MONEY) return '$•••';
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (n < 0) return '-$' + abs;
  return (sign ? '+' : '') + '$' + abs;
}

function prettyDate(key) {
  return new Date(key + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function shortDay(key) {
  return new Date(key + 'T00:00:00')
    .toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    .toUpperCase();
}

function groupTotals(list, keyFn) {
  const map = {};
  list.forEach((t) => {
    const k = keyFn(t);
    if (!k) return;
    map[k] = map[k] || { name: k, pnl: 0, count: 0 };
    map[k].pnl += Number(t.pnl) || 0;
    map[k].count += 1;
  });
  return Object.values(map);
}

// ---------------------------------------------------------------
// All the math for the recap lives here
// ---------------------------------------------------------------
export function buildReview(allTrades, monthDate) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  const monthName = monthDate.toLocaleDateString(undefined, { month: 'long' });

  const list = (allTrades || []).filter(
    (t) => !t.no_trade_day && String(t.trade_date).startsWith(prefix)
  );
  if (list.length === 0) return { empty: true, monthName, year: y };

  const pnlOf = (t) => Number(t.pnl) || 0;
  const net = list.reduce((s, t) => s + pnlOf(t), 0);
  const wins = list.filter((t) => pnlOf(t) > 0);
  const losses = list.filter((t) => pnlOf(t) < 0);
  const winRate = Math.round((wins.length / list.length) * 100);

  // average reward-to-risk = average winner / average loser
  const sumWins = wins.reduce((s, t) => s + pnlOf(t), 0);
  const sumLosses = Math.abs(losses.reduce((s, t) => s + pnlOf(t), 0));
  const avgWin = wins.length ? sumWins / wins.length : 0;
  const avgLoss = losses.length ? sumLosses / losses.length : 0;
  const avgRR = avgWin > 0 && avgLoss > 0 ? avgWin / avgLoss : null;
  const rrText = avgRR ? `1:${avgRR.toFixed(1)}` : '—';

  // per-day totals + running equity
  const byDay = {};
  list.forEach((t) => { (byDay[t.trade_date] = byDay[t.trade_date] || []).push(t); });
  const dayKeys = Object.keys(byDay).sort();
  const dayTotals = dayKeys.map((k) => byDay[k].reduce((s, t) => s + pnlOf(t), 0));
  let run = 0;
  const cumulative = dayTotals.map((v) => (run += v));
  const bestIdx = dayTotals.indexOf(Math.max(...dayTotals));
  const worstIdx = dayTotals.indexOf(Math.min(...dayTotals));

  const bestTrade = list.reduce((a, b) => (pnlOf(b) > pnlOf(a) ? b : a));
  const worstTrade = list.reduce((a, b) => (pnlOf(b) < pnlOf(a) ? b : a));

  // grade distribution (A+ and A grouped, D and F grouped)
  const gradeCount = { A: 0, B: 0, C: 0, 'D/F': 0 };
  list.forEach((t) => {
    if (t.grade === 'A+' || t.grade === 'A') gradeCount.A++;
    else if (t.grade === 'B') gradeCount.B++;
    else if (t.grade === 'C') gradeCount.C++;
    else if (t.grade === 'D' || t.grade === 'F') gradeCount['D/F']++;
  });
  const grades = ['A', 'B', 'C', 'D/F']
    .map((label) => ({ label, count: gradeCount[label] }))
    .filter((g) => g.label !== 'D/F' || g.count > 0);

  const bySetup = groupTotals(list, (t) => (t.setup || '').trim());
  const bySession = groupTotals(list, (t) => t.session);
  const topSetup = bySetup.length ? bySetup.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const topSession = bySession.length ? bySession.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;

  // mistakes
  const mistakeMap = {};
  list.forEach((t) => {
    (t.mistakes || []).forEach((mk) => {
      if (mk === 'No mistake') return;
      mistakeMap[mk] = mistakeMap[mk] || { name: mk, count: 0, pnl: 0 };
      mistakeMap[mk].count += 1;
      mistakeMap[mk].pnl += pnlOf(t);
    });
  });
  const mistakes = Object.values(mistakeMap).sort((a, b) => b.count - a.count || a.pnl - b.pnl);
  const topMistake = mistakes[0] || null;

  const offPlan = list.filter((t) => t.followed_plan === false);
  const offPlanPnl = offPlan.reduce((s, t) => s + pnlOf(t), 0);

  // plain-English breakdown (rule-based, no API needed)
  const breakdown = [];
  breakdown.push({
    title: 'The month',
    text: `${list.length} trade${list.length === 1 ? '' : 's'} across ${dayKeys.length} session${dayKeys.length === 1 ? '' : 's'} for ${money(net, { sign: true })} at a ${winRate}% win rate.`,
  });
  if (topSetup || topSession) {
    const parts = [];
    if (topSetup) parts.push(`${topSetup.name} was your best setup (${money(topSetup.pnl, { sign: true })})`);
    if (topSession) parts.push(`${topSession.name} was your most profitable session (${money(topSession.pnl, { sign: true })})`);
    breakdown.push({ title: 'What worked', text: parts.join(', and ') + '.' });
  }
  const costs = [];
  if (topMistake) costs.push(`"${topMistake.name}" showed up ${topMistake.count} time${topMistake.count === 1 ? '' : 's'} (${money(topMistake.pnl, { sign: true })} on those trades).`);
  if (offPlan.length) costs.push(`You broke your plan on ${offPlan.length} trade${offPlan.length === 1 ? '' : 's'}, which netted ${money(offPlanPnl, { sign: true })}.`);
  if (costs.length) breakdown.push({ title: 'What cost you', text: costs.join(' ') });
  const focus = [];
  if (topMistake) focus.push(`Cut "${topMistake.name}".`);
  if (topSetup && topSetup.pnl > 0) focus.push(`Lean into ${topSetup.name}.`);
  if (focus.length) breakdown.push({ title: 'Next month', text: focus.join(' ') });

  return {
    empty: false, monthName, year: y, list, net, winRate,
    winCount: wins.length, lossCount: losses.length,
    tradeCount: list.length, dayCount: dayKeys.length,
    avgRR, rrText,
    dayKeys, dayTotals, cumulative, bestIdx, worstIdx,
    bestDayPnl: dayTotals[bestIdx], worstDayPnl: dayTotals[worstIdx],
    firstDayLabel: shortDay(dayKeys[0]), lastDayLabel: shortDay(dayKeys[dayKeys.length - 1]),
    bestTrade, worstTrade, grades, topSetup, topSession, breakdown,
  };
}

// ---------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------
function Chip({ children, color = GREEN }) {
  return (
    <div style={{
      display: 'inline-block', fontFamily: MONO, fontSize: 11.5, fontWeight: 500, letterSpacing: '.08em',
      textTransform: 'uppercase', color, border: `1px solid ${color}55`,
      background: `${color}14`, padding: '7px 14px', borderRadius: 999,
    }}>{children}</div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: color || '#e8e8e8' }}>{value}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.07em', color: DIM, textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function EquityLine({ values, width = 300, height = 140, id = 'mirFill' }) {
  if (!values.length) return null;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
    height - ((v - min) / span) * (height - 16) - 8,
  ]);
  const line = pts.map((p) => p.join(',')).join(' ');
  const up = values[values.length - 1] >= 0;
  const color = up ? GREEN : RED;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {values.length > 1 && <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#${id})`} />}
      {values.length > 1
        ? <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        : <circle cx={pts[0][0]} cy={pts[0][1]} r="4" fill={color} />}
      {values.length > 1 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={color} />}
    </svg>
  );
}

function TradeCard({ t, color, hidePhoto = false }) {
  const [imgOk, setImgOk] = useState(true);
  const why = (t.why_text || '').trim();
  const photo = Array.isArray(t.photo_urls) && t.photo_urls.length ? t.photo_urls[0] : null;
  return (
    <div style={{
      width: '100%', textAlign: 'left', border: `1px solid ${color}44`, background: `${color}0f`,
      borderRadius: 14, padding: 14, marginTop: 20,
    }}>
      {photo && hidePhoto && (
        <div style={{ fontSize: 12, color: DIM, marginBottom: 12 }}>Screenshot hidden in privacy mode</div>
      )}
      {photo && imgOk && !hidePhoto && (
        <img
          src={photo} alt="Trade screenshot" onError={() => setImgOk(false)}
          style={{
            display: 'block', width: '100%', maxHeight: 210, objectFit: 'contain',
            background: '#000', borderRadius: 10, border: '1px solid #232933', marginBottom: 12,
          }}
        />
      )}
      <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, marginBottom: 8 }}>{prettyDate(t.trade_date)}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>
        {t.symbol} <span style={{ fontSize: 12, fontWeight: 500, color: DIM }}>{(t.direction || '').toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 12.5, color: DIM, marginTop: 6 }}>
        {t.setup ? <>Setup <b style={{ color: '#d6d9df' }}>{t.setup}</b></> : null}
        {t.setup && t.grade ? ' · ' : null}
        {t.grade ? <>Grade <b style={{ color: '#d6d9df' }}>{t.grade}</b></> : null}
      </div>
      {why && (
        <div style={{ fontSize: 13, color: '#aab0bc', marginTop: 10, fontStyle: 'italic', lineHeight: 1.45 }}>
          “{why.length > 150 ? why.slice(0, 150).trim() + '…' : why}”
        </div>
      )}
    </div>
  );
}

// On-screen preview of the share card (the PNG below is drawn to match it)
function ShareCardPreview({ r }) {
  const up = r.net >= 0;
  const miniBox = (label, t, color) => (
    <div style={{ flex: 1, border: `1px solid ${color}44`, background: `${color}0f`, borderRadius: 12, padding: 10, textAlign: 'left' }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.07em', color: DIM }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color, marginTop: 5 }}>{money(Number(t.pnl), { sign: true })}</div>
      <div style={{ fontSize: 10.5, color: DIM, marginTop: 3 }}>{t.symbol} {(t.direction || '').toUpperCase()}</div>
    </div>
  );
  return (
    <div style={{ width: '100%', border: '1px solid #232933', borderRadius: 18, padding: 16, textAlign: 'left', background: '#0f1217' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', color: DIM }}>TRADER EDGE</div>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.07em', color: GREEN, border: `1px solid ${GREEN}55`, borderRadius: 99, padding: '3px 8px' }}>MONTHLY RECAP</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: '#e8e8e8', marginTop: 10 }}>
        {r.monthName} <span style={{ color: '#5d6572', fontWeight: 400 }}>{r.year}</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.07em', color: DIM, marginTop: 8 }}>NET P&amp;L</div>
      <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 600, color: up ? GREEN : RED, lineHeight: 1.1, marginTop: 2 }}>
        {money(r.net, { sign: true })}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: DIM, marginTop: 6 }}>
        Best day {money(r.bestDayPnl, { sign: true, decimals: 0 })} · Worst day {money(r.worstDayPnl, { sign: true, decimals: 0 })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #232933', borderRadius: 12, padding: '10px 6px', marginTop: 14 }}>
        {[[`${r.winRate}%`, 'WIN RATE'], [r.rrText, 'AVG R:R'], [r.tradeCount, 'TRADES'], [r.dayCount, 'DAYS']].map(([v, l]) => (
          <div key={l} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: '#e8e8e8' }}>{v}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.07em', color: DIM, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #232933', borderRadius: 12, padding: '10px 12px 8px', marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 9.5, letterSpacing: '.07em', color: DIM, marginBottom: 6 }}>
          <span>EQUITY CURVE</span>
          <span style={{ color: up ? GREEN : RED }}>{money(r.net, { sign: true })}</span>
        </div>
        <EquityLine values={r.cumulative} height={80} id="mirFillShare" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 9.5, color: '#5d6572', marginTop: 4 }}>
          <span>{r.firstDayLabel}</span><span>{r.lastDayLabel}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        {miniBox('BEST TRADE', r.bestTrade, GREEN)}
        {miniBox('WORST TRADE', r.worstTrade, RED)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Share image (drawn on a canvas so it works with no extra libraries)
// ---------------------------------------------------------------
export function drawShareCard(canvas, r) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const bodyFont = typeof document !== 'undefined' ? getComputedStyle(document.body).fontFamily : '';
  const sans = bodyFont || 'system-ui, -apple-system, Segoe UI, sans-serif';
  const mono = sans; // numbers and labels use the same clean font
  const up = r.net >= 0;
  const accent = up ? GREEN : RED;

  const rr = (x, y, w, h, rad) => {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, rad); else c.rect(x, y, w, h);
  };
  const panel = (x, y, w, h, fill, stroke) => {
    rr(x, y, w, h, 28); c.fillStyle = fill; c.fill();
    c.lineWidth = 2; c.strokeStyle = stroke; c.stroke();
  };

  c.fillStyle = CARD; c.fillRect(0, 0, W, H);
  c.textAlign = 'left';

  // header
  c.fillStyle = DIM; c.font = `600 24px ${mono}`;
  c.fillText('TRADER EDGE', 80, 100);
  const tag = 'MONTHLY RECAP';
  c.font = `600 20px ${mono}`;
  const tw = c.measureText(tag).width;
  rr(W - 80 - tw - 40, 70, tw + 40, 46, 23); c.fillStyle = GREEN + '14'; c.fill();
  c.strokeStyle = GREEN + '66'; c.lineWidth = 2; c.stroke();
  c.fillStyle = GREEN; c.fillText(tag, W - 80 - tw - 20, 101);

  // title
  c.fillStyle = '#e8e8e8'; c.font = `600 72px ${sans}`;
  c.fillText(r.monthName, 80, 215);
  const mw = c.measureText(r.monthName + ' ').width;
  c.fillStyle = '#5d6572'; c.font = `400 72px ${sans}`;
  c.fillText(String(r.year), 80 + mw, 215);

  // net pnl
  c.fillStyle = DIM; c.font = `500 24px ${mono}`;
  c.fillText('NET P&L', 80, 285);
  c.fillStyle = accent; c.font = `600 128px ${mono}`;
  c.fillText(money(r.net, { sign: true }), 80, 410);
  c.fillStyle = DIM; c.font = `500 24px ${mono}`;
  c.fillText(`Best day ${money(r.bestDayPnl, { sign: true, decimals: 0 })}  ·  Worst day ${money(r.worstDayPnl, { sign: true, decimals: 0 })}`, 80, 460);

  // stats row
  panel(80, 500, 920, 130, '#0f1217', '#232933');
  const stats = [[`${r.winRate}%`, 'WIN RATE'], [r.rrText, 'AVG R:R'], [String(r.tradeCount), 'TRADES'], [String(r.dayCount), 'DAYS']];
  c.textAlign = 'center';
  stats.forEach(([v, l], i) => {
    const cx = 80 + 920 / 8 + i * (920 / 4);
    c.fillStyle = '#e8e8e8'; c.font = `600 50px ${mono}`; c.fillText(v, cx, 570);
    c.fillStyle = DIM; c.font = `500 18px ${mono}`; c.fillText(l, cx, 604);
  });
  c.textAlign = 'left';

  // equity curve panel
  panel(80, 660, 920, 300, '#0f1217', '#232933');
  c.fillStyle = DIM; c.font = `500 18px ${mono}`; c.fillText('EQUITY CURVE', 110, 705);
  c.textAlign = 'right'; c.fillStyle = accent; c.fillText(money(r.net, { sign: true }), 970, 705); c.textAlign = 'left';

  const x0 = 110, x1 = 970, y0 = 735, y1 = 905;
  const vals = r.cumulative;
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals), span = max - min || 1;
  const pt = (v, i) => [
    vals.length === 1 ? (x0 + x1) / 2 : x0 + (i / (vals.length - 1)) * (x1 - x0),
    y1 - ((v - min) / span) * (y1 - y0),
  ];
  if (vals.length > 1) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, accent + '55'); g.addColorStop(1, accent + '00');
    c.beginPath();
    vals.forEach((v, i) => { const [x, y] = pt(v, i); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.lineTo(x1, y1); c.lineTo(x0, y1); c.closePath(); c.fillStyle = g; c.fill();
    c.beginPath();
    vals.forEach((v, i) => { const [x, y] = pt(v, i); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.strokeStyle = accent; c.lineWidth = 5; c.lineJoin = 'round'; c.stroke();
  }
  const [ex, ey] = pt(vals[vals.length - 1], vals.length - 1);
  c.beginPath(); c.arc(ex, ey, 9, 0, Math.PI * 2); c.fillStyle = accent; c.fill();
  c.fillStyle = '#5d6572'; c.font = `500 18px ${mono}`;
  c.fillText(r.firstDayLabel, 110, 940);
  c.textAlign = 'right'; c.fillText(r.lastDayLabel, 970, 940); c.textAlign = 'left';

  // best / worst trade boxes
  const box = (x, label, t, color) => {
    panel(x, 990, 440, 210, color + '10', color + '55');
    c.fillStyle = DIM; c.font = `500 20px ${mono}`; c.fillText(label, x + 30, 1040);
    c.fillStyle = color; c.font = `600 58px ${mono}`; c.fillText(money(Number(t.pnl), { sign: true }), x + 30, 1112);
    c.fillStyle = '#aab0bc'; c.font = `500 24px ${sans}`;
    c.fillText(`${t.symbol} ${(t.direction || '').toUpperCase()}`.trim(), x + 30, 1160);
  };
  box(80, 'BEST TRADE', r.bestTrade, GREEN);
  box(W - 80 - 440, 'WORST TRADE', r.worstTrade, RED);

  c.fillStyle = '#4b5361'; c.font = `500 22px ${mono}`; c.textAlign = 'center';
  c.fillText('TRADED & JOURNALED WITH TRADER EDGE', W / 2, 1280);
}

async function shareOrDownload(canvas, r) {
  drawShareCard(canvas, r);
  const name = `${r.monthName.toLowerCase()}-${r.year}-review.png`;
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { /* cancelled */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

// ---------------------------------------------------------------
// The recap itself
// ---------------------------------------------------------------
const DURATIONS = { intro: 4000, net: 5500, shape: 6500, best: 7500, worst: 7500, how: 6500, breakdown: 15000 };

export default function MonthInReview({ trades, monthDate, onClose, startAt = 0, hideMoney = false }) {
  MASK_MONEY = !!hideMoney;
  const r = useMemo(() => buildReview(trades, monthDate), [trades, monthDate, hideMoney]);
  const slides = useMemo(
    () => (r.empty ? ['empty'] : ['intro', 'net', 'shape', 'best', 'worst', 'how', 'breakdown', 'share']),
    [r.empty]
  );
  const [i, setI] = useState(startAt);
  const canvasRef = useRef(null);

  const next = () => setI((x) => Math.min(slides.length - 1, x + 1));
  const prev = () => setI((x) => Math.max(0, x - 1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [slides.length]);

  const current = slides[i];
  const isLast = i === slides.length - 1;
  const duration = DURATIONS[current];

  function renderSlide() {
    if (current === 'empty') {
      return (
        <>
          <Chip color={DIM}>Month in review</Chip>
          <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, letterSpacing: '-.02em', color: '#fff', marginTop: 24 }}>{r.monthName} {r.year}</div>
          <div style={{ color: DIM, marginTop: 12, fontSize: 14 }}>No trades logged this month yet.</div>
        </>
      );
    }
    if (current === 'intro') {
      return (
        <>
          <Chip color={DIM}>Month in review</Chip>
          <div style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 600, letterSpacing: '-.03em', color: '#fff', marginTop: 28, lineHeight: 1.05 }}>
            {r.monthName} <span style={{ color: '#5d6572' }}>{r.year}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: DIM, marginTop: 18 }}>
            {r.tradeCount} trades · {r.dayCount} trading days
          </div>
        </>
      );
    }
    if (current === 'net') {
      const up = r.net >= 0;
      return (
        <>
          <Chip color={up ? GREEN : RED}>Net result</Chip>
          <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 600, letterSpacing: '-.025em', color: up ? GREEN : RED, marginTop: 26 }}>
            {money(r.net, { sign: true })}
          </div>
          <div style={{ display: 'flex', gap: 30, marginTop: 28 }}>
            <Stat label="Win rate" value={`${r.winRate}%`} />
            <Stat label="Wins" value={r.winCount} color={GREEN} />
            <Stat label="Losses" value={r.lossCount} color={RED} />
          </div>
        </>
      );
    }
    if (current === 'shape') {
      return (
        <>
          <Chip color={DIM}>The shape of it</Chip>
          <div style={{ width: '100%', marginTop: 28 }}><EquityLine values={r.cumulative} /></div>
          <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 24 }}>
            <div style={{ flex: 1, border: `1px solid ${GREEN}44`, background: `${GREEN}0f`, borderRadius: 12, padding: 12, textAlign: 'left' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.07em', color: DIM }}>BEST DAY</div>
              <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: GREEN, marginTop: 6 }}>{money(r.dayTotals[r.bestIdx], { sign: true })}</div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>{prettyDate(r.dayKeys[r.bestIdx])}</div>
            </div>
            <div style={{ flex: 1, border: `1px solid ${RED}44`, background: `${RED}0f`, borderRadius: 12, padding: 12, textAlign: 'left' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.07em', color: DIM }}>WORST DAY</div>
              <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: RED, marginTop: 6 }}>{money(r.dayTotals[r.worstIdx], { sign: true })}</div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>{prettyDate(r.dayKeys[r.worstIdx])}</div>
            </div>
          </div>
        </>
      );
    }
    if (current === 'best' || current === 'worst') {
      const t = current === 'best' ? r.bestTrade : r.worstTrade;
      const color = current === 'best' ? GREEN : RED;
      return (
        <>
          <Chip color={color}>{current === 'best' ? 'Best trade' : 'Worst trade'}</Chip>
          <div style={{ fontFamily: MONO, fontSize: 42, fontWeight: 600, letterSpacing: '-.025em', color, marginTop: 22 }}>
            {money(Number(t.pnl), { sign: true })}
          </div>
          <TradeCard t={t} color={color} hidePhoto={hideMoney} />
          {current === 'worst' && (
            <div style={{ fontSize: 12.5, color: DIM, marginTop: 16 }}>Every month has one. What matters is what it taught you.</div>
          )}
        </>
      );
    }
    if (current === 'how') {
      const max = Math.max(1, ...r.grades.map((g) => g.count));
      const colors = { A: GREEN, B: AMBER, C: RED, 'D/F': RED };
      return (
        <>
          <Chip color={DIM}>How you traded</Chip>
          <div style={{ width: '100%', marginTop: 30 }}>
            {r.grades.map((g) => (
              <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 28, fontFamily: MONO, fontSize: 13, color: DIM }}>{g.label}</div>
                <div style={{ flex: 1, height: 10, background: '#171b21', borderRadius: 99 }}>
                  <div style={{ width: `${(g.count / max) * 100}%`, height: '100%', background: colors[g.label], borderRadius: 99 }} />
                </div>
                <div style={{ width: 26, textAlign: 'right', fontFamily: MONO, fontSize: 13, color: '#d6d9df' }}>{g.count}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 16 }}>
            {r.topSetup && (
              <div style={{ flex: 1, border: '1px solid #232933', borderRadius: 12, padding: 12, textAlign: 'left' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.07em', color: DIM }}>TOP SETUP</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginTop: 6 }}>{r.topSetup.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: r.topSetup.pnl >= 0 ? GREEN : RED, marginTop: 4 }}>{money(r.topSetup.pnl, { sign: true })}</div>
              </div>
            )}
            {r.topSession && (
              <div style={{ flex: 1, border: '1px solid #232933', borderRadius: 12, padding: 12, textAlign: 'left' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.07em', color: DIM }}>TOP SESSION</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginTop: 6 }}>{r.topSession.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: r.topSession.pnl >= 0 ? GREEN : RED, marginTop: 4 }}>{money(r.topSession.pnl, { sign: true })}</div>
              </div>
            )}
          </div>
        </>
      );
    }
    if (current === 'breakdown') {
      return (
        <>
          <Chip>Your breakdown</Chip>
          <div style={{ width: '100%', textAlign: 'left', marginTop: 24 }}>
            {r.breakdown.map((b) => (
              <div key={b.title} style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.07em', color: GREEN, textTransform: 'uppercase' }}>{b.title}</div>
                <div style={{ fontSize: 13.5, color: '#c3c8d2', lineHeight: 1.5, marginTop: 5 }}>{b.text}</div>
              </div>
            ))}
          </div>
        </>
      );
    }
    // share slide
    return (
      <>
        <Chip>Share your month</Chip>
        <div style={{ width: '100%', marginTop: 18 }}><ShareCardPreview r={r} /></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18 }}>
          <button
            type="button"
            onClick={() => shareOrDownload(canvasRef.current, r)}
            style={{
              pointerEvents: 'auto', background: GREEN, color: '#04210f', border: 'none',
              borderRadius: 12, padding: '12px 28px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >↑ Share</button>
          <button
            type="button" onClick={onClose}
            style={{ pointerEvents: 'auto', background: 'transparent', color: DIM, border: 'none', fontFamily: MONO, letterSpacing: '.07em', fontSize: 13, cursor: 'pointer', padding: '12px 14px' }}
          >DONE</button>
          <button
            type="button" onClick={() => setI(0)}
            style={{ pointerEvents: 'auto', background: 'transparent', color: '#5d6572', border: 'none', fontSize: 13, cursor: 'pointer', padding: '12px 6px' }}
          >↺</button>
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>
      <style>{`
        @keyframes mirFill { from { width: 0% } to { width: 100% } }
        @keyframes mirIn { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
      `}</style>

      <div style={{
        position: 'relative', width: 'min(420px, 100vw)', height: 'min(780px, 100dvh)',
        background: CARD, borderRadius: 24, overflow: 'hidden', border: '1px solid #1b212a',
      }}>
        {/* progress bars */}
        <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', gap: 5, zIndex: 3 }}>
          {slides.map((s, idx) => (
            <div key={s} style={{ flex: 1, height: 3, background: '#232933', borderRadius: 99, overflow: 'hidden' }}>
              <div
                key={idx === i ? 'active-' + i : idx}
                onAnimationEnd={idx === i && !isLast ? next : undefined}
                style={{
                  height: '100%', background: '#d6d9df',
                  width: idx < i || (idx === i && (isLast || !duration)) ? '100%' : '0%',
                  animation: idx === i && !isLast && duration ? `mirFill ${duration}ms linear forwards` : 'none',
                }}
              />
            </div>
          ))}
        </div>

        <button
          type="button" onClick={onClose} aria-label="Close"
          style={{ position: 'absolute', top: 24, right: 14, zIndex: 4, background: 'transparent', border: 'none', color: DIM, fontSize: 22, cursor: 'pointer' }}
        >×</button>

        {/* tap zones: left = back, right = forward */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 1 }}>
          <div style={{ flex: 1 }} onClick={prev} />
          <div style={{ flex: 2 }} onClick={() => (isLast ? null : next())} />
        </div>

        {/* slide content */}
        <div
          key={current}
          style={{
            position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '52px 24px 36px', animation: 'mirIn .45s ease both',
            overflowY: 'auto',
          }}
        >
          {renderSlide()}
        </div>

        {!isLast && (
          <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontSize: 11, letterSpacing: '.07em', color: '#4b5361', zIndex: 2, pointerEvents: 'none' }}>
            TAP TO CONTINUE
          </div>
        )}
      </div>
    </div>
  );
}
