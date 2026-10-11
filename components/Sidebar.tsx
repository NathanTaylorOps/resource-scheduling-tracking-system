'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { NAV_GROUPS, isNavLinkActive } from '@/components/nav-links';

/**
 * Persistent left-hand nav for desktop/tablet widths — the "this looks
 * like real software" signal a top bar doesn't give (Procore, Buildertrend,
 * CoConstruct all use one). Hidden below md; the mobile top bar in Nav.tsx
 * takes over there instead of trying to collapse this into a drawer, since
 * the field view is already tuned for a phone-width, single-column layout
 * and doesn't need a sidebar competing for the same space.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-r md:border-outdoor-border md:bg-white">
      <Link
        href="/"
        className="flex items-center gap-2 px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        aria-label="RSTS — Resource Scheduling & Tracking System, home"
        title="Resource Scheduling & Tracking System"
      >
        <Logo className="h-7 w-7 shrink-0" />
        <span className="text-lg font-bold tracking-tight">RSTS</span>
      </Link>

      <nav aria-label="Primary navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map(group => (
          <div key={group.title}>
            <h2 className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">{group.title}</h2>
            <div className="space-y-0.5">
              {group.links.map(link => {
                const active = isNavLinkActive(link.href, pathname);
                return (
                  <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[40px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-outdoor-border p-3">
        <RoleSwitcher />
      </div>
    </aside>
  );
}
