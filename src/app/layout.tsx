import type { Metadata } from "next";
import "./globals.css";
import { ColorSchemeScript } from "@/components/theme/ColorScheme";

export const metadata: Metadata = {
  title: "FlowDesk",
  description: "FlowDesk",
};

/**
 * Inline script that runs before React hydration to set <html data-theme>
 * from localStorage, preventing a flash of the wrong color scheme (FOUC).
 */
const themeInitScript = `
(function(){
  try {
    var raw = localStorage.getItem('flowdesk.colorScheme');
    var scheme = (raw === 'light' || raw === 'dark') ? raw : 'system';
    var effective = scheme === 'system'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : scheme;
    if (effective === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ColorSchemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
