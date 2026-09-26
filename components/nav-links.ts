import {
  LayoutDashboard,
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
