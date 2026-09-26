import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Resource Scheduling & Tracking System',
  description: 'Crew scheduling, equipment tracking, compliance, and weather risk for a custom-home GC.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* md and up: persistent left sidebar beside the content. Below
            md: Sidebar renders nothing (it's `hidden` until md:flex) and
            Nav's mobile top bar takes over instead — see each component's
            own comment for why. */}
        <div className="md:flex">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Nav />
            <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
