/**
 * Small geometric mark for the RSTS wordmark — a stylized gable roofline
 * over a doorway, so it reads as "building/construction" at a glance
 * without spelling anything out. Deliberately just two flat shapes (no
 * gradients or fine detail) so it stays crisp at the small sizes it's
 * actually used at (header, sidebar, favicon).
 */
export function Logo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="5" className="fill-zinc-900" />
      <path d="M12 5 4.5 11.5H7V19h10v-7.5h2.5L12 5Z" className="fill-white" />
      <rect x="10.25" y="14" width="3.5" height="5" className="fill-zinc-900" />
    </svg>
  );
}
