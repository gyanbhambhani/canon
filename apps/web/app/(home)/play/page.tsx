import type { Metadata } from "next";
import { Playground } from "@/components/playground";
import { siteData } from "@/lib/site";

export const metadata: Metadata = {
  title: "Playground",
  description: "Write Canon in your browser, see each mistake with its fix, apply it and run the program.",
};

export default function PlayPage() {
  return (
    <Playground
      examples={siteData.examples.map(({ id, source }) => ({ id, source }))}
      mistakes={siteData.mistakes.map(({ id, source }) => ({ id, source }))}
    />
  );
}
