import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'deal notes graph',
  description:
    'Prototype that extracts CRM facts from synthetic sales notes and shows each fact beside the source sentence it was quoted from. Not a production CRM.',
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
            <Link href="/">Demo</Link>
            <Link href="/notes">Notes</Link>
            <Link href="/deals">Deals</Link>
            <Link href="/results">Results</Link>
            <Link href="/playground">GraphQL</Link>
          </nav>
        </header>
        <main id="main" className="shell">
          {children}
        </main>
      </body>
    </html>
  );
}
