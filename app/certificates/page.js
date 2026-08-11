'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';

function fmt(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function Certificates() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: 'payout', firm: '', amount: '',
    date: new Date().toISOString().slice(0,10),
  });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    await loadCerts(user.id);
    setLoading(false);
  }

  async function loadCerts(userId) {
    const { data } = await supabase.from('certificates').select('*').eq('user_id', userId).order('cert_date', { ascending: false });
    setCerts(data || []);
  }

  async function addCert() {
    if (!form.firm) { alert('Enter which firm this is for.'); return; }
    const amount = form.type === 'eval' ? 0 : parseFloat(form.amount);
    if (form.type === 'payout' && isNaN(amount)) { alert('Enter a numeric payout amount.'); return; }
    setSaving(true);
    const { error } = await supabase.from('certificates').insert({
      user_id: user.id, type: form.type, firm: form.firm,
      amount: amount || 0, cert_date: form.date,
    });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setForm({ type: 'payout', firm: '', amount: '', date: new Date().toISOString().slice(0,10) });
    loadCerts(user.id);
  }

  async function deleteCert(id) {
    if (!confirm('Delete this entry?')) return;
    await supabase.from('certificates').delete().eq('id', id);
    setCerts(certs.filter(c => c.id !== id));
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) return <div className="content">Loading…</div>;

  const evalsPassed = certs.filter(c => c.type === 'eval').length;
  const totalPayouts = certs.filter(c => c.type === 'payout').reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
      <div className="content">
        <h1 style={{fontFamily:'var(--serif)', fontWeight:500, fontSize:28, marginBottom:20}}>Trophy wall</h1>

        <div className="stat-row responsive-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
          <div className="stat-card"><div className="stat-label">Evals passed</div><div className="stat-val">{evalsPassed}</div></div>
          <div className="stat-card"><div className="stat-label">Total payouts</div><div className="stat-val green">{fmt(totalPayouts)}</div></div>
          <div className="stat-card"><div className="stat-label">Entries</div><div className="stat-val">{certs.length}</div></div>
        </div>

        <div className="panel">
          <h3 style={{marginBottom:16, fontFamily:'var(--serif)'}}>Add entry</h3>

          <div style={{marginBottom:16}}>
            <label style={{display:'block', fontSize:12.5, color:'var(--text-muted)', marginBottom:8}}>Type</label>
            <div className="toggle-row">
              <button type="button" className={`toggle-btn ${form.type==='payout'?'active green':''}`} onClick={()=>setForm({...form, type:'payout'})}>Payout</button>
              <button type="button" className={`toggle-btn ${form.type==='eval'?'active':''}`} onClick={()=>setForm({...form, type:'eval'})}>Eval passed</button>
            </div>
          </div>

          <div className="responsive-grid" style={{display:'grid', gridTemplateColumns: form.type==='payout' ? '1.5fr 1fr 1fr' : '1.5fr 1fr', gap:18, marginBottom:20}}>
            <div className="form-field"><label>Firm</label><input type="text" placeholder="e.g. Apex, FTMO" value={form.firm} onChange={e=>setForm({...form, firm:e.target.value})} /></div>
            {form.type === 'payout' && (
              <div className="form-field"><label>Payout amount ($)</label><input type="number" placeholder="3150" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} /></div>
            )}
            <div className="form-field"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /></div>
          </div>

          <button className="add-btn" disabled={saving} onClick={addCert}>{saving ? 'Saving…' : 'Add entry'}</button>
        </div>

        {certs.length === 0 ? (
          <div className="panel" style={{textAlign:'center', color:'var(--text-muted)'}}>
            Nothing on the wall yet — log your first eval pass or payout above.
          </div>
        ) : (
          <div className="card-grid">
            {certs.map(c => (
              <div key={c.id} className="obj-card">
                <button className="card-del" onClick={()=>deleteCert(c.id)}>×</button>
                <div className="obj-sub">{c.firm} · {c.type==='eval' ? 'Eval passed' : 'Payout'}</div>
                <div className="obj-title" style={{fontSize:22, color: c.type==='eval' ? 'var(--gold-bright)' : 'var(--green)'}}>
                  {c.type==='eval' ? 'Passed' : fmt(c.amount)}
                </div>
                <div className="obj-sub">{c.cert_date}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
