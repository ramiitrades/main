'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Chart from 'chart.js/auto';
import { createClient } from '../../lib/supabaseClient';

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
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), symbol: '', pnl: '', notes: '', account_id: '' });

  const radarRef = useRef(null); const lineRef = useRef(null); const barRef = useRef(null);
  const radarChart = useRef(null); const lineChart = useRef(null); const barChart = useRef(null);

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

  // ---- Derived stats, recomputed whenever trades change ----
  const stats = (() => {
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

    let streak = 0;
    for (let i = dayTotals.length - 1; i >= 0; i--) { if (dayTotals[i] > 0) streak++; else break; }

    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const weekdayKeys = dayKeys.filter(k => new Date(k + 'T00:00:00') >= startOfWeek);
    const businessDaysSoFar = Math.min(now.getDay() === 0 ? 7 : now.getDay(), 5) || 1;
    const adherence = Math.min(100, Math.round((weekdayKeys.length / businessDaysSoFar) * 100));

    let running = 0;
    const cumulative = dayTotals.map(v => running += v);
    let peak = -Infinity, maxDD = 0;
    cumulative.forEach(v => { peak = Math.max(peak, v); maxDD = Math.max(maxDD, peak - v); });

    const mean = dayTotals.reduce((s, v) => s + v, 0) / dayTotals.length;
    const variance = dayTotals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dayTotals.length;
    const stdDev = Math.sqrt(variance);
    const consistency = mean !== 0 ? Math.max(0, Math.min(100, 100 - (stdDev / Math.abs(mean)) * 25)) : 50;

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
    };
  })();

  // ---- Charts ----
  useEffect(() => {
    if (loading || !stats) return;
    if (radarChart.current) radarChart.current.destroy();
    if (lineChart.current) lineChart.current.destroy();
    if (barChart.current) barChart.current.destroy();

    radarChart.current = new Chart(radarRef.current, {
      type: 'radar',
      data: {
        labels: ['Win %', 'Profit factor', 'Avg win/loss', 'Recovery', 'Max drawdown', 'Consistency'],
        datasets: [{ data: stats.radarVals, backgroundColor: 'rgba(255,255,255,.12)', borderColor: '#e8e8e8', pointBackgroundColor: '#ffffff', borderWidth: 2 }]
      },
      options: { plugins: { legend: { display: false } }, scales: { r: { grid: { color: '#1b212a' }, angleLines: { color: '#1b212a' }, pointLabels: { color: '#8b93a3', font: { size: 10.5 } }, ticks: { display: false }, suggestedMin: 0, suggestedMax: 100 } } }
    });

    lineChart.current = new Chart(lineRef.current, {
      type: 'line',
      data: { labels: stats.dayKeys.map(k => k.slice(5)), datasets: [{ data: stats.cumulative, borderColor: '#3ecf8e',
        backgroundColor: (c) => { const g = c.chart.ctx.createLinearGradient(0,0,0,200); g.addColorStop(0,'rgba(62,207,142,.35)'); g.addColorStop(1,'rgba(62,207,142,0)'); return g; },
        fill: true, tension: .35, pointRadius: 0, borderWidth: 2 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#1b212a' } } } }
    });

    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: { labels: stats.dayKeys.map(k => k.slice(5)), datasets: [{ data: stats.dayTotals, backgroundColor: (c) => c.raw < 0 ? '#f2555a' : '#3ecf8e', borderRadius: 3 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#1b212a' } } } }
    });
  }, [stats, loading]);

  function shiftMonth(dir) {
    const d = new Date(calDate); d.setMonth(d.getMonth() + dir); setCalDate(d);
  }

  function renderCalendarCells() {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const byDay = stats?.byDay || {};

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
      row.forEach((cellData, colIdx) => {
        if (!cellData) {
          cells.push(<div key={rowIdx+'-'+colIdx} className="cal-cell empty"></div>);
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
          body = <div className="cal-meta">{dayTrades.length} trade{dayTrades.length===1?'':'s'} · {winPct}%</div>;
        }
        cells.push(
          <div key={rowIdx+'-'+colIdx} className={cls}>
            <span className="cal-daynum">{cellData.day}</span>
            {body}
          </div>
        );
      });
    });

    return { cells, monthTotal };
  }

  if (loading) return <div className="content">Loading your journal…</div>;

  const { cells, monthTotal } = renderCalendarCells();

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <strong style={{fontFamily:'var(--serif)'}}>TRADER EDGE</strong>
          <a href="/dashboard" style={{color:'var(--gold-bright)', fontSize:13.5}}>Dashboard</a>
          <a href="/journal" style={{color:'var(--text-muted)', fontSize:13.5}}>Journal</a>
          <a href="/log-trade" style={{color:'var(--text-muted)', fontSize:13.5}}>Log trade</a>
        </div>
        <button className="del-btn" onClick={logOut}>Sign out</button>
      </div>

      <div className="content">
        <h1 style={{fontFamily:'var(--serif)', fontWeight:500, fontSize:28, marginBottom:4}}>
          Welcome back{user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ''}
        </h1>
        <p style={{color:'var(--text-dim)', marginBottom:24}}>{trades.length} trade{trades.length===1?'':'s'} on record</p>

        {!stats && (
          <div className="panel" style={{textAlign:'center', color:'var(--text-muted)'}}>
            No trades yet — log your first one below and every stat here will start calculating.
          </div>
        )}

        {stats && (
          <>
            <div className="stat-row">
              <div className="stat-card"><div className="stat-label">Net P&amp;L</div><div className={`stat-val ${stats.netPnl>=0?'green':'red'}`}>{fmt(stats.netPnl)}</div></div>
              <div className="stat-card"><div className="stat-label">Trade win %</div><div className="stat-val">{stats.winPct.toFixed(1)}%</div></div>
              <div className="stat-card"><div className="stat-label">Profit factor</div><div className="stat-val">{stats.profitFactor===Infinity?'∞':stats.profitFactor.toFixed(2)}</div></div>
              <div className="stat-card"><div className="stat-label">Day win %</div><div className="stat-val">{stats.dayWinPct.toFixed(1)}%</div></div>
              <div className="stat-card"><div className="stat-label">Avg win/loss</div><div className="stat-val" style={{fontSize:16}}>{fmt(stats.avgWin)} / -{fmt(stats.avgLoss).replace('-','')}</div></div>
            </div>

            <div className="streak-bar">
              <span>🔥 <b>{stats.streak}</b> plan-followed streak &nbsp;·&nbsp; <b>{stats.weekdayCount}</b> weekdays accounted for &nbsp;·&nbsp; <b>{stats.adherence}%</b> plan adherence</span>
            </div>

            <div className="panel-row">
              <div className="panel">
                <div className="panel-title">Edge score</div>
                <canvas ref={radarRef}></canvas>
                <div className="edge-score-num">{stats.edgeScore.toFixed(1)}</div>
                <div className="edge-slider-track"><div className="edge-slider-dot" style={{left: Math.min(100,Math.max(0,stats.edgeScore))+'%'}}></div></div>
                <div className="edge-scale"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
              </div>
              <div className="panel"><div className="panel-title">Daily net cumulative P&amp;L</div><canvas ref={lineRef}></canvas></div>
              <div className="panel"><div className="panel-title">Net daily P&amp;L</div><canvas ref={barRef}></canvas></div>
            </div>
          </>
        )}

        <div className="panel">
          <h3 style={{marginBottom:14, fontFamily:'var(--serif)'}}>Log a trade</h3>
          <form onSubmit={addTrade} style={{display:'grid', gridTemplateColumns:'repeat(5,1fr) auto', gap:10, alignItems:'end'}}>
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

        <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:14}}>
          <div className="panel">
            <h3 style={{marginBottom:14, fontFamily:'var(--serif)'}}>Recent trades</h3>
            <table>
              <thead><tr><th>Date</th><th>Symbol</th><th style={{textAlign:'right'}}>Net P&amp;L</th><th></th></tr></thead>
              <tbody>
                {trades.length === 0 && <tr><td colSpan={4} style={{textAlign:'center', color:'var(--text-dim)', padding:'24px 0'}}>No trades yet.</td></tr>}
                {trades.slice(0,8).map(t => (
                  <tr key={t.id}>
                    <td>{t.trade_date}</td><td>{t.symbol}</td>
                    <td style={{textAlign:'right', color: t.pnl>=0?'var(--green)':'var(--red)', fontFamily:'var(--mono)'}}>{t.pnl>=0?'':'-'}${Math.abs(t.pnl).toLocaleString()}</td>
                    <td style={{textAlign:'right'}}><button className="del-btn" onClick={()=>deleteTrade(t.id)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cal-panel">
            <div className="cal-head">
              <span><button className="del-btn" onClick={()=>shiftMonth(-1)}>‹</button> {calDate.toLocaleDateString(undefined,{month:'long', year:'numeric'})} <button className="del-btn" onClick={()=>shiftMonth(1)}>›</button></span>
              <span style={{fontFamily:'var(--mono)', fontWeight:600, color: monthTotal>=0?'var(--green)':'var(--red)'}}>{fmt(monthTotal)}</span>
            </div>
            <div className="cal-grid">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="cal-dow">{d}</div>)}
              {cells}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
