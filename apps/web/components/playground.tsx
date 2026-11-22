"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { applyPatch, check, compileJs, CanonError, fmt, type Diagnostic } from "@canon/compiler";
import type { MainResult } from "@canon/runtime";
import { canonLanguage } from "@/lib/canon-mode";
import { decodeSource, encodeSource } from "@/lib/share";

const TIME_LIMIT_MS = 2000;

const canonHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--tok-kw)" },
  { tag: tags.modifier, color: "var(--tok-mod)" },
  { tag: tags.bool, color: "var(--tok-lit)" },
  { tag: tags.string, color: "var(--tok-str)" },
  { tag: tags.number, color: "var(--tok-num)" },
  { tag: tags.comment, color: "var(--tok-com)", fontStyle: "italic" },
  { tag: tags.typeName, color: "var(--tok-type)" },
  { tag: tags.function(tags.variableName), color: "var(--tok-fn)" },
  { tag: tags.invalid, color: "var(--tok-hole)", fontWeight: "600" },
  { tag: tags.operator, color: "var(--tok-op)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "transparent" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--color-fd-muted-foreground)" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in oklab, var(--color-fd-accent) 50%, transparent)" },
  ".cm-content": { caretColor: "var(--color-fd-foreground)" },
  "&.cm-focused": { outline: "none" },
});

type OutputLine = { kind: "out" | "err" | "note"; text: string };

export function Playground({ examples }: { examples: { name: string; source: string }[] }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [source, setSource] = useState<string>("");
  const [diags, setDiags] = useState<Diagnostic[]>([]);
  const [checkedText, setCheckedText] = useState("");
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [running, setRunning] = useState(false);
  const [example, setExample] = useState("");
  const worker = useRef<Worker | null>(null);

  const setEditorText = useCallback((text: string) => {
    const v = view.current;
    if (!v) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
  }, []);

  // editor setup; initial text from the URL hash, else hello.cn
  useEffect(() => {
    if (!host.current) return;
    const initial = decodeSource(window.location.hash) ?? examples[0]?.source ?? "";
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial,
        extensions: [
          basicSetup,
          canonLanguage,
          syntaxHighlighting(canonHighlight),
          theme,
          EditorView.contentAttributes.of({ "aria-label": "Canon source" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) setSource(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    setSource(initial);
    return () => v.destroy();
  }, [examples]);

  // check on every pause in typing (300 ms), and keep the URL hash in sync
  useEffect(() => {
    const t = setTimeout(() => {
      const r = check(source, "main.cn");
      setDiags(r.diagnostics);
      setCheckedText(source);
      const hash = `#code=${encodeSource(source)}`;
      if (window.location.hash !== hash) history.replaceState(null, "", hash);
    }, 300);
    return () => clearTimeout(t);
  }, [source]);

  const onFormat = () => {
    try {
      setEditorText(fmt(source));
    } catch (e) {
      if (e instanceof CanonError) setDiags([e.diag]);
      else throw e;
    }
  };

  const onCheck = () => {
    const r = check(source, "main.cn");
    setDiags(r.diagnostics);
    setCheckedText(source);
  };

  const onApply = (d: Diagnostic) => {
    if (!d.fix) return;
    const next = applyPatch(checkedText, d.fix.diff);
    if (next !== null) setEditorText(next);
  };

  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    setRunning(false);
  };

  const onRun = () => {
    stop();
    const c = compileJs(source, "main.cn");
    setDiags(c.check.diagnostics);
    setCheckedText(source);
    if (!c.js) {
      setOutput([{ kind: "err", text: "The program has diagnostics; fix them before running." }]);
      return;
    }
    const lines: OutputLine[] = [];
    setOutput([]);
    setRunning(true);
    const w = new Worker(new URL("../lib/run-worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    const timer = setTimeout(() => {
      if (worker.current !== w) return;
      stop();
      setOutput([...lines, { kind: "err", text: `Stopped after ${TIME_LIMIT_MS / 1000} seconds.` }]);
    }, TIME_LIMIT_MS);
    w.onmessage = (ev: MessageEvent<{ type: string; line?: string; result?: MainResult; message?: string }>) => {
      const m = ev.data;
      if (m.type === "print") {
        lines.push({ kind: "out", text: m.line! });
        setOutput([...lines]);
        return;
      }
      clearTimeout(timer);
      if (m.type === "crash") lines.push({ kind: "err", text: m.message! });
      const r = m.result;
      if (r?.trap) {
        lines.push({ kind: "err", text: JSON.stringify(r.trap) });
        if (r.trap.code === "R006") lines.push({ kind: "note", text: "The browser playground denies fs and net; run it with the canon CLI instead." });
      }
      if (r?.error) lines.push({ kind: "err", text: `error: ${r.error}` });
      if (r && r.status === 0 && lines.length === 0) lines.push({ kind: "note", text: "(no output)" });
      setOutput([...lines]);
      stop();
    };
    w.onerror = (ev) => {
      clearTimeout(timer);
      setOutput([...lines, { kind: "err", text: `The runner failed to start: ${ev.message || "unknown error"}` }]);
      stop();
    };
    w.postMessage({ js: c.js });
  };

  const onExample = (name: string) => {
    setExample(name);
    const ex = examples.find((e) => e.name === name);
    if (ex) {
      setEditorText(ex.source);
      setOutput([]);
    }
  };

  const btn = "rounded-md border border-fd-border px-3 py-1.5 text-sm font-medium hover:bg-fd-accent disabled:opacity-50";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-4">
      <h1 className="sr-only">Canon playground</h1>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={onFormat}>
          Format
        </button>
        <button type="button" className={btn} onClick={onCheck}>
          Check
        </button>
        <button
          type="button"
          className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:text-neutral-950"
          onClick={onRun}
          disabled={running}
        >
          {running ? "Running…" : "Run"}
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-fd-muted-foreground">
          Examples
          <select
            className="rounded-md border border-fd-border bg-fd-background px-2 py-1.5 text-sm text-fd-foreground"
            value={example}
            onChange={(e) => onExample(e.target.value)}
          >
            <option value="" disabled>
              choose…
            </option>
            {examples.map((e) => (
              <option key={e.name} value={e.name}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid min-h-[70vh] flex-1 gap-3 lg:grid-cols-[3fr_2fr]">
        <div ref={host} className="min-h-[50vh] overflow-hidden rounded-lg border border-fd-border bg-fd-card" data-testid="editor" />
        <div className="flex min-h-0 flex-col gap-3">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-fd-border bg-fd-card" aria-label="Diagnostics">
            <h2 className="border-b border-fd-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">
              Diagnostics {diags.length ? `(${diags.length})` : ""}
            </h2>
            <ul className="flex-1 overflow-auto p-2 text-sm" data-testid="diagnostics">
              {diags.length === 0 ? <li className="px-1 py-1 text-fd-muted-foreground">No problems.</li> : null}
              {diags.map((d, i) => (
                <li key={i} className="border-b border-fd-border px-1 py-2 last:border-none">
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-fd-muted px-1.5 py-0.5 font-mono text-xs">{d.code}</span>
                    <span className="flex-1">{d.message}</span>
                    <span className="font-mono text-xs text-fd-muted-foreground">
                      {d.line}:{d.col}
                    </span>
                  </div>
                  {d.data && d.code === "H001" && (d.data as { candidates?: string[] }).candidates?.length ? (
                    <div className="mt-1 pl-1 font-mono text-xs text-fd-muted-foreground">
                      {(d.data as { candidates: string[] }).candidates.join(" · ")}
                    </div>
                  ) : null}
                  {d.fix ? (
                    <div className="mt-2 flex items-start gap-2">
                      <button type="button" className={btn} onClick={() => onApply(d)} disabled={checkedText !== source}>
                        Apply
                      </button>
                      <pre className="max-h-32 flex-1 overflow-auto rounded bg-fd-muted p-2 font-mono text-[11px]">{d.fix.diff}</pre>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-fd-border bg-fd-card" aria-label="Output">
            <h2 className="border-b border-fd-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">Output</h2>
            <pre className="flex-1 overflow-auto p-3 font-mono text-[13px]" data-testid="output">
              {output.map((l, i) => (
                <div key={i} className={l.kind === "err" ? "text-red-600 dark:text-red-400" : l.kind === "note" ? "text-fd-muted-foreground" : ""}>
                  {l.text}
                </div>
              ))}
            </pre>
          </section>
        </div>
      </div>
      <p className="text-xs text-fd-muted-foreground">
        Everything runs in your browser: the compiler on this page, your program in a Web Worker, stopped after {TIME_LIMIT_MS / 1000}{" "}
        seconds. io, time and rand are allowed; fs and net trap with R006. The URL holds your code, so you can share it.
      </p>
    </main>
  );
}
