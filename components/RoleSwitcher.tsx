'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_LABELS } from '@/lib/role';
import { ACTOR_COOKIE } from '@/lib/actor';
import { ViewingRole } from '@/lib/enums';

const DEFAULT_ROLE: ViewingRole = 'EXECUTIVE';

function readRoleFromCookie(): ViewingRole {
  if (typeof document === 'undefined') return DEFAULT_ROLE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACTOR_COOKIE}=([^;]*)`));
  if (!match) return DEFAULT_ROLE;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    return typeof parsed?.role === 'string' && parsed.role in ROLE_LABELS ? parsed.role : DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

/**
 * "Viewing as" demo control — sets the non-httpOnly rsts_actor cookie
 * lib/actor.ts reads server-side, then refreshes so every server
 * component on the page re-renders under the new role. Styled deliberately
 * to read as a demo toggle (dashed border, muted "Viewing as" prefix), not
 * a real account switcher — see lib/actor.ts's doc comment for why this is
 * explicitly not authentication.
 */
export function RoleSwitcher() {
  const router = useRouter();
  const [role, setRole] = useState<ViewingRole>(DEFAULT_ROLE);

  // Cookie is only readable client-side once mounted; avoids a server/client
  // markup mismatch by starting at the default and syncing on mount.
  useEffect(() => {
    setRole(readRoleFromCookie());
  }, []);

  function handleChange(next: ViewingRole) {
    setRole(next);
    const actor = { role: next, workerId: null, label: ROLE_LABELS[next] };
    document.cookie = `${ACTOR_COOKIE}=${encodeURIComponent(JSON.stringify(actor))}; path=/`;
    router.refresh();
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-500"
      title="Demo-only role switcher: changes what this UI shows/hides for the selected role. Not real authentication — see lib/actor.ts."
    >
      <span className="font-medium uppercase tracking-wide">Viewing as</span>
      <select
        value={role}
        onChange={(e) => handleChange(e.target.value as ViewingRole)}
        aria-label="Viewing as — demo role switcher"
        className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-700"
      >
        {(Object.keys(ROLE_LABELS) as ViewingRole[]).map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
    </div>
  );
}
