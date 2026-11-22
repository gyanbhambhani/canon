import type { ReactNode } from "react";
import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import SearchDialog from "@/components/search";
import "./global.css";

export const metadata: Metadata = {
  title: { default: "Canon: the dialect models already speak", template: "%s · Canon" },
  description:
    "Canon is a programming language for AI agents. One way to write every program, effects in every signature, and a compiler that answers with patches.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog }} theme={{ defaultTheme: "system", enableSystem: true }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
