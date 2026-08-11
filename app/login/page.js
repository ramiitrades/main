'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">TRADER EDGE</div>
        <form onSubmit={handleLogin}>
          {err && <div className="auth-err">{err}</div>}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          <button className="btn-save" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</button>
        </form>
        <a className="switch-link" href="/signup">Don&apos;t have an account? Sign up</a>
        <div className="auth-note">Real accounts, backed by Supabase — your password is hashed and stored securely, not in this app&apos;s code.</div>
      </div>
    </div>
  );
}
