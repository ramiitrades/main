'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

const FIRMS = ['Apex Trader Funding', 'Alpha Futures', 'Topstep', 'Tradeify', 'FundedX', 'Lucid Trading'];

function fmt(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function Expenses() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [paidOut, setPaidOut] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firm: '', description: '', amount: '', expense_type: 'one-time',
    date: new Date().toISOString().slice(0,10),
  });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    await Promise.all([loadExpenses(user.id), loadPayouts(user.id)]);
    setLoading(false);
  }

  async function loadExpenses(userId) {
    const { data } = await supabase.from('expenses').select('*').eq('user_id', userId).order('expense_date', { ascending: false });
    setExpenses(data || []);
  }

  async function loadPayouts(userId) {
    const { data } = await supabase.from('certificates').select('amount').eq('user_id', userId).eq('type', 'payout');
    setPaidOut((data || []).reduce((s, c) => s + Number(c.amount || 0), 0));
  }

  async function addExpense() {
    const amount = parseFloat(form.amount);
    if (!form.description || isNaN(amount)) { alert('Enter what it was for and a numeric amount.'); return; }
    setSaving(true);
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      firm: form.firm || null,
      description: form.description,
      amount,
      expense_type: form.expense_type,
      expense_date: form.date,
    });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setForm({ firm: '', description: '', amount: '', expense_type: 'one-time', date: new Date().toISOString().slice(0,10) });
    loadExpenses(user.id);
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    setExpenses(expenses.filter(e => e.id !== id));
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) return <div className="content">Loading…</div>;

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const monthlyRecurring = expenses.filter(e => e.expense_type === 'monthly').reduce((s, e) => s + Number(e.amount), 0);
  const netVsPayouts = paidOut - totalSpent;

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <strong style={{fontFamily:'var(--serif)'}}>TRADER EDGE</strong>
          <a href="/dashboard" style={{color:'var(--text-muted)', fontSize:13.5}}>Dashboard</a>
          <a href="/journal" style={{color:'var(--text-muted)', fontSize:13.5}}>Journal</a>
          <a href="/log-trade" style={{color:'var(--text-muted)', fontSize:13.5}}>Log trade</a>
          <a href="/certificates" style={{color:'var(--text-muted)', fontSize:13.5}}>Certificates</a>
          <a href="/expenses" style={{color:'var(--gold-bright)', fontSize:13.5}}>Expenses</a>
        </div>
        <button className="del-btn" onClick={logOut}>Sign out</button>
      </div>

      <div className="content">
        <h1 style={{fontFamily:'var(--serif)', fontWeight:500, fontSize:28, marginBottom:20}}>Expenses</h1>

        <div className="stat-row">
          <div className="stat-card"><div className="stat-label">Total spent on firms</div><div className="stat-val red">{fmt(totalSpent)}</div></div>
          <div className="stat-card"><div className="stat-label">Monthly recurring</div><div className="stat-val" style={{color:'var(--gold-bright)'}}>{fmt(monthlyRecurring)}/mo</div></div>
          <div className="stat-card"><div className="stat-label">Paid out (from wall)</div><div className="stat-val green">{fmt(paidOut)}</div></div>
          <div className="stat-card"><div className="stat-label">Net vs payouts</div><div className={`stat-val ${netVsPayouts>=0?'green':'red'}`}>{fmt(netVsPayouts)}</div></div>
        </div>

        <div className="panel">
          <h3 style={{marginBottom:16, fontFamily:'var(--serif)'}}>Add expense</h3>

          <div className="form-field" style={{marginBottom:12}}>
            <label>Prop firm</label>
            <input type="text" placeholder="Pick below or type your own" value={form.firm} onChange={e=>setForm({...form, firm:e.target.value})} />
          </div>
          <div className="toggle-row" style={{marginBottom:20}}>
            {FIRMS.map(f => (
              <button key={f} type="button" className={`toggle-btn ${form.firm===f?'active':''}`} onClick={()=>setForm({...form, firm:f})}>{f}</button>
            ))}
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1.3fr 1fr 1fr 1fr', gap:18, marginBottom:20}}>
            <div className="form-field"><label>What for</label><input type="text" placeholder="50K eval / reset" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} /></div>
            <div className="form-field"><label>Amount ($)</label><input type="number" placeholder="167" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} /></div>
            <div>
              <label style={{display:'block', fontSize:12.5, color:'var(--text-muted)', marginBottom:8}}>Type</label>
              <div className="toggle-row">
                <button type="button" className={`toggle-btn ${form.expense_type==='one-time'?'active':''}`} onClick={()=>setForm({...form, expense_type:'one-time'})}>One-time</button>
                <button type="button" className={`toggle-btn ${form.expense_type==='monthly'?'active':''}`} onClick={()=>setForm({...form, expense_type:'monthly'})}>Monthly</button>
              </div>
            </div>
            <div className="form-field"><label>Purchase date</label><input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /></div>
          </div>

          <button className="add-btn" disabled={saving} onClick={addExpense}>{saving ? 'Saving…' : 'Add expense'}</button>
        </div>

        <div className="panel" style={{padding:0, overflow:'hidden'}}>
          {expenses.length === 0 ? (
            <div style={{textAlign:'center', color:'var(--text-dim)', padding:36}}>Nothing tracked yet — add your eval fees and subscriptions above.</div>
          ) : (
            <table>
              <thead><tr><th style={{padding:'12px 20px'}}>Date</th><th style={{padding:'12px 20px'}}>Firm</th><th style={{padding:'12px 20px'}}>What for</th><th style={{padding:'12px 20px'}}>Type</th><th style={{padding:'12px 20px', textAlign:'right'}}>Amount</th><th style={{padding:'12px 20px'}}></th></tr></thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td style={{padding:'12px 20px', fontFamily:'var(--mono)'}}>{e.expense_date}</td>
                    <td style={{padding:'12px 20px'}}>{e.firm || '—'}</td>
                    <td style={{padding:'12px 20px'}}>{e.description}</td>
                    <td style={{padding:'12px 20px', color:'var(--text-muted)', fontSize:12.5}}>{e.expense_type === 'monthly' ? 'Monthly' : 'One-time'}</td>
                    <td style={{padding:'12px 20px', textAlign:'right', fontFamily:'var(--mono)', fontWeight:600, color:'var(--red)'}}>-{fmt(e.amount).replace('-','')}</td>
                    <td style={{padding:'12px 20px', textAlign:'right'}}><button className="del-btn" onClick={()=>deleteExpense(e.id)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
