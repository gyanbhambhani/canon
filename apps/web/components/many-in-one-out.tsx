"use client";
import { useEffect, useState } from "react";
import { tokenize } from "@/lib/highlight";

function Code({ code }: { code: string }) {
  return (
    <pre className="canon-code h-full overflow-auto p-4 text-[12px] leading-relaxed">
      <code>
        {tokenize(code).map(([cls, text], i) => (cls === "plain" ? text : <span key={i} className={`tok-${cls}`}>{text}</span>))}
      </code>
    </pre>
  );
}

/** Left: a scrambled variant of the program that changes every few seconds. Right: the one canonical text. */
export function ManyInOneOut({ variants, canonical }: { variants: string[]; canonical: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % variants.length), 3200);
    return () => clearInterval(t);
  }, [variants.length]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <figure className="flex h-[26rem] flex-col overflow-hidden rounded-lg border border-fd-border bg-fd-card">
        <figcaption className="flex items-center justify-between border-b border-fd-border px-4 py-2 text-xs text-fd-muted-foreground">
          <span>what an agent might write</span>
          <span className="font-mono" aria-live="polite">variant {i + 1} of {variants.length}</span>
        </figcaption>
        <Code code={variants[i]} />
      </figure>
      <figure className="flex h-[26rem] flex-col overflow-hidden rounded-lg border border-fd-border bg-fd-card">
        <figcaption className="border-b border-fd-border px-4 py-2 text-xs text-fd-muted-foreground">
          what <span className="font-mono">canon fmt</span> makes of every one of them
        </figcaption>
        <Code code={canonical} />
      </figure>
    </div>
  );
}
