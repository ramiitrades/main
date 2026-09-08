'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';

function fmt(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function Accounts() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({ name: '', firm: '', status: 'eval', starting_balance: '50000' });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    await Promise.all([loadAccounts(user.id), loadTrades(user.id)]);
    setLoading(false);
  }

  async function loadAccounts(userId) {
    const { data } = await supabase.from('accounts').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    setAccounts(data || []);
  }

  async function loadTrades(userId) {
    const { data } = await supabase.from('trades').select('account_id, pnl').eq('user_id', userId);
    setTrades(data || []);
  }

  function startAdd() {
    setEditingId('new');
    setForm({ name: '', firm: '', status: 'eval', starting_balance: '50000' });
  }
  function startEdit(a) {
    setEditingId(a.id);
    setForm({ name: a.name, firm: a.firm || '', status: a.status || 'eval', starting_balance: String(a.starting_balance ?? 50000) });
  }
  function cancelForm() { setEditingId(null); }

  async function saveAccount() {
    if (!form.name.trim()) { alert('Give the account a name.'); return; }
    const bal = parseFloat(form.starting_balance);
    if (isNaN(bal)) { alert('Enter a numeric starting balance.'); return; }
    setSaving(true);

    if (editingId === 'new') {
      const { error } = await supabase.from('accounts').insert({
        user_id: user.id, name: form.name.trim(), firm: form.firm.trim(),
        status: form.status, starting_balance: bal,
      });
      if (error) { alert(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('accounts').update({
        name: form.name.trim(), firm: form.firm.trim(), status: form.status, starting_balance: bal,
      }).eq('id', editingId);
      if (error) { alert(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setEditingId(null);
    loadAccounts(user.id);
  }

  async function deleteAccount(id) {
    if (accounts.length <= 1) { alert("You need at least one account — add a new one before deleting this."); return; }
    if (!confirm('Delete this account? Trades logged under it will keep their history but lose the account link.')) return;
    await supabase.from('accounts').delete().eq('id', id);
    setAccounts(accounts.filter(a => a.id !== id));
  }

  if (loading) return <div className="content">Loading…</div>;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
      <div className="content">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:20, flexWrap:'wrap', gap:16}}>
          <div>
            <h1 style={{fontFamily:'var(--serif)', fontWeight:500, fontSize:28, marginBottom:4}}>Accounts</h1>
            <p style={{color:'var(--text-dim)'}}>Every prop account you're running, with live balances.</p>
          </div>
          <button className="add-btn" onClick={startAdd}>+ Add account</button>
        </div>

        {editingId && (
          <div className="panel">
            <h3 style={{marginBottom:16, fontFamily:'var(--serif)'}}>{editingId === 'new' ? 'Add account' : 'Edit account'}</h3>
            <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1.3fr 1fr 1fr', gap:18, marginBottom:16}}>
              <div className="form-field"><label>Account name</label><input type="text" placeholder="e.g. Apex 200K" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} /></div>
              <div className="form-field"><label>Firm</label><input type="text" placeholder="e.g. Apex, Topstep" value={form.firm} onChange={e=>setForm({...form, firm:e.target.value})} /></div>
              <div className="form-field"><label>Starting balance ($)</label><input type="number" value={form.starting_balance} onChange={e=>setForm({...form, starting_balance:e.target.value})} /></div>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:'block', fontSize:12.5, color:'var(--text-muted)', marginBottom:8}}>Status</label>
              <div className="toggle-row">
                <button type="button" className={`toggle-btn ${form.status==='eval'?'active':''}`} onClick={()=>setForm({...form, status:'eval'})}>Evaluation</button>
                <button type="button" className={`toggle-btn ${form.status==='funded'?'active green':''}`} onClick={()=>setForm({...form, status:'funded'})}>Funded</button>
              </div>
            </div>
            <div style={{display:'flex', gap:12}}>
              <button className="add-btn" disabled={saving} onClick={saveAccount}>{saving ? 'Saving…' : (editingId==='new' ? 'Add account' : 'Update account')}</button>
              <button className="del-btn" style={{border:'1px solid var(--border)', borderRadius:7, padding:'10px 16px'}} onClick={cancelForm}>Cancel</button>
            </div>
          </div>
        )}

        <div className="card-grid">
          {accounts.map(a => {
            const accTrades = trades.filter(t => t.account_id === a.id);
            const net = accTrades.reduce((s,t)=>s+Number(t.pnl),0);
            const balance = (a.starting_balance||0) + net;
            const wins = accTrades.filter(t=>t.pnl>0).length;
            const winPct = accTrades.length ? Math.round(wins/accTrades.length*100) : 0;
            return (
              <div key={a.id} className="obj-card">
                <button className="card-del" onClick={()=>deleteAccount(a.id)}>×</button>
                <div className="obj-title">{a.name}</div>
                <div className="obj-sub">{a.firm || '—'} · {a.status==='funded' ? 'Funded' : 'Evaluation'}</div>
                <div className="stat-val" style={{fontSize:22, color: balance>=(a.starting_balance||0) ? 'var(--green)' : 'var(--red)'}}>{fmt(balance)}</div>
                <div className="obj-stat-row">
                  <span><b>{accTrades.length}</b> trades</span>
                  <span><b>{winPct}%</b> WR</span>
                  <span><b style={{color: net>=0?'var(--green)':'var(--red)'}}>{fmt(net)}</b> net</span>
                </div>
                <button className="edit-link" style={{marginTop:10, display:'inline-block'}} onClick={()=>startEdit(a)}>Edit</button>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
