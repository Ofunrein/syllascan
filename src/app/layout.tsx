import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "SyllaScan — Scan Syllabi to Google Calendar",
  description: "Upload your syllabus or document and automatically add events to your Google Calendar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'rgba(10, 10, 15, 0.86)',
              color: '#f9fafb',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 18px 45px rgba(0, 0, 0, 0.35)',
              borderRadius: '1rem',
              padding: '0.75rem 1rem',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              zIndex: 9999,
              fontFamily: "'Inter', sans-serif",
              backdropFilter: 'blur(8px)',
            },
            success: { duration: 3000 },
            error: { duration: 3000 },
            className: '',
          }}
        />
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
