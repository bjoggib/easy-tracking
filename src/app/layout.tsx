import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { DataProvider } from '@/lib/store';
import { Header, Loaded } from '@/components/Header';
import { AuthGate } from '@/components/AuthGate';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-display' });
const body = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });

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
    <html lang="en" className={`${display.variable} ${body.variable}`}>
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
