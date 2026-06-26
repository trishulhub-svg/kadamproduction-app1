import type { Metadata, Viewport } from "next";
import { Agentation } from "agentation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kadam Production",
  description: "Professional Event Services — operations dashboard",
  manifest: "/api/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KadamProd",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e40af",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const themeScript = `
(function() {
  var t = localStorage.getItem('kp-theme') || 'system';
  var d = document.documentElement;
  if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    d.classList.add('dark');
  }
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', d.classList.contains('dark') ? '#0f111a' : '#1e40af');
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/api/manifest" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Agentation />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(function(){});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
