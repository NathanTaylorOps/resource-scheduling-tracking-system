'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Html5Qrcode } from 'html5-qrcode';

const READER_ELEMENT_ID = 'equipment-qr-reader';

/**
 * Camera landing page for the "Scan QR" button on the equipment list. The
 * QR tag itself encodes a full URL (see lib/qr.ts) rather than a bare code,
 * so a successful read is resolved to its equipment path and handed to the
 * router — the same destination a manually typed tag code lands on, which
 * is what lets a damaged or unreadable tag fail gracefully instead of
 * blocking the crew at the tailgate.
 */
export default function EquipmentScanLandingPage() {
  const router = useRouter();
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasResolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Loaded dynamically so this browser-only library never executes
      // during server-side rendering of the page shell.
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled) return;

      const scanner = new Html5Qrcode(READER_ELEMENT_ID);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => resolveScan(decodedText),
          () => {
            // Fires on nearly every frame while the tag is being lined up
            // in the viewfinder — not an error condition, so it's ignored.
          },
        );
      } catch (err) {
        if (!cancelled) {
          const detail = err instanceof Error ? err.message : 'the camera could not be started';
          setCameraError(`Camera unavailable (${detail}). Enter the tag's printed code below instead.`);
        }
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current
        ?.stop()
        .then(() => scannerRef.current?.clear())
        .catch(() => {
          // Scanner never fully started, or was already stopped — nothing to tear down.
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resolveScan(decodedText: string) {
    if (hasResolvedRef.current) return;
    hasResolvedRef.current = true;
    scannerRef.current?.stop().catch(() => {});
    router.push(extractEquipmentScanPath(decodedText));
  }

  function handleManualSubmit(event: FormEvent) {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    router.push(`/equipment/${encodeURIComponent(code)}/scan`);
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Link href="/equipment" className="text-sm text-zinc-500 hover:underline">
        ← Equipment
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan asset tag</h1>
        <p className="text-sm text-zinc-500">Line the QR tag up in the frame — it resolves automatically.</p>
      </div>

      <div className="card overflow-hidden p-0">
        <div id={READER_ELEMENT_ID} className="aspect-square w-full bg-zinc-900" />
      </div>

      {cameraError && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{cameraError}</p>
      )}

      <form onSubmit={handleManualSubmit} className="card space-y-3">
        <label className="block text-sm font-medium" htmlFor="manualCode">
          Tag damaged or camera unavailable? Enter the printed code
        </label>
        <div className="flex gap-2">
          <input
            id="manualCode"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="e.g. CW-EX-014"
            className="flex-1 rounded-md border border-outdoor-border px-3 py-2 text-sm"
          />
          <button type="submit" className="field-btn bg-zinc-900 text-white hover:bg-zinc-800">
            Go
          </button>
        </div>
      </form>
    </div>
  );
}

function extractEquipmentScanPath(decodedText: string): string {
  try {
    const url = new URL(decodedText);
    const segments = url.pathname.split('/').filter(Boolean);
    const equipmentIndex = segments.indexOf('equipment');
    if (equipmentIndex !== -1 && segments[equipmentIndex + 1]) {
      return `/equipment/${segments[equipmentIndex + 1]}/scan`;
    }
  } catch {
    // Not an absolute URL — fall through and treat the raw text as a code,
    // which keeps a non-standard or third-party QR code from being a dead end.
  }
  return `/equipment/${encodeURIComponent(decodedText)}/scan`;
}
