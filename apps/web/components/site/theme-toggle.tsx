"use client";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { icons } from "./icons";

const noop = () => () => {};

/** Sun/moon switch. next-themes (via the Fumadocs provider) follows the OS until the visitor picks, then persists it. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="inline-flex size-9 items-center justify-center rounded-[10px] border border-rule-strong text-muted transition-colors hover:text-ink-strong"
    >
      {mounted ? (dark ? icons.sun : icons.moon) : <span className="size-4" />}
    </button>
  );
}
