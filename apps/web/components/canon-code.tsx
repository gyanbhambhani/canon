import { tokenize } from "@/lib/highlight";

/** Canon source with syntax highlighting (server-rendered, no client JS). */
export function CanonCode({ code, className = "" }: { code: string; className?: string }) {
  return (
    <pre className={`canon-code overflow-auto text-[13px] leading-relaxed ${className}`}>
      <code>
        {tokenize(code).map(([cls, text], i) =>
          cls === "plain" ? text : (
            <span key={i} className={`tok-${cls}`}>
              {text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
