import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'deal notes graph',
  description:
    'Prototype that extracts CRM facts from synthetic notes and shows each fact beside its source sentence.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="topbar">
          <h1>deal notes graph</h1>
          <nav aria-label="Main">
            <Link href="/">Notes</Link>
            <Link href="/deals">Deals</Link>
          </nav>
        </header>
        <main id="main" className="shell">
          {children}
        </main>
      </body>
    </html>
  );
}
