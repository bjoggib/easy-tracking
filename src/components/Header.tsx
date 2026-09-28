'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOptionalStore } from '@/lib/store';

const LINKS = [
  { href: '/day', label: 'Day' },
  { href: '/week', label: 'Week' },
  { href: '/recipes', label: 'Recipes' },
  { href: '/weight', label: 'Weight' },
];

export function Header() {
  const path = usePathname();
  const store = useOptionalStore();
  return (
    <header className="site">
      <div className="head">
        <Link href="/day" className="brand">Plate &amp; Scale</Link>
        <span className="sync" aria-live="polite">{store?.storageLabel}</span>
      </div>
      <nav aria-label="Sections">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? 'page' : undefined}>
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
