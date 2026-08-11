'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

function fmt(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function Journal() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    await Promise.all([loadTrades(user.id), loadAccounts(user.id)]);
    setLoading(false);
  }

  async function loadTrades(userId) {
    const { data } = await supabase.from('trades').select('*').eq('user_id', userId).order('trade_date', { ascending: false });
    setTrades(data || []);
  }

  async function loadAccounts(userId) {
    const { data } = await supabase.from('accounts').select('*').eq('user_id', userId);
    setAccounts(data || []);
  }

  function accountName(id) {
    const a = accounts.find(x => x.id === id);
    return a ? a.name : '—';
  }

  async function saveNote(id, notes) {
    setSavingId(id);
    await supabase.from('trades').update({ notes }).eq('id', id);
    setSavingId(null);
  }

  async function deleteTrade(id) {
    if (!confirm('Delete this trade?')) return;
    await supabase.from('trades').delete().eq('id', id);
    setTrades(trades.filter(t => t.id !== id));
  }

  function updateLocalNote(id, notes) {
    setTrades(trades.map(t => t.id === id ? { ...t, notes } : t));
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) return <div className="content">Loading your journal…</div>;

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <strong style={{fontFamily:'var(--serif)'}}>TRADER EDGE</strong>
          <a href="/dashboard" style={{color:'var(--text-muted)', fontSize:13.5}}>Dashboard</a>
          <a href="/journal" style={{color:'var(--gold-bright)', fontSize:13.5}}>Journal</a>
        </div>
        <button className="del-btn" onClick={logOut}>Sign out</button>
      </div>

      <div className="content">
        <h1 style={{fontFamily:'var(--serif)', fontWeight:500, fontSize:28, marginBottom:4}}>Journal</h1>
        <p style={{color:'var(--text-dim)', marginBottom:24}}>Every trade, with the notes you left yourself.</p>

        <div className="panel" style={{padding:0, overflow:'hidden'}}>
          <table>
            <thead>
              <tr>
                <th style={{padding:'12px 20px'}}>Date</th>
                <th style={{padding:'12px 20px'}}>Symbol</th>
                <th style={{padding:'12px 20px'}}>Account</th>
                <th style={{padding:'12px 20px', textAlign:'right'}}>Net P&amp;L</th>
                <th style={{padding:'12px 20px'}}>Note</th>
                <th style={{padding:'12px 20px'}}></th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && (
                <tr><td colSpan={6} style={{textAlign:'center', color:'var(--text-dim)', padding:30}}>No trades logged yet.</td></tr>
              )}
              {trades.map(t => (
                <tr key={t.id}>
                  <td style={{padding:'12px 20px', fontFamily:'var(--mono)'}}>{t.trade_date}</td>
                  <td style={{padding:'12px 20px'}}>{t.symbol}</td>
                  <td style={{padding:'12px 20px'}}>{accountName(t.account_id)}</td>
                  <td style={{padding:'12px 20px', textAlign:'right', fontFamily:'var(--mono)', fontWeight:600, color: t.pnl>=0?'var(--green)':'var(--red)'}}>
                    {fmt(t.pnl)}
                  </td>
                  <td style={{padding:'12px 20px'}}>
                    <input
                      type="text"
                      value={t.notes || ''}
                      placeholder="Add a note…"
                      onChange={e => updateLocalNote(t.id, e.target.value)}
                      onBlur={e => saveNote(t.id, e.target.value)}
                      style={{
                        width:'100%', background:'var(--bg-alt)', border:'1px solid var(--border)',
                        borderRadius:6, color:'var(--text)', padding:'7px 10px', fontSize:13
                      }}
                    />
                    {savingId === t.id && <span style={{fontSize:11, color:'var(--text-dim)', marginLeft:8}}>saving…</span>}
                  </td>
                  <td style={{padding:'12px 20px', textAlign:'right'}}>
                    <button className="del-btn" onClick={() => deleteTrade(t.id)} title="Delete trade">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
