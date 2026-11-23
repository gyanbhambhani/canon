"use client";
import { useState } from "react";
import { icons } from "./icons";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? "Copied" : label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex size-8 items-center justify-center rounded-md text-faint transition-colors hover:text-ink-strong"
    >
      {done ? <span className="text-fix">{icons.check}</span> : icons.copy}
    </button>
  );
}
