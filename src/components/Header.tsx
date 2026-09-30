'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOptionalStore } from '@/lib/store';
import { supabase, usingSupabase } from '@/lib/supabase';

const LINKS: { href: string; label: string; also?: string }[] = [
  { href: '/day', label: 'Day' },
  { href: '/week', label: 'Week' },
  { href: '/meals', label: 'My meals', also: '/foods' },
  { href: '/weight', label: 'Weight' },
];

export function Header() {
  const path = usePathname();
  const store = useOptionalStore();
  return (
    <header className="site">
      <div className="head">
        <Link href="/day" className="brand">Easy Tracking</Link>
        <span className="sync" aria-live="polite">
          {store && (
            <span className="seg units" role="group" aria-label="Units">
              {(['metric', 'us'] as const).map(u => (
                <button key={u} type="button" aria-pressed={(store.data.settings.units ?? 'metric') === u} onClick={() => store.setTargets({ units: u })}>
                  {u === 'metric' ? 'kg · g' : 'lb · oz'}
                </button>
              ))}
            </span>
          )}
          {store?.storageLabel}
          {usingSupabase && (
            <>
              {' · '}
              <button type="button" className="linkish" onClick={() => supabase().auth.signOut()}>Sign out</button>
            </>
          )}
        </span>
      </div>
      <nav aria-label="Sections">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) || (!!l.also && path.startsWith(l.also)) ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

/** Renders children only once data has loaded. */
export function Loaded({ children }: { children: React.ReactNode }) {
  const store = useOptionalStore();
  return store ? <>{children}</> : <p className="loading">Loading your data…</p>;
}
