'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { Logo } from '@/components/Logo';
import { NAV_GROUPS, isNavLinkActive } from '@/components/nav-links';

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
          <div className="max-h-[65vh] space-y-4 overflow-y-auto overscroll-contain pb-3">
            {NAV_GROUPS.map(group => (
              <div key={group.title}>
                <h2 className="mb-1 px-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{group.title}</h2>
                <div className="flex flex-col gap-1">
                  {group.links.map(link => (
                    <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                      aria-current={isNavLinkActive(link.href, pathname) ? 'page' : undefined}
                      className={`flex min-h-[44px] items-center gap-3 nav-link ${isNavLinkActive(link.href, pathname) ? 'nav-link-active' : ''}`}>
                      <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
