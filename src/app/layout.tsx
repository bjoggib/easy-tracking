import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { DataProvider } from '@/lib/store';
import { Header, Loaded } from '@/components/Header';
import { AuthGate } from '@/components/AuthGate';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Easy Tracking',
  description: 'Meals, daily macros and weight tracking.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <AuthGate>
          <DataProvider>
            <Header />
            <main className="wrap">
              <Loaded>{children}</Loaded>
            </main>
          </DataProvider>
        </AuthGate>
      </body>
    </html>
  );
}
