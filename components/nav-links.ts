import {
  LayoutDashboard,
  ListChecks,
  HardHat,
  Briefcase,
  FolderKanban,
  Users,
  Handshake,
  Wrench,
  TriangleAlert,
  Calendar,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Single source of truth for the app's primary navigation — used by both
// the desktop sidebar and the mobile top-bar menu, so the two never drift
// out of sync (a link added to one but not the other, wrong order, etc).
export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/actions', label: 'Action Centre', icon: ListChecks },
  { href: '/field', label: 'Field', icon: HardHat },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/portfolio', label: 'Portfolio', icon: FolderKanban },
  { href: '/workers', label: 'Crew', icon: Users },
  { href: '/subcontractors', label: 'Subcontractors', icon: Handshake },
  { href: '/equipment', label: 'Equipment', icon: Wrench },
  { href: '/expiring', label: 'Expiring', icon: TriangleAlert },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/map', label: 'Map', icon: MapPin },
];

/** Navigation groups do not change URLs or gate access. They surface the
 * application's existing operating workflows in the order people use them.
 */
export const NAV_GROUPS: Array<{ title: string; links: NavLink[] }> = [
  { title: 'Command', links: NAV_LINKS.filter(link => ['/', '/actions', '/portfolio'].includes(link.href)) },
  { title: 'Planning', links: NAV_LINKS.filter(link => ['/jobs', '/schedule', '/map'].includes(link.href)) },
  { title: 'Resources', links: NAV_LINKS.filter(link => ['/workers', '/subcontractors', '/equipment'].includes(link.href)) },
  { title: 'Assurance', links: NAV_LINKS.filter(link => ['/expiring'].includes(link.href)) },
  { title: 'Field', links: NAV_LINKS.filter(link => ['/field'].includes(link.href)) },
];

export function isNavLinkActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}
