import type { ReactNode } from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { RootProvider } from "fumadocs-ui/provider/next";
import SearchDialog from "@/components/search";
import { siteUrl, subhead, tagline } from "@/lib/shared";
import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `Canon: ${tagline.replace(/\.$/, "").toLowerCase()}`, template: "%s · Canon" },
  description: `${tagline} ${subhead}`,
  openGraph: { title: `Canon: ${tagline}`, description: subhead, url: siteUrl, siteName: "Canon", type: "website" },
  twitter: { card: "summary_large_image", title: `Canon: ${tagline}`, description: subhead },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog }} theme={{ defaultTheme: "system", enableSystem: true }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
