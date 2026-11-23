import type { ReactNode } from "react";
import { SiteNav } from "@/components/site/nav";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
