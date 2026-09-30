'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useOptionalStore } from '@/lib/store';

/** 24px stroke icons; shown only in the phone tab bar. */
const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const LINKS: { href: string; label: string; also?: string; icon: ReactNode }[] = [
  { href: '/day', label: 'Day', icon: icon(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>) },
  { href: '/week', label: 'Week', icon: icon(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>) },
  { href: '/meals', label: 'Meals', also: '/foods', icon: icon(<><path d="M5 11h14a7 7 0 0 1-14 0Z" /><path d="M9 7c0-1.5 1-2 1-3M13 7c0-1.5 1-2 1-3" /></>) },
  { href: '/weight', label: 'Weight', icon: icon(<><path d="M4 18 9 12l4 3 7-8" /><path d="M15 7h5v5" /></>) },
];

export function Header() {
  const path = usePathname();

  return (
    <header className="site">
      <div className="head">
        <Link href="/day" className="brand">Easy Tracking</Link>
        <nav className="tabs" aria-label="Sections">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) || (!!l.also && path.startsWith(l.also)) ? 'page' : undefined}>
              {l.icon}
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/profile" className="profile-link" aria-label="Profile and goals" aria-current={path.startsWith('/profile') ? 'page' : undefined}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

/** Renders children only once data has loaded. */
export function Loaded({ children }: { children: React.ReactNode }) {
  const store = useOptionalStore();
  return store ? <>{children}</> : <p className="loading">Loading…</p>;
}
