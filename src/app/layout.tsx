import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "SyllaScan - Scan Syllabi to Google Calendar",
  description: "Upload your syllabus or document and automatically add events to your Google Calendar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#fff',
              color: '#333',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              borderRadius: '0.375rem',
              padding: '0.75rem 1rem',
              zIndex: 9999,
            },
            success: {
              duration: 3000,
            },
            error: {
              duration: 6000,
            },
            className: ''
          }}
        />
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
