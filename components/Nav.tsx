'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { RoleSwitcher } from '@/components/RoleSwitcher';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/field', label: 'Field' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/workers', label: 'Crew' },
  { href: '/subcontractors', label: 'Subcontractors' },
  { href: '/equipment', label: 'Equipment' },
  { href: '/expiring', label: 'Expiring' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/map', label: 'Map' },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string): boolean {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  return (
    <header className="border-b border-outdoor-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          aria-label="RSTS — Resource Scheduling & Tracking System, home"
          title="Resource Scheduling & Tracking System"
        >
          RSTS
        </Link>

        {/* Desktop: full link row. Below md, this many links stops fitting a
            single line, so it's replaced entirely by the toggle menu rather
            than shrunk or wrapped. */}
        <nav className="hidden md:flex md:gap-1">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={`nav-link ${isActive(link.href) ? 'nav-link-active' : ''}`}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center md:flex">
          <RoleSwitcher />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900 md:hidden"
        >
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-outdoor-border px-4 py-2 md:hidden">
          <div className="mb-2">
            <RoleSwitcher />
          </div>
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`nav-link ${isActive(link.href) ? 'nav-link-active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
