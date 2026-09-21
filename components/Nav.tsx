'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/workers', label: 'Crew' },
  { href: '/equipment', label: 'Equipment' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/map', label: 'Map' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-outdoor-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">Coastwood Field Ops</span>
        </div>
        <nav className="flex gap-1">
          {LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${active ? 'nav-link-active' : ''}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
