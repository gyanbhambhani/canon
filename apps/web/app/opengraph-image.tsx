import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { tagline } from "@/lib/shared";
import { siteData } from "@/lib/site";

export const dynamic = "force-static";
export const alt = "Canon: the programming language for AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// the build runs in apps/web (locally and on Vercel)
const fonts = join(process.cwd(), "node_modules", "geist", "dist", "fonts");
const font = (dir: string, file: string) => readFileSync(join(fonts, dir, file));

const COLOR: Record<string, string> = { prompt: "#FFFFFF", comment: "#8A8A8A", out: "#A1A1A1", error: "#EDEDED", del: "#F87171", add: "#4ADE80", ok: "#4ADE80", blank: "#A1A1A1" };

/** Social preview: dark theme, the wordmark, the headline and the hero terminal in miniature. */
export default function OpenGraphImage() {
  const lines = siteData.terminal.lines.filter((l) => !/^ {2}(---|\+\+\+) /.test(l.text));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0A0A0A", padding: 64, gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 500 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Geist Mono", fontWeight: 600, fontSize: 40, color: "#FFFFFF", letterSpacing: -1.2 }}>
            canon
            <div style={{ width: 18, height: 38, background: "#4ADE80" }} />
          </div>
          <div style={{ fontFamily: "Geist", fontSize: 64, lineHeight: 1, color: "#FFFFFF", letterSpacing: -2.8 }}>{tagline}</div>
          <div style={{ fontFamily: "Geist", fontSize: 24, color: "#A1A1A1" }}>Every compiler error ships with its fix.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, border: "1px solid #262626", borderRadius: 14, background: "#0F0F0F", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, height: 40, alignItems: "center", padding: "0 16px", background: "#111111", borderBottom: "1px solid #262626" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: 6, background: "#262626" }} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: "16px 18px", fontFamily: "Geist Mono", fontSize: 15, lineHeight: 1.5 }}>
            {lines.map((l, i) =>
              l.kind === "blank" ? (
                <div key={i} style={{ display: "flex", height: 10 }} />
              ) : (
                <div key={i} style={{ display: "flex", color: COLOR[l.kind], whiteSpace: l.kind === "error" ? "pre-wrap" : "pre" }}>
                  {l.text.replace(/ \(via print\)$/, "")}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: font("geist-sans", "Geist-SemiBold.ttf"), weight: 600 },
        { name: "Geist Mono", data: font("geist-mono", "GeistMono-Regular.ttf"), weight: 400 },
        { name: "Geist Mono", data: font("geist-mono", "GeistMono-SemiBold.ttf"), weight: 600 },
      ],
    },
  );
}
