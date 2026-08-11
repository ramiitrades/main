'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }

    // If email confirmations are on, there's no session yet.
    if (!data.session) {
      setMsg('Check your inbox to confirm your email, then log in.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">TRADER EDGE</div>
        <form onSubmit={handleSignup}>
          {err && <div className="auth-err">{err}</div>}
          {msg && <div className="auth-err" style={{color:'var(--green)'}}>{msg}</div>}
          <div className="field">
            <label>Name</label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn-save" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
        </form>
        <a className="switch-link" href="/login">Already have an account? Log in</a>
      </div>
    </div>
  );
}
