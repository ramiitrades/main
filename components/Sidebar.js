'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '../lib/supabaseClient';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" /> },
  { href: '/journal', label: 'Journal', icon: <path d="M4 4h13a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2-3-2V4z" /> },
  { href: '/log-trade', label: 'Log trade', icon: <path d="M12 5v14M5 12h14" /> },
  { href: '/certificates', label: 'Certificates', icon: <><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5L7 21l5-2.5L17 21l-1.5-8.5" /></> },
  { href: '/expenses', label: 'Expenses', icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('te_sidebar_collapsed') : null;
    if (saved === '1') setCollapsed(true);
  }, []);

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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{item.icon}</svg>
            {!collapsed && <span>{item.label}</span>}
          </a>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button className="sidebar-link sidebar-signout" onClick={logOut} title={collapsed ? 'Sign out' : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>
          </svg>
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
