'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';

interface ToolboxTalkListProps {
  jobId: string;
  meetings: Array<{
    id: string;
    topic: string;
    meetingDate: string;
    conductedByWorker: { id: string; name: string };
    attendees: Array<{ worker: { id: string; name: string } }>;
  }>;
}

/** The read side of a job's toolbox talks, plus the one write action a
 * logged talk gets: removing it if it was mis-logged. Editing in place
 * isn't offered — unlike a daily log, a toolbox talk is safety-culture
 * documentation rather than a dispute-relevant record, so delete-and-
 * relog is a fine correction path (see the DELETE route's own comment). */
export function ToolboxTalkList({ jobId, meetings }: ToolboxTalkListProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(meetingId: string, topic: string) {
    setError(null);
    setPending(meetingId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/safety-meetings/${meetingId}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? `Could not remove the ${topic} talk.`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not remove the ${topic} talk.`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-outdoor-border">
        {meetings.map((meeting) => (
          <li key={meeting.id} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{meeting.topic}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-500">{new Date(meeting.meetingDate).toLocaleDateString()}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(meeting.id, meeting.topic)}
                  disabled={pending === meeting.id}
                  aria-label={`Remove the ${meeting.topic} toolbox talk`}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="text-xs text-zinc-500">
              Led by{' '}
              <Link href={`/workers/${meeting.conductedByWorker.id}`} className="hover:underline">
                {meeting.conductedByWorker.name}
              </Link>
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              {meeting.attendees.length} attended
              {meeting.attendees.length > 0 && (
                <>
                  :{' '}
                  {meeting.attendees.map((a, index) => (
                    <span key={a.worker.id}>
                      {index > 0 && ', '}
                      <Link href={`/workers/${a.worker.id}`} className="hover:underline">
                        {a.worker.name}
                      </Link>
                    </span>
                  ))}
                </>
              )}
            </div>
          </li>
        ))}
        {meetings.length === 0 && <p className="py-2 text-sm text-zinc-500">No toolbox talks logged yet.</p>}
      </ul>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
