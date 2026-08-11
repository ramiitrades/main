'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';

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

  const [fGrade, setFGrade] = useState('All');
  const [fSession, setFSession] = useState('All');
  const [fResult, setFResult] = useState('All');
  const [fPlan, setFPlan] = useState('All');
  const [fMistake, setFMistake] = useState('All');

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

  async function deleteTrade(id) {
    if (!confirm('Delete this journal entry?')) return;
    await supabase.from('trades').delete().eq('id', id);
    setTrades(trades.filter(t => t.id !== id));
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const allMistakes = Array.from(new Set(trades.flatMap(t => t.mistakes || [])));

  const filtered = trades.filter(t => {
    if (fGrade !== 'All' && t.grade !== fGrade) return false;
    if (fSession !== 'All' && t.session !== fSession) return false;
    if (fResult !== 'All') {
      if (fResult === 'Win' && !(t.pnl > 0)) return false;
      if (fResult === 'Loss' && !(t.pnl < 0)) return false;
    }
    if (fPlan !== 'All') {
      if (fPlan === 'Yes' && !t.followed_plan) return false;
      if (fPlan === 'No' && t.followed_plan) return false;
    }
    if (fMistake !== 'All' && !(t.mistakes || []).includes(fMistake)) return false;
    return true;
  });

  if (loading) return <div className="content">Loading your journal…</div>;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
      <div className="content">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:20, flexWrap:'wrap', gap:16}}>
          <div>
            <h1 style={{fontFamily:'var(--serif)', fontWeight:500, fontSize:28, marginBottom:4}}>Journal</h1>
            <p style={{color:'var(--text-dim)'}}>{filtered.length}/{trades.length} shown</p>
          </div>
          <a href="/log-trade" className="add-btn" style={{textDecoration:'none', display:'inline-block'}}>+ Log trade</a>
        </div>

        <div className="filter-row">
          <span><label>Grade</label>
            <select value={fGrade} onChange={e=>setFGrade(e.target.value)}>
              <option>All</option><option>A+</option><option>A</option><option>B</option><option>C</option>
            </select>
          </span>
          <span><label>Session</label>
            <select value={fSession} onChange={e=>setFSession(e.target.value)}>
              <option>All</option><option>Asia</option><option>London</option><option>NY AM</option><option>NY PM</option>
            </select>
          </span>
          <span><label>Result</label>
            <select value={fResult} onChange={e=>setFResult(e.target.value)}>
              <option>All</option><option>Win</option><option>Loss</option>
            </select>
          </span>
          <span><label>Plan</label>
            <select value={fPlan} onChange={e=>setFPlan(e.target.value)}>
              <option>All</option><option>Yes</option><option>No</option>
            </select>
          </span>
          <span><label>Mistake</label>
            <select value={fMistake} onChange={e=>setFMistake(e.target.value)}>
              <option>All</option>
              {allMistakes.map(m => <option key={m}>{m}</option>)}
            </select>
          </span>
        </div>

        {filtered.length === 0 && (
          <div className="empty-state" style={{background:'var(--card)', border:'1px dashed var(--border)', borderRadius:10, padding:40, textAlign:'center', color:'var(--text-muted)'}}>
            No entries match these filters.
          </div>
        )}

        {filtered.map(t => {
          const accName = accounts.find(a => a.id === t.account_id)?.name;
          return (
            <div key={t.id} className={`entry-card ${t.pnl < 0 ? 'loss' : ''}`}>
              <div className="entry-head">
                <span className="entry-pnl" style={{color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmt(t.pnl)}</span>
                <span className="entry-meta">{t.trade_date}</span>
                <span className="entry-meta">{t.symbol}</span>
                {t.direction && <span className={`badge-chip ${t.direction==='Long'?'long':'short'}`}>{t.direction.toUpperCase()}</span>}
                {t.session && <span className="badge-chip">{t.session}</span>}
                {t.grade && <span className="badge-chip grade">{t.grade}</span>}
                {t.setup && <span className="entry-meta">{t.setup}</span>}
                {accName && <span className="entry-meta" style={{marginLeft:'auto'}}>{accName}</span>}
                <button className="del-btn" onClick={()=>router.push('/log-trade?id='+t.id)} style={{border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', fontSize:12}}>Edit</button>
                <button className="del-btn" onClick={()=>deleteTrade(t.id)} title="Delete">×</button>
              </div>
              {(t.mistakes||[]).length > 0 && (
                <div style={{marginBottom:6}}>
                  {t.mistakes.map(m => <span key={m} className="mistake-tag">{m}</span>)}
                </div>
              )}
              {t.why_text && <div className="entry-why"><b>WHY</b>{t.why_text}</div>}
              {t.review_text && <div className="entry-why"><b>REVIEW</b>{t.review_text}</div>}
              {(t.photo_urls||[]).length > 0 && (
                <div style={{display:'flex', gap:8, marginTop:10}}>
                  {t.photo_urls.map((url,i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="" style={{width:70, height:70, objectFit:'cover', borderRadius:6, border:'1px solid var(--border)'}} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
