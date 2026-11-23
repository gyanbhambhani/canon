"use client";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import SearchDialog from "./search";

/**
 * Theme (OS default, persisted toggle, no flash) and docs search for every page. The search
 * dialog stays mounted: Fumadocs opens it through a dialog handle, so it cannot be lazy-mounted.
 */
export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ SearchDialog }} theme={{ defaultTheme: "system", enableSystem: true }}>
      {children}
    </RootProvider>
  );
}
