import type { TermLine } from "@/lib/site";

const CLS: Record<TermLine["kind"], string> = {
  prompt: "text-ink-strong",
  comment: "text-faint",
  out: "text-muted",
  error: "text-ink",
  del: "bg-err-bg text-err",
  add: "bg-fix-bg text-fix",
  ok: "text-fix",
  blank: "",
};

function Line({ l }: { l: TermLine }) {
  if (l.kind === "prompt") {
    return (
      <div className={CLS.prompt}>
        <span className="select-none text-faint">$ </span>
        {l.text.replace(/^\$ /, "")}
      </div>
    );
  }
  if (l.kind === "error") {
    // "file:1:4: error E101: message": the code in --err
    const m = /^(.*?)(error [A-Z]\d{3})(:.*)$/.exec(l.text);
    if (m) {
      return (
        <div className={CLS.error}>
          {m[1]}
          <span className="text-err">{m[2]}</span>
          {m[3]}
        </div>
      );
    }
  }
  return <div className={`${CLS[l.kind]} ${l.kind === "add" || l.kind === "del" ? "-mx-5 px-5" : ""}`}>{l.text || " "}</div>;
}

/** The hero terminal: real CLI output generated at build time (scripts/site-data/terminal.ts). */
export function Terminal({ lines }: { lines: TermLine[] }) {
  return (
    <div className="overflow-x-auto">
      <pre className="min-w-max px-5 py-5 font-mono text-[13px] leading-[23px] sm:text-[14px]" data-testid="hero-terminal">
        {lines.map((l, i) => (
          <Line key={i} l={l} />
        ))}
      </pre>
    </div>
  );
}
