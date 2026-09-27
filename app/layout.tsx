import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Resource Scheduling & Tracking System',
  description: 'Crew scheduling, equipment tracking, compliance, and weather risk for a custom-home GC.',
  openGraph: {
    title: 'Resource Scheduling & Tracking System',
    description: 'Crew scheduling, equipment tracking, compliance, and weather risk for a custom-home GC.',
    url: 'https://resource-scheduling-tracking-system.onrender.com/',
    siteName: 'Resource Scheduling & Tracking System',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resource Scheduling & Tracking System',
    description: 'Crew scheduling, equipment tracking, compliance, and weather risk for a custom-home GC.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Resource Scheduling & Tracking System',
              description:
                'Crew scheduling, equipment tracking, compliance, and weather risk for a custom-home GC.',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web (server-rendered — no installation required)',
              url: 'https://resource-scheduling-tracking-system.onrender.com/',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              author: { '@type': 'Person', name: 'Nathan Taylor' },
            }),
          }}
        />
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
