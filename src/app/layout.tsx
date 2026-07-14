import type { Metadata, Viewport } from "next";
import { ThemeProviderWrapper } from "@/components/ThemeProviderWrapper";
import { AgentationDev } from "@/components/AgentationDev";
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
  themeColor: "#f8fafc",
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
  if (m) m.setAttribute('content', d.classList.contains('dark') ? '#05070a' : '#f8fafc');
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/favicon.png" />
        <link rel="apple-touch-icon-precomposed" href="/favicon.png" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProviderWrapper>
          {children}
          <AgentationDev />
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
