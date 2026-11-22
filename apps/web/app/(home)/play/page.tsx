import type { Metadata } from "next";
import { Playground } from "@/components/playground";
import { siteData } from "@/lib/site";

export const metadata: Metadata = {
  title: "Playground",
  description: "Format, check and run Canon in your browser. Nothing leaves the page.",
};

export default function PlayPage() {
  return <Playground examples={siteData.examples} />;
}
