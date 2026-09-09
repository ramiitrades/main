'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '../lib/supabaseClient';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" /> },
  { href: '/accounts', label: 'Accounts', icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></> },
  { href: '/journal', label: 'Journal', icon: <path d="M4 4h13a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2-3-2V4z" /> },
  { href: '/log-trade', label: 'Log trade', icon: <path d="M12 5v14M5 12h14" /> },
  { href: '/certificates', label: 'Certificates', icon: <><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5L7 21l5-2.5L17 21l-1.5-8.5" /></> },
  { href: '/expenses', label: 'Expenses', icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></> },
];

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastShown, setToastShown] = useState(false);
  const [greetName, setGreetName] = useState('');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('te_sidebar_collapsed') : null;
    if (saved === '1') setCollapsed(true);
    checkWelcome();
  }, []);

  async function checkWelcome() {
    if (typeof window === 'undefined') return;
    const flag = sessionStorage.getItem('te_just_logged_in');
    if (!flag) return;
    sessionStorage.removeItem('te_just_logged_in');

    const { data: { user } } = await supabase.auth.getUser();
    setGreetName(user?.user_metadata?.name || '');

    setToastVisible(true);
    requestAnimationFrame(() => setToastShown(true));
    setTimeout(() => {
      setToastShown(false);
      setTimeout(() => setToastVisible(false), 500);
    }, 2200);
  }

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('te_sidebar_collapsed', next ? '1' : '0');
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {toastVisible && (
        <div style={{
          position:'fixed', inset:0, zIndex:200,
          background:'var(--bg)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          opacity: toastShown ? 1 : 0,
          transition:'opacity .5s ease',
          pointerEvents: toastShown ? 'auto' : 'none',
        }}>
          <div style={{
            fontFamily:'var(--mono)', fontSize:12, letterSpacing:'.18em', textTransform:'uppercase',
            color:'var(--gold)', marginBottom:18,
            opacity: toastShown ? 1 : 0,
            transform: toastShown ? 'translateY(0)' : 'translateY(8px)',
            transition:'opacity .5s ease .1s, transform .5s ease .1s',
          }}>
            {timeGreeting()} · Trader Edge
          </div>
          <div style={{
            fontFamily:'var(--serif)', fontWeight:600, fontSize:'clamp(34px, 6vw, 58px)',
            color:'var(--text)', textAlign:'center', padding:'0 24px',
            opacity: toastShown ? 1 : 0,
            transform: toastShown ? 'translateY(0)' : 'translateY(14px)',
            transition:'opacity .5s ease .15s, transform .5s ease .15s',
          }}>
            Welcome back{greetName ? `, ${greetName}` : ''}
          </div>
        </div>
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand-row">
          <div className="sidebar-brand">
            <svg viewBox="0 0 26 26" fill="none" width="20" height="20">
              <path d="M2 20L10 11L15 15L24 4" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 4H24V11" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {!collapsed && <span>TRADER EDGE</span>}
          </div>
          <button className="sidebar-toggle" onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <a key={item.href} href={item.href} className={`sidebar-link ${pathname === item.href ? 'active' : ''}`} title={collapsed ? item.label : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">{item.icon}</svg>
              {!collapsed && <span>{item.label}</span>}
            </a>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button className="sidebar-link sidebar-signout" onClick={logOut} title={collapsed ? 'Sign out' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>
            </svg>
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
