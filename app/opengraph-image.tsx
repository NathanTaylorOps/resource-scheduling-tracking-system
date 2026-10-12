/**
 * Public Open Graph image for RSTS.
 *
 * Uses a genuine Playwright-captured screenshot of the fictional Coastwood
 * Builders demo (docs/assets/dashboard.png). The screenshot itself is not
 * altered or replaced; the frame and heading are editorial context.
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const alt =
  'Real RSTS operations dashboard showing fictional Coastwood Builders jobs, readiness warnings and blocked work.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const screenshot = await readFile(join(process.cwd(), 'docs/assets/dashboard.png'), 'base64');
  const src = `data:image/png;base64,${screenshot}`;

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
        background: '#17262b', padding: '24px 27px 25px',
      }}>
        <div style={{
          display: 'flex', height: 108, alignItems: 'center',
          justifyContent: 'space-between', color: '#fff',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              display: 'flex', color: '#bddbd2', fontSize: 15,
              fontWeight: 700, letterSpacing: 1.7, marginBottom: 8,
            }}>
              RSTS / RESOURCE SCHEDULING & TRACKING
            </span>
            <span style={{ display: 'flex', fontSize: 37, fontWeight: 700, letterSpacing: -0.6 }}>
              Can this job run as planned?
            </span>
          </div>
          <span style={{
            display: 'flex', padding: '10px 14px',
            fontSize: 14, fontWeight: 600, borderRadius: 24,
            color: '#c9e2d9', border: '1px solid #486a67',
          }}>
            FICTIONAL DEMO
          </span>
        </div>
        <div style={{
          display: 'flex', flex: 1, overflow: 'hidden',
          borderRadius: 10, border: '2px solid #d0e0dd', background: '#ffffff',
        }}>
          {/* This is the real, existing dashboard screenshot, not a mock interface. */}
          <img
            src={src}
            width={1142}
            height={793}
            alt=""
            style={{ display: 'flex', width: 1142, height: 793 }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
