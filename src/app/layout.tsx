import type { Metadata } from "next";
import "./globals.css";
import { ColorSchemeScript } from "@/components/theme/ColorScheme";

export const metadata: Metadata = {
  title: "FlowDesk",
  description: "FlowDesk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The active theme is resolved client-side by ColorSchemeScript, which reads
  // localStorage "flowdesk.colorScheme" and sets <html data-theme="dark"> on mount.
  // During SSR we render without a data-theme attribute (light tokens); the client
  // script patches it immediately so the first client paint matches the stored choice.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
