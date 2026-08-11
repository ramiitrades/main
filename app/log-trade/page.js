'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

const SESSIONS = ['Asia', 'London', 'NY AM', 'NY PM'];
const GRADES = ['A+', 'A', 'B', 'C'];
const MISTAKES = ['FOMO entry', 'Moved stop', 'Early exit', 'Late entry', 'Revenge trade', 'Oversized', 'Chased', 'Hesitated', 'No mistake'];

function LogTradeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id');
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0,10),
    symbol: '', pnl: '', r_multiple: '', mae: '', mfe: '',
    account_id: '', session: 'NY AM', direction: 'Long', grade: 'A',
    setup: '', followed_plan: true, mistakes: [], why_text: '', review_text: '',
  });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    const { data: accs } = await supabase.from('accounts').select('*').eq('user_id', user.id);
    setAccounts(accs || []);
    if (accs && accs.length && !editId) setForm(f => ({ ...f, account_id: accs[0].id }));

    if (editId) {
      const { data: trade } = await supabase.from('trades').select('*').eq('id', editId).single();
      if (trade) {
        setForm({
          date: trade.trade_date, symbol: trade.symbol, pnl: trade.pnl,
          r_multiple: trade.r_multiple ?? '', mae: trade.mae ?? '', mfe: trade.mfe ?? '',
          account_id: trade.account_id || '', session: trade.session || 'NY AM',
          direction: trade.direction || 'Long', grade: trade.grade || 'A',
          setup: trade.setup || '', followed_plan: trade.followed_plan ?? true,
          mistakes: trade.mistakes || [], why_text: trade.why_text || '', review_text: trade.review_text || '',
        });
      }
    }
  }

  function toggleMistake(m) {
    if (m === 'No mistake') { setForm(f => ({ ...f, mistakes: f.mistakes.includes(m) ? [] : ['No mistake'] })); return; }
    setForm(f => {
      const has = f.mistakes.includes(m);
      const next = has ? f.mistakes.filter(x => x !== m) : [...f.mistakes.filter(x => x !== 'No mistake'), m];
      return { ...f, mistakes: next };
    });
  }

  async function save(noTradeDay = false) {
    const pnl = noTradeDay ? 0 : parseFloat(form.pnl);
    if (!noTradeDay && (!form.symbol || isNaN(pnl))) { alert('Enter at least a symbol and a numeric P&L.'); return; }
    setSaving(true);

    const payload = {
      user_id: user.id,
      account_id: form.account_id || null,
      trade_date: form.date,
      symbol: noTradeDay ? '—' : form.symbol.toUpperCase(),
      pnl: noTradeDay ? 0 : pnl,
      session: form.session, direction: form.direction, grade: form.grade,
      setup: form.setup, followed_plan: form.followed_plan, mistakes: form.mistakes,
      why_text: form.why_text, review_text: form.review_text,
      r_multiple: form.r_multiple === '' ? null : parseFloat(form.r_multiple),
      mae: form.mae === '' ? null : parseFloat(form.mae),
      mfe: form.mfe === '' ? null : parseFloat(form.mfe),
      no_trade_day: noTradeDay,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('trades').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('trades').insert(payload));
    }
    setSaving(false);
    if (error) { alert(error.message); return; }
    router.push('/journal');
  }

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <strong style={{fontFamily:'var(--serif)'}}>TRADER EDGE</strong>
          <a href="/dashboard" style={{color:'var(--text-muted)', fontSize:13.5}}>Dashboard</a>
          <a href="/journal" style={{color:'var(--text-muted)', fontSize:13.5}}>Journal</a>
          <a href="/log-trade" style={{color:'var(--gold-bright)', fontSize:13.5}}>Log trade</a>
        </div>
      </div>

      <div className="content">
        <h1 style={{fontFamily:'var(--serif)', fontWeight:500, fontSize:28, marginBottom:20}}>
          {editId ? 'Edit trade' : 'Log a trade'}
        </h1>

        <div className="panel">
          <div className="form-grid wide">
            <div className="form-field"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /></div>
            <div className="form-field"><label>Symbol</label><input type="text" placeholder="MGC" value={form.symbol} onChange={e=>setForm({...form, symbol:e.target.value})} /></div>
            <div className="form-field"><label>Net P&amp;L ($)</label><input type="number" step="0.01" placeholder="640" value={form.pnl} onChange={e=>setForm({...form, pnl:e.target.value})} /></div>
            <div className="form-field"><label>R multiple (optional)</label><input type="number" step="0.1" placeholder="2.4" value={form.r_multiple} onChange={e=>setForm({...form, r_multiple:e.target.value})} /></div>
            <div className="form-field"><label>Account</label>
              <select value={form.account_id} onChange={e=>setForm({...form, account_id:e.target.value})} style={{width:'100%', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:7, color:'var(--text)', padding:'10px 12px', fontSize:13.5}}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field"><label>MAE $ — worst it went against you</label><input type="number" placeholder="e.g. 80" value={form.mae} onChange={e=>setForm({...form, mae:e.target.value})} /></div>
            <div className="form-field"><label>MFE $ — best it went for you</label><input type="number" placeholder="e.g. 340" value={form.mfe} onChange={e=>setForm({...form, mfe:e.target.value})} /></div>
            <div className="form-field"><label>Setup</label><input type="text" placeholder="e.g. BNR, ORB, VWAP reclaim" value={form.setup} onChange={e=>setForm({...form, setup:e.target.value})} /></div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24, marginBottom:20}}>
            <div>
              <label style={{display:'block', fontSize:12.5, color:'var(--text-muted)', marginBottom:8}}>Session</label>
              <div className="toggle-row">
                {SESSIONS.map(s => (
                  <button key={s} type="button" className={`toggle-btn ${form.session===s?'active':''}`} onClick={()=>setForm({...form, session:s})}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{display:'block', fontSize:12.5, color:'var(--text-muted)', marginBottom:8}}>Direction</label>
              <div className="toggle-row">
                <button type="button" className={`toggle-btn ${form.direction==='Long'?'active green':''}`} onClick={()=>setForm({...form, direction:'Long'})}>Long</button>
                <button type="button" className={`toggle-btn ${form.direction==='Short'?'active red-outline':''}`} onClick={()=>setForm({...form, direction:'Short'})}>Short</button>
              </div>
            </div>
            <div>
              <label style={{display:'block', fontSize:12.5, color:'var(--text-muted)', marginBottom:8}}>Grade</label>
              <div className="toggle-row">
                {GRADES.map(g => (
                  <button key={g} type="button" className={`toggle-btn ${form.grade===g?'active':''}`} onClick={()=>setForm({...form, grade:g})}>{g}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <label style={{display:'block', fontSize:12.5, color:'var(--text-muted)', marginBottom:8}}>Followed plan?</label>
            <div className="toggle-row">
              <button type="button" className={`toggle-btn ${form.followed_plan?'active green':''}`} onClick={()=>setForm({...form, followed_plan:true})}>Yes</button>
              <button type="button" className={`toggle-btn ${!form.followed_plan?'active red-outline':''}`} onClick={()=>setForm({...form, followed_plan:false})}>No</button>
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <label style={{display:'block', fontSize:12.5, color:'var(--text-muted)', marginBottom:8}}>Mistakes — tag anything you did wrong (tap to toggle)</label>
            <div className="toggle-row">
              {MISTAKES.map(m => (
                <button key={m} type="button" className={`mistake-btn ${form.mistakes.includes(m)?'active':''}`} onClick={()=>toggleMistake(m)}>{m}</button>
              ))}
            </div>
          </div>

          <div className="form-field" style={{marginBottom:20}}>
            <label>Why I took it</label>
            <textarea value={form.why_text} onChange={e=>setForm({...form, why_text:e.target.value})} placeholder="What made this look like a trade?" />
          </div>

          <div className="form-field" style={{marginBottom:24}}>
            <label>Post-trade review (optional)</label>
            <textarea value={form.review_text} onChange={e=>setForm({...form, review_text:e.target.value})} placeholder="Management, mistakes, what to repeat..." />
          </div>

          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <button className="add-btn" disabled={saving} onClick={()=>save(false)}>{saving ? 'Saving…' : (editId ? 'Update trade' : 'Save trade')}</button>
            {!editId && (
              <button type="button" className="del-btn" style={{border:'1px solid var(--border)', borderRadius:7, padding:'10px 16px'}} onClick={()=>save(true)}>
                Mark as no-trade day
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogTradePage() {
  return (
    <Suspense fallback={<div className="content">Loading…</div>}>
      <LogTradeForm />
    </Suspense>
  );
}
