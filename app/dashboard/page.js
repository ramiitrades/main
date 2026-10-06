'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Chart from 'chart.js/auto';
import { createClient } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import RangeToggle, { useRangeFilter, rangeLabel } from '../../components/RangeFilter';
import MonthInReview from '../../components/MonthInReview';


// Cleaner dashboard look. Scoped to .dash-clean so other pages are untouched.
const DASH_CSS = `
.dash-clean { --dc-border: rgba(255,255,255,.07); --dc-dim: var(--text-dim, #6b7280); }

.dash-clean .dash-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:22px; }
.dash-clean .dash-toolbar .toggle-row { margin-bottom:0 !important; }
.dash-clean .toggle-btn { font-size:13px; font-weight:500; padding:8px 16px; border-radius:8px; letter-spacing:.01em; }
.dash-clean .toolbar-right { display:flex; flex-wrap:wrap; gap:8px; margin-left:auto; }
.dash-clean .review-btn, .dash-clean .privacy-btn:not(.active) { color:var(--text-muted, #9aa1ad); }

.dash-clean .stat-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:12px; margin-bottom:12px; }
.dash-clean .stat-card { border:1px solid var(--dc-border); border-radius:14px; padding:18px 20px; }
.dash-clean .stat-label { font-size:11.5px; font-weight:500; letter-spacing:.07em; text-transform:uppercase; color:var(--dc-dim); margin-bottom:10px; }
.dash-clean .stat-val { font-family:inherit; font-size:26px; font-weight:600; letter-spacing:-.02em; line-height:1.1; font-variant-numeric:tabular-nums; }
.dash-clean .stat-val.green { color:var(--green, #6fcf97); }
.dash-clean .stat-val.red { color:var(--red, #f2555a); }

.dash-clean .streak-bar { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); padding:0; border:1px solid var(--dc-border); border-radius:14px; margin-bottom:12px; overflow:hidden; }
.dash-clean .streak-item { padding:16px 20px; border-left:1px solid var(--dc-border); display:flex; flex-direction:column; justify-content:space-between; gap:8px; }
.dash-clean .streak-item:first-child { border-left:0; }
.dash-clean .streak-label { font-size:11.5px; font-weight:500; letter-spacing:.07em; text-transform:uppercase; color:var(--dc-dim); }
.dash-clean .streak-num { font-size:20px; font-weight:600; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }

.dash-clean .panel, .dash-clean .cal-panel { border:1px solid var(--dc-border); border-radius:14px; }
.dash-clean .panel { padding:20px 22px; }
.dash-clean .panel-title { font-family:inherit; font-size:11.5px; font-weight:500; letter-spacing:.07em; text-transform:uppercase; color:var(--dc-dim); margin-bottom:16px; }

.dash-clean .edge-score-num { font-family:inherit; font-size:44px; font-weight:600; letter-spacing:-.03em; line-height:1; margin:18px 0 14px; font-variant-numeric:tabular-nums; }
.dash-clean .edge-score-max { font-size:15px; font-weight:500; letter-spacing:0; color:var(--dc-dim); margin-left:6px; }
.dash-clean .edge-slider-track { height:4px; border-radius:99px; }
.dash-clean .edge-scale { font-family:inherit; font-size:11px; color:var(--dc-dim); font-variant-numeric:tabular-nums; }

.dash-clean table { width:100%; border-collapse:collapse; }
.dash-clean th { font-size:11px; font-weight:500; letter-spacing:.07em; text-transform:uppercase; color:var(--dc-dim); text-align:left; padding:0 10px 10px; border-bottom:1px solid var(--dc-border); }
.dash-clean td { font-size:13.5px; padding:11px 10px; border-bottom:1px solid rgba(255,255,255,.04); font-variant-numeric:tabular-nums; }
.dash-clean tr:last-child td { border-bottom:0; }
.dash-clean th:first-child, .dash-clean td:first-child { padding-left:0; }
.dash-clean th:last-child, .dash-clean td:last-child { padding-right:0; }

.dash-clean .cal-head { font-size:14px; font-weight:500; }
.dash-clean .cal-dow { font-size:10.5px; font-weight:500; letter-spacing:.07em; text-transform:uppercase; color:var(--dc-dim); }

@media (max-width: 640px) {
  .dash-clean .dash-toolbar { flex-direction:column; align-items:stretch; gap:10px; margin-bottom:18px; }
  .dash-clean .dash-toolbar .toggle-row { display:flex; width:100%; }
  .dash-clean .dash-toolbar .toggle-row .toggle-btn { flex:1; text-align:center; }
  .dash-clean .toolbar-right { margin-left:0; width:100%; flex-wrap:nowrap; gap:10px; }
  .dash-clean .toolbar-right .toggle-btn { flex:1 1 0; min-width:0; padding:10px 8px; font-size:12.5px; text-align:center; }

  .dash-clean .stat-row { grid-template-columns:repeat(2, minmax(0, 1fr)) !important; gap:10px; }
  .dash-clean .stat-row .stat-card:last-child:nth-child(odd) { grid-column:1 / -1; }
  .dash-clean .stat-card { padding:16px; }
  .dash-clean .stat-val { font-size:24px; }

  .dash-clean .streak-bar { grid-template-columns:1fr; }
  .dash-clean .streak-item { flex-direction:row; align-items:center; justify-content:space-between; border-left:0; border-top:1px solid var(--dc-border); padding:14px 18px; }
  .dash-clean .streak-item:first-child { border-top:0; }

  .dash-clean .panel { padding:18px; }
}
`;

function fmt(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calDate, setCalDate] = useState(new Date());
  const [showReview, setShowReview] = useState(false);
  // Privacy mode: hides every dollar amount, keeps all the other stats. Remembered on this device.
  const [hideMoney, setHideMoney] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('te_hide_money') === '1'; } catch (e) { return false; }
  });
  const showMoney = (n) => (hideMoney ? '$•••' : fmt(n));
  function toggleHideMoney() {
    setHideMoney((v) => {
      const next = !v;
      try { localStorage.setItem('te_hide_money', next ? '1' : '0'); } catch (e) { /* ignore */ }
      return next;
    });
  }
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), symbol: '', pnl: '', notes: '', account_id: '' });

  // Week / Month / All time filter for the stats and charts
  const { range, setRange, filteredTrades } = useRangeFilter(trades);

  const radarRef = useRef(null); const lineRef = useRef(null);
  const radarChart = useRef(null); const lineChart = useRef(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    await ensureDefaultAccount(user.id);
    const [t, a] = await Promise.all([loadTrades(user.id), loadAccounts(user.id)]);
    setLoading(false);
  }

  async function ensureDefaultAccount(userId) {
    const { data } = await supabase.from('accounts').select('id').eq('user_id', userId).limit(1);
    if (!data || data.length === 0) {
      await supabase.from('accounts').insert({ user_id: userId, name: 'Main Account', starting_balance: 50000 });
    }
  }

  async function loadTrades(userId) {
    const { data } = await supabase.from('trades').select('*').eq('user_id', userId).order('trade_date', { ascending: false });
    setTrades(data || []);
    return data || [];
  }

  async function loadAccounts(userId) {
    const { data } = await supabase.from('accounts').select('*').eq('user_id', userId);
    setAccounts(data || []);
    if (data && data.length > 0) setForm(f => ({ ...f, account_id: f.account_id || data[0].id }));
    return data || [];
  }

  async function addTrade(e) {
    e.preventDefault();
    const pnl = parseFloat(form.pnl);
    if (!form.symbol || isNaN(pnl)) { alert('Enter a symbol and a numeric P&L.'); return; }
    const { error } = await supabase.from('trades').insert({
      user_id: user.id, account_id: form.account_id || null,
      trade_date: form.date, symbol: form.symbol.toUpperCase(), pnl, notes: form.notes,
    });
    if (error) { alert(error.message); return; }
    setForm(f => ({ ...f, symbol: '', pnl: '', notes: '' }));
    loadTrades(user.id);
  }

  async function deleteTrade(id) {
    await supabase.from('trades').delete().eq('id', id);
    loadTrades(user.id);
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // ---- Derived stats, recomputed whenever the filtered trades change ----
  // (the parameter below is named `trades` on purpose so the math inside stays the same)
  const stats = ((trades) => {
    if (trades.length === 0) return null;
    const netPnl = trades.reduce((s, t) => s + Number(t.pnl), 0);
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const winPct = trades.length ? (wins.length / trades.length * 100) : 0;
    const sumWins = wins.reduce((s, t) => s + Number(t.pnl), 0);
    const sumLosses = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0));
    const profitFactor = sumLosses > 0 ? (sumWins / sumLosses) : (sumWins > 0 ? Infinity : 0);
    const avgWin = wins.length ? sumWins / wins.length : 0;
    const avgLoss = losses.length ? sumLosses / losses.length : 0;

    const byDay = {};
    trades.forEach(t => { (byDay[t.trade_date] = byDay[t.trade_date] || []).push(t); });
    const dayKeys = Object.keys(byDay).sort();
    const dayTotals = dayKeys.map(k => byDay[k].reduce((s, t) => s + Number(t.pnl), 0));
    const winDays = dayTotals.filter(v => v > 0).length;
    const dayWinPct = dayKeys.length ? (winDays / dayKeys.length * 100) : 0;

    // Plan-followed streak + adherence use the "Followed plan?" answer saved on each trade.
    // A trade with no answer saved counts as followed (same default as the Log trade form).
    const realTrades = trades
      .filter(t => !t.no_trade_day)
      .sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const followed = (t) => t.followed_plan !== false;
    let streak = 0;
    for (let i = realTrades.length - 1; i >= 0; i--) { if (followed(realTrades[i])) streak++; else break; }
    const adherence = realTrades.length ? Math.round((realTrades.filter(followed).length / realTrades.length) * 100) : null;

    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const weekdayKeys = dayKeys.filter(k => new Date(k + 'T00:00:00') >= startOfWeek);

    let running = 0;
    const cumulative = dayTotals.map(v => running += v);
    let peak = -Infinity, maxDD = 0;
    cumulative.forEach(v => { peak = Math.max(peak, v); maxDD = Math.max(maxDD, peak - v); });

    const mean = dayTotals.reduce((s, v) => s + v, 0) / dayTotals.length;
    const variance = dayTotals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dayTotals.length;
    const stdDev = Math.sqrt(variance);
    const consistency = mean !== 0 ? Math.max(0, Math.min(100, 100 - (stdDev / Math.abs(mean)) * 25)) : 50;

    // Which rules you break, and how each entry model performs.
    // Old trades with "Followed plan? No" but no rule picked count as "Other".
    const OTHER_RULE = 'Other (not in my rules)';
    const brokenOf = (t) => {
      if (Array.isArray(t.rules_broken) && t.rules_broken.length) return t.rules_broken;
      return t.followed_plan === false ? [OTHER_RULE] : [];
    };
    const ruleMap = {};
    realTrades.forEach(t => brokenOf(t).forEach(r => {
      ruleMap[r] = ruleMap[r] || { name: r, count: 0, pnl: 0 };
      ruleMap[r].count += 1;
      ruleMap[r].pnl += Number(t.pnl) || 0;
    }));
    const ruleStats = Object.values(ruleMap).sort((a, b) => b.count - a.count || a.pnl - b.pnl);
    const avgOf = (arr) => arr.length ? arr.reduce((s, t) => s + (Number(t.pnl) || 0), 0) / arr.length : null;
    const keptAvg = avgOf(realTrades.filter(t => brokenOf(t).length === 0));
    const brokeAvg = avgOf(realTrades.filter(t => brokenOf(t).length > 0));

    const modelMap = {};
    realTrades.forEach(t => {
      const name = (t.setup || '').trim() || 'No model';
      const m = (modelMap[name] = modelMap[name] || { name, count: 0, wins: 0, pnl: 0 });
      m.count += 1;
      if ((Number(t.pnl) || 0) > 0) m.wins += 1;
      m.pnl += Number(t.pnl) || 0;
    });
    const modelStats = Object.values(modelMap)
      .map(m => ({ ...m, winPct: Math.round((m.wins / m.count) * 100) }))
      .sort((a, b) => b.pnl - a.pnl);

    const startingTotal = accounts.reduce((s, a) => s + Number(a.starting_balance || 0), 0) || 50000;
    const winScore = Math.min(100, winPct);
    const pfScore = profitFactor === Infinity ? 100 : Math.min(100, profitFactor * 25);
    const avgWLScore = avgLoss > 0 ? Math.min(100, (avgWin / avgLoss) * 30) : (avgWin > 0 ? 100 : 0);
    const recoveryScore = maxDD > 0 ? Math.min(100, (netPnl / maxDD) * 20) : (netPnl > 0 ? 100 : 50);
    const ddScore = Math.max(0, 100 - Math.min(100, (maxDD / startingTotal) * 100));
    const edgeScore = (winScore + pfScore + avgWLScore + recoveryScore + ddScore + consistency) / 6;

    return {
      netPnl, winPct, profitFactor, avgWin, avgLoss, dayWinPct, streak,
      weekdayCount: weekdayKeys.length, adherence, dayKeys, dayTotals, cumulative,
      edgeScore, radarVals: [winScore, pfScore, avgWLScore, recoveryScore, ddScore, consistency],
      startingTotal, byDay,
      ruleStats, keptAvg, brokeAvg, modelStats, planTradeCount: realTrades.length,
    };
  })(filteredTrades);

  // The calendar always shows ALL trades, so you can browse any month
  // no matter which range is selected for the stats.
  const allByDay = {};
  trades.forEach(t => { (allByDay[t.trade_date] = allByDay[t.trade_date] || []).push(t); });

  // ---- Charts ----
  useEffect(() => {
    if (loading || !stats) return;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#6b7280';
    if (radarChart.current) radarChart.current.destroy();
    if (lineChart.current) lineChart.current.destroy();

    radarChart.current = new Chart(radarRef.current, {
      type: 'radar',
      data: {
        labels: ['Win %', 'Profit factor', 'Avg win/loss', 'Recovery', 'Max drawdown', 'Consistency'],
        datasets: [{ data: stats.radarVals, backgroundColor: 'rgba(255,255,255,.12)', borderColor: '#e8e8e8', pointBackgroundColor: '#ffffff', borderWidth: 2 }]
      },
      options: { plugins: { legend: { display: false } }, scales: { r: { grid: { color: 'rgba(255,255,255,.06)' }, angleLines: { color: 'rgba(255,255,255,.06)' }, pointLabels: { color: '#8b93a3', font: { size: 11 } }, ticks: { display: false }, suggestedMin: 0, suggestedMax: 100 } } }
    });

    lineChart.current = new Chart(lineRef.current, {
      type: 'line',
      data: { labels: stats.dayKeys.map(k => k.slice(5)), datasets: [{ data: stats.cumulative, borderColor: '#3ecf8e',
        backgroundColor: (c) => { const g = c.chart.ctx.createLinearGradient(0,0,0,200); g.addColorStop(0,'rgba(62,207,142,.35)'); g.addColorStop(1,'rgba(62,207,142,0)'); return g; },
        fill: true, tension: .35, pointRadius: 0, borderWidth: 2 }] },
      options: { plugins: { legend: { display: false }, tooltip: { enabled: !hideMoney } }, scales: { x: { grid: { display: false } }, y: { ticks: { display: !hideMoney }, grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false } } } }
    });
  }, [stats, loading, hideMoney]);

  function shiftMonth(dir) {
    const d = new Date(calDate); d.setMonth(d.getMonth() + dir); setCalDate(d);
  }

  function renderCalendarCells() {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const byDay = allByDay;

    const flat = [];
    for (let i = 0; i < firstDow; i++) flat.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      flat.push({ day: d, key: y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0') });
    }
    while (flat.length % 7 !== 0) flat.push(null);

    const rows = [];
    for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));

    let monthTotal = 0;
    const cells = [];

    rows.forEach((row, rowIdx) => {
      let weekTotal = 0, weekHasData = false;
      row.forEach(cellData => {
        if (cellData && byDay[cellData.key]) {
          weekTotal += byDay[cellData.key].reduce((s,t)=>s+Number(t.pnl),0);
          weekHasData = true;
        }
      });

      row.forEach((cellData, colIdx) => {
        const isSat = colIdx === 6;
        const weekBadge = isSat && weekHasData ? (
          <div className="cal-week-total" style={{color: weekTotal>=0?'var(--green-bright)':'var(--red)'}}>Wk {showMoney(weekTotal)}</div>
        ) : null;

        if (!cellData) {
          cells.push(<div key={rowIdx+'-'+colIdx} className="cal-cell empty">{weekBadge}</div>);
          return;
        }
        const dayTrades = byDay[cellData.key];
        let cls = 'cal-cell';
        let body = null;
        if (dayTrades && dayTrades.length) {
          const total = dayTrades.reduce((s,t)=>s+Number(t.pnl),0);
          monthTotal += total;
          const wins = dayTrades.filter(t=>t.pnl>0).length;
          const winPct = Math.round(wins/dayTrades.length*100);
          cls += total >= 0 ? ' win' : ' loss';
          const pnlText = (total >= 0 ? '+' : '') + showMoney(total);
          body = (
            <>
              <div className="cal-pnl-mini" style={{color: total>=0?'var(--green)':'var(--red)'}}>{pnlText}</div>
              <div className="cal-meta">{dayTrades.length} trade{dayTrades.length===1?'':'s'} · {winPct}%</div>
            </>
          );
        }
        cells.push(
          <div key={rowIdx+'-'+colIdx} className={cls}>
            <span className="cal-daynum">{cellData.day}</span>
            {body}
            {weekBadge}
          </div>
        );
      });
    });

    return { cells, monthTotal };
  }

  if (loading) return <div className="content">Loading your journal…</div>;

  const { cells, monthTotal } = renderCalendarCells();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
      <div className="content dash-clean">
        <style>{DASH_CSS}</style>
        <h1 style={{fontFamily:'var(--serif)', fontWeight:500, fontSize:28, marginBottom:4}}>
          Welcome back{user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ''}
        </h1>
        <p style={{color:'var(--text-dim)', marginBottom:16}}>{filteredTrades.length} trade{filteredTrades.length===1?'':'s'} {rangeLabel(range)}</p>

        <div className="dash-toolbar">
          <RangeToggle range={range} setRange={setRange} />
          <div className="toolbar-right">
            <button
              type="button"
              className={`toggle-btn privacy-btn ${hideMoney ? 'active' : ''}`}
              onClick={toggleHideMoney}
              title={hideMoney ? 'Dollar amounts are hidden. Click to show them.' : 'Hide dollar amounts so you can share your screen'}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'-2px', marginRight:7}}>
                {hideMoney
                  ? <><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.2" /></>
                  : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
              </svg>
              {hideMoney ? 'Earnings hidden' : 'Hide earnings'}
            </button>
            <button type="button" className="toggle-btn review-btn" onClick={()=>setShowReview(true)}>
              {calDate.toLocaleDateString(undefined,{month:'long'})} in review →
            </button>
          </div>
        </div>

        {showReview && (
          <MonthInReview trades={trades} monthDate={calDate} hideMoney={hideMoney} onClose={()=>setShowReview(false)} />
        )}

        {!stats && (
          <div className="panel" style={{textAlign:'center', color:'var(--text-muted)'}}>
            {trades.length === 0
              ? 'No trades yet — log your first one below and every stat here will start calculating.'
              : `No trades ${rangeLabel(range)} yet.`}
          </div>
        )}

        {stats && (
          <>
            <div className="stat-row">
              <div className="stat-card"><div className="stat-label">Net P&amp;L</div><div className={`stat-val ${stats.netPnl>=0?'green':'red'}`}>{showMoney(stats.netPnl)}</div></div>
              <div className="stat-card"><div className="stat-label">Trade win %</div><div className="stat-val">{stats.winPct.toFixed(1)}%</div></div>
              <div className="stat-card"><div className="stat-label">Profit factor</div><div className="stat-val">{stats.profitFactor===Infinity?'∞':stats.profitFactor.toFixed(2)}</div></div>
              <div className="stat-card"><div className="stat-label">Day win %</div><div className="stat-val">{stats.dayWinPct.toFixed(1)}%</div></div>
              <div className="stat-card"><div className="stat-label">Avg win / loss</div><div className="stat-val" style={{fontSize:21}}><span style={{color:'var(--green, #6fcf97)'}}>{showMoney(stats.avgWin)}</span><span style={{color:'var(--text-dim, #6b7280)', fontWeight:400, margin:'0 6px'}}>/</span><span style={{color:'var(--red, #f2555a)'}}>{stats.avgLoss > 0 ? '-' + showMoney(stats.avgLoss).replace('-','') : '—'}</span></div></div>
            </div>

            <div className="streak-bar">
              <div className="streak-item"><span className="streak-label">Plan-followed streak</span><span className="streak-num">{stats.streak}</span></div>
              <div className="streak-item"><span className="streak-label">Weekdays logged this week</span><span className="streak-num">{stats.weekdayCount}</span></div>
              <div className="streak-item"><span className="streak-label">Plan adherence</span><span className="streak-num">{stats.adherence === null ? '—' : stats.adherence + '%'}</span></div>
            </div>

            <div className="panel-row">
              <div className="panel">
                <div className="panel-title">Edge score</div>
                <canvas ref={radarRef}></canvas>
                <div className="edge-score-num">{stats.edgeScore.toFixed(1)}<span className="edge-score-max">/ 100</span></div>
                <div className="edge-slider-track"><div className="edge-slider-dot" style={{left: Math.min(100,Math.max(0,stats.edgeScore))+'%'}}></div></div>
                <div className="edge-scale"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
              </div>
              <div className="panel"><div className="panel-title">Daily net cumulative P&amp;L</div><canvas ref={lineRef}></canvas></div>
            </div>

            <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14}}>
              <div className="panel">
                <div className="panel-title">Rules you break most</div>
                {stats.ruleStats.length === 0 ? (
                  <div style={{color:'var(--text-dim)', fontSize:13.5, padding:'6px 0'}}>No broken rules in this range. Keep it up.</div>
                ) : (
                  <>
                    {stats.ruleStats.map(r => (
                      <div key={r.name} style={{display:'flex', justifyContent:'space-between', gap:12, padding:'9px 0', borderBottom:'1px solid var(--border)'}}>
                        <div style={{fontSize:14}}>
                          {r.name}
                          <span style={{color:'var(--text-dim)', fontSize:12, marginLeft:8}}>{Math.round(r.count / stats.planTradeCount * 100)}% of trades</span>
                        </div>
                        <div style={{fontVariantNumeric:'tabular-nums', fontSize:12.5, whiteSpace:'nowrap', color: r.pnl>=0?'var(--green)':'var(--red)'}}>{r.count}× · {showMoney(r.pnl)}</div>
                      </div>
                    ))}
                    {stats.keptAvg !== null && stats.brokeAvg !== null && (
                      <div style={{color:'var(--text-muted)', fontSize:12.5, marginTop:12, lineHeight:1.5}}>
                        Average per trade when you followed your plan: <b>{showMoney(stats.keptAvg)}</b>. When you broke a rule: <b>{showMoney(stats.brokeAvg)}</b>.
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="panel">
                <div className="panel-title">Results by entry model</div>
                <table>
                  <thead><tr><th>Model</th><th style={{textAlign:'right'}}>Trades</th><th style={{textAlign:'right'}}>Win %</th><th style={{textAlign:'right'}}>Net P&amp;L</th></tr></thead>
                  <tbody>
                    {stats.modelStats.map(m => (
                      <tr key={m.name}>
                        <td>{m.name}</td>
                        <td style={{textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{m.count}</td>
                        <td style={{textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{m.winPct}%</td>
                        <td style={{textAlign:'right', fontVariantNumeric:'tabular-nums', color: m.pnl>=0?'var(--green)':'var(--red)'}}>{showMoney(m.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.modelStats.length === 1 && stats.modelStats[0].name === 'No model' && (
                  <div style={{color:'var(--text-dim)', fontSize:12.5, marginTop:10}}>Pick an entry model when you log a trade to see results by model here.</div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="panel">
          <div className="panel-title">Log a trade</div>
          <form onSubmit={addTrade} className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(5,1fr) auto', gap:10, alignItems:'end'}}>
            <div className="field" style={{margin:0}}><label>Date</label><input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /></div>
            <div className="field" style={{margin:0}}><label>Symbol</label><input type="text" placeholder="MGC" value={form.symbol} onChange={e=>setForm({...form, symbol:e.target.value})} /></div>
            <div className="field" style={{margin:0}}><label>Account</label>
              <select value={form.account_id} onChange={e=>setForm({...form, account_id:e.target.value})}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field" style={{margin:0}}><label>Net P&amp;L</label><input type="number" step="0.01" placeholder="640" value={form.pnl} onChange={e=>setForm({...form, pnl:e.target.value})} /></div>
            <div className="field" style={{margin:0}}><label>Notes</label><input type="text" placeholder="Optional" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} /></div>
            <button className="add-btn" type="submit">Save</button>
          </form>
        </div>

        <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:14}}>
          <div className="panel">
            <div className="panel-title">Recent trades</div>
            <table>
              <thead><tr><th>Date</th><th>Symbol</th><th style={{textAlign:'right'}}>Net P&amp;L</th><th></th></tr></thead>
              <tbody>
                {trades.length === 0 && <tr><td colSpan={4} style={{textAlign:'center', color:'var(--text-dim)', padding:'24px 0'}}>No trades yet.</td></tr>}
                {trades.slice(0,8).map(t => (
                  <tr key={t.id}>
                    <td>{t.trade_date}</td><td>{t.symbol}</td>
                    <td style={{textAlign:'right', color: t.pnl>=0?'var(--green)':'var(--red)', fontVariantNumeric:'tabular-nums'}}>{hideMoney ? '$•••' : (t.pnl>=0?'':'-') + '$' + Math.abs(t.pnl).toLocaleString()}</td>
                    <td style={{textAlign:'right'}}><button className="del-btn" onClick={()=>deleteTrade(t.id)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cal-panel">
            <div className="cal-head">
              <span><button className="del-btn" onClick={()=>shiftMonth(-1)}>‹</button> {calDate.toLocaleDateString(undefined,{month:'long', year:'numeric'})} <button className="del-btn" onClick={()=>shiftMonth(1)}>›</button></span>
              <span style={{fontVariantNumeric:'tabular-nums', fontWeight:600, color: monthTotal>=0?'var(--green)':'var(--red)'}}>{showMoney(monthTotal)}</span>
            </div>
            <div className="cal-grid">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="cal-dow">{d}</div>)}
              {cells}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
