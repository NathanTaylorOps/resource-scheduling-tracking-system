'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { Logo } from '@/components/Logo';
import { NAV_LINKS } from '@/components/nav-links';

/**
 * Mobile-only top bar (md and up gets the persistent Sidebar instead — see
 * components/Sidebar.tsx). This is the same toggle-menu pattern the app
 * already used pre-sidebar, just scoped to small screens: the field view
 * and every other screen are tuned for a phone-width layout below md, and
 * a hamburger + full-screen link list is still the right pattern there,
 * not a squeezed-in mini sidebar.
 */
export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string): boolean {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  return (
    <header className="border-b border-outdoor-border bg-white md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          aria-label="RSTS — Resource Scheduling & Tracking System, home"
          title="Resource Scheduling & Tracking System"
        >
          <Logo className="h-6 w-6 shrink-0" />
          RSTS
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
        >
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-outdoor-border px-4 py-2">
          <div className="mb-2">
            <RoleSwitcher />
          </div>
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 nav-link ${isActive(link.href) ? 'nav-link-active' : ''}`}
              >
                <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
