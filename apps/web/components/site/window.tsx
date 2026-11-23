import type { ReactNode } from "react";

/** A terminal or editor window: 14px radius, strong border, 44px title bar with three muted dots. */
export function Window({ title, tabs, children, className = "" }: { title?: string; tabs?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[14px] border border-rule-strong bg-surface text-left ${className}`}>
      <div className="flex h-11 items-center gap-3 border-b border-rule-strong bg-surface-2 px-4">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-3 rounded-full bg-rule-strong" />
          <span className="size-3 rounded-full bg-rule-strong" />
          <span className="size-3 rounded-full bg-rule-strong" />
        </span>
        {tabs ?? <span className="flex-1 pr-12 text-center font-mono text-[13px] text-faint">{title}</span>}
      </div>
      {children}
    </div>
  );
}
