'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), symbol: '', pnl: '', notes: '', account_id: '' });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    await ensureDefaultAccount(user.id);
    await Promise.all([loadTrades(user.id), loadAccounts(user.id)]);
    setLoading(false);
  }

  async function ensureDefaultAccount(userId) {
    const { data } = await supabase.from('accounts').select('id').eq('user_id', userId).limit(1);
    if (!data || data.length === 0) {
      await supabase.from('accounts').insert({ user_id: userId, name: 'Main Account', starting_balance: 50000 });
    }
  }

  async function loadTrades(userId) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('trade_date', { ascending: false });
    if (!error) setTrades(data || []);
  }

  async function loadAccounts(userId) {
    const { data, error } = await supabase.from('accounts').select('*').eq('user_id', userId);
    if (!error) {
      setAccounts(data || []);
      if (data && data.length > 0) setForm(f => ({ ...f, account_id: f.account_id || data[0].id }));
    }
  }

  async function addTrade(e) {
    e.preventDefault();
    const pnl = parseFloat(form.pnl);
    if (!form.symbol || isNaN(pnl)) { alert('Enter a symbol and a numeric P&L.'); return; }
    const { error } = await supabase.from('trades').insert({
      user_id: user.id,
      account_id: form.account_id || null,
      trade_date: form.date,
      symbol: form.symbol.toUpperCase(),
      pnl,
      notes: form.notes,
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

  if (loading) return <div className="content">Loading your journal…</div>;

  const netPnl = trades.reduce((s, t) => s + Number(t.pnl), 0);
  const wins = trades.filter(t => t.pnl > 0);
  const winPct = trades.length ? (wins.length / trades.length * 100) : 0;
  const startingTotal = accounts.reduce((s, a) => s + Number(a.starting_balance || 0), 0);

  return (
    <div>
      <div className="topbar">
        <strong style={{fontFamily:'var(--serif)'}}>TRADER EDGE</strong>
        <button className="del-btn" onClick={logOut}>Sign out</button>
      </div>

      <div className="content">
        <h1 style={{fontFamily:'var(--serif)', fontWeight:500, fontSize:28, marginBottom:4}}>
          Welcome back{user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ''}
        </h1>
        <p style={{color:'var(--text-dim)', marginBottom:24}}>{trades.length} trade{trades.length===1?'':'s'} on record</p>

        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">Net P&amp;L</div>
            <div className={`stat-val ${netPnl>=0?'green':'red'}`}>${netPnl.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Trade win %</div>
            <div className="stat-val">{winPct.toFixed(1)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Account balance</div>
            <div className={`stat-val ${(startingTotal+netPnl)>=startingTotal?'green':'red'}`}>
              ${(startingTotal+netPnl).toLocaleString(undefined,{maximumFractionDigits:0})}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Accounts</div>
            <div className="stat-val">{accounts.length}</div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{marginBottom:14, fontFamily:'var(--serif)'}}>Log a trade</h3>
          <form onSubmit={addTrade} style={{display:'grid', gridTemplateColumns:'repeat(5,1fr) auto', gap:10, alignItems:'end'}}>
            <div className="field" style={{margin:0}}>
              <label>Date</label>
              <input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
            </div>
            <div className="field" style={{margin:0}}>
              <label>Symbol</label>
              <input type="text" placeholder="MGC" value={form.symbol} onChange={e=>setForm({...form, symbol:e.target.value})} />
            </div>
            <div className="field" style={{margin:0}}>
              <label>Account</label>
              <select value={form.account_id} onChange={e=>setForm({...form, account_id:e.target.value})}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field" style={{margin:0}}>
              <label>Net P&amp;L</label>
              <input type="number" step="0.01" placeholder="640" value={form.pnl} onChange={e=>setForm({...form, pnl:e.target.value})} />
            </div>
            <div className="field" style={{margin:0}}>
              <label>Notes</label>
              <input type="text" placeholder="Optional" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} />
            </div>
            <button className="add-btn" type="submit">Save</button>
          </form>
        </div>

        <div className="panel">
          <h3 style={{marginBottom:14, fontFamily:'var(--serif)'}}>Recent trades</h3>
          <table>
            <thead><tr><th>Date</th><th>Symbol</th><th style={{textAlign:'right'}}>Net P&amp;L</th><th></th></tr></thead>
            <tbody>
              {trades.length === 0 && <tr><td colSpan={4} style={{textAlign:'center', color:'var(--text-dim)', padding:'24px 0'}}>No trades yet — log your first one above.</td></tr>}
              {trades.map(t => (
                <tr key={t.id}>
                  <td>{t.trade_date}</td>
                  <td>{t.symbol}</td>
                  <td style={{textAlign:'right', color: t.pnl>=0?'var(--green)':'var(--red)', fontFamily:'var(--mono)'}}>
                    {t.pnl>=0?'':'-'}${Math.abs(t.pnl).toLocaleString()}
                  </td>
                  <td style={{textAlign:'right'}}><button className="del-btn" onClick={()=>deleteTrade(t.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
