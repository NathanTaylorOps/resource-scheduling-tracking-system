import { cookies } from 'next/headers';
import { ViewingRole } from './enums';

export const ACTOR_COOKIE = 'rsts_actor';

export interface ViewingActor {
  role: ViewingRole;
  workerId: string | null;
  /** Free-text display name — a worker's real name if one's selected, or a plain role label otherwise. Always set, since "an unattributed change happened" is worth keeping (see AuditLogEntry.actorLabel in schema.prisma). */
  label: string;
}

const DEFAULT_ACTOR: ViewingActor = { role: 'EXECUTIVE', workerId: null, label: 'Unidentified viewer' };

/**
 * Reads the current "viewing as" identity from the (non-httpOnly, so the
 * RoleSwitcher client component can set it directly) rsts_actor cookie.
 * Used both to shape what a server-rendered page shows (see lib/role.ts's
 * own comment on why that's UI-only, not access control) and, via
 * lib/audit.ts, to attribute an audit log entry to *something* even though
 * this app has no real login to attribute it to reliably.
 */
export function getViewingActor(): ViewingActor {
  const raw = cookies().get(ACTOR_COOKIE)?.value;
  if (!raw) return DEFAULT_ACTOR;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed?.role !== 'string' || typeof parsed?.label !== 'string') return DEFAULT_ACTOR;
    return { role: parsed.role, workerId: typeof parsed.workerId === 'string' ? parsed.workerId : null, label: parsed.label };
  } catch {
    return DEFAULT_ACTOR;
  }
}
