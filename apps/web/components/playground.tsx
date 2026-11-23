"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, StateEffect, StateField, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { applyPatch, check, compileJs, CanonError, fmt, type Diagnostic } from "@canon/compiler";
import type { MainResult } from "@canon/runtime";
import { canonLanguage } from "@/lib/canon-mode";
import { decodeSource, encodeSource } from "@/lib/share";

const TIME_LIMIT_MS = 2000;

/** Labels for the Examples menu and the Break it mistakes (ids from scripts/stats.ts). */
export const EXAMPLE_LABELS: Record<string, string> = {
  "missing-effect": "Missing effect",
  orders: "Customer ranking",
  "result-try": "Result and try",
  "incomplete-match": "Incomplete match",
};

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
  "&": { height: "100%", fontSize: "14px", backgroundColor: "transparent", color: "var(--ink)" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "23px" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--faint)" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--surface-2) 70%, transparent)" },
  ".cm-content": { caretColor: "var(--ink-strong)", padding: "12px 0" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--fix) 22%, transparent) !important" },
  "&.cm-focused": { outline: "none" },
  ".cm-diag": { textDecoration: "underline wavy var(--err)", textDecorationSkipInk: "none", textUnderlineOffset: "4px" },
});

/** Wavy red underlines at each diagnostic, from its column to the end of its line. */
const setDiagMarks = StateEffect.define<{ line: number; col: number }[]>();
const diagField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setDiagMarks)) continue;
      const marks: Range<Decoration>[] = [];
      for (const { line, col } of e.value) {
        if (line < 1 || line > tr.state.doc.lines) continue;
        const l = tr.state.doc.line(line);
        const from = Math.min(l.from + Math.max(col - 1, 0), l.to);
        if (from < l.to) marks.push(Decoration.mark({ class: "cm-diag" }).range(from, l.to));
      }
      deco = Decoration.set(marks, true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

type OutputLine = { kind: "out" | "err" | "note"; text: string };
type Tab = "problems" | "output";
type Example = { id: string; source: string };

function DiffView({ diff }: { diff: string }) {
  const lines = diff.replace(/\n$/, "").split("\n").filter((l) => !l.startsWith("--- ") && !l.startsWith("+++ "));
  return (
    <pre className="overflow-x-auto rounded-[10px] border border-rule bg-bg py-2 font-mono text-[13px] leading-[21px]">
      {lines.map((l, i) => (
        <div
          key={i}
          className={`px-3 ${l.startsWith("@@") ? "text-faint" : l.startsWith("-") ? "bg-err-bg text-err" : l.startsWith("+") ? "bg-fix-bg text-fix" : "text-muted"}`}
        >
          {l || " "}
        </div>
      ))}
    </pre>
  );
}

export function Playground({ examples, mistakes }: { examples: Example[]; mistakes: Example[] }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [source, setSource] = useState<string>("");
  const [diags, setDiags] = useState<Diagnostic[]>([]);
  const [checkedText, setCheckedText] = useState("");
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [running, setRunning] = useState(false);
  const [example, setExample] = useState(examples[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("problems");
  const [breakIndex, setBreakIndex] = useState(0);
  const worker = useRef<Worker | null>(null);

  const setEditorText = useCallback((text: string) => {
    const v = view.current;
    if (!v) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
  }, []);

  const showDiags = useCallback((text: string, ds: Diagnostic[]) => {
    setDiags(ds);
    setCheckedText(text);
    view.current?.dispatch({ effects: setDiagMarks.of(ds.map((d) => ({ line: d.line, col: d.col }))) });
  }, []);

  // editor setup; initial text from the URL hash, else the first example (a mistake to fix)
  useEffect(() => {
    if (!host.current) return;
    const shared = decodeSource(window.location.hash);
    const initial = shared ?? examples[0]?.source ?? "";
    if (shared !== null) setExample("");
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial,
        extensions: [
          basicSetup,
          canonLanguage,
          syntaxHighlighting(canonHighlight),
          theme,
          diagField,
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
      showDiags(source, r.diagnostics);
      if (r.diagnostics.length) setTab("problems");
      const hash = `#code=${encodeSource(source)}`;
      if (window.location.hash !== hash) history.replaceState(null, "", hash);
    }, 300);
    return () => clearTimeout(t);
  }, [source, showDiags]);

  const onFormat = () => {
    try {
      setEditorText(fmt(source));
    } catch (e) {
      if (e instanceof CanonError) {
        showDiags(source, [e.diag]);
        setTab("problems");
      } else throw e;
    }
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
    showDiags(source, c.check.diagnostics);
    if (!c.js) {
      setOutput([{ kind: "err", text: "The program has problems; fix them before running." }]);
      setTab("problems");
      return;
    }
    const lines: OutputLine[] = [];
    setOutput([]);
    setTab("output");
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
        if (r.trap.code === "R006") lines.push({ kind: "note", text: "File and network access are off in the browser. Run this program with the canon CLI." });
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

  const load = (text: string) => {
    setEditorText(text);
    setOutput([]);
    setTab("problems");
  };

  const onExample = (id: string) => {
    setExample(id);
    const ex = examples.find((e) => e.id === id);
    if (ex) load(ex.source);
  };

  // Break it: put back the next common mistake, so a fix appears for each kind
  const onBreak = () => {
    if (!mistakes.length) return;
    const m = mistakes[breakIndex % mistakes.length];
    setBreakIndex(breakIndex + 1);
    setExample(examples.some((e) => e.id === m.id) ? m.id : "");
    load(m.source);
  };

  const btn =
    "inline-flex h-9 items-center rounded-[10px] border border-rule-strong px-3.5 text-[14px] font-medium text-ink transition-colors hover:border-faint hover:text-ink-strong disabled:opacity-50";
  const stale = checkedText !== source;

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-3 px-4 py-4 md:px-6">
      <h1 className="sr-only">Canon playground</h1>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[14px] text-muted">
          <span className="font-mono text-[13px] text-faint">Example</span>
          <select
            className="h-9 rounded-[10px] border border-rule-strong bg-surface px-2.5 text-[14px] text-ink"
            value={example}
            onChange={(e) => onExample(e.target.value)}
            aria-label="Examples"
          >
            <option value="" disabled>
              Your code
            </option>
            {examples.map((e) => (
              <option key={e.id} value={e.id}>
                {EXAMPLE_LABELS[e.id] ?? e.id}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className={btn} onClick={onBreak}>
            Break it
          </button>
          <button type="button" className={btn} onClick={onFormat}>
            Format
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-[10px] bg-ink px-4 text-[14px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            onClick={onRun}
            disabled={running}
          >
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      <div className="grid min-h-[72vh] flex-1 gap-3 lg:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <div className="flex min-h-[50vh] flex-col overflow-hidden rounded-[14px] border border-rule-strong bg-surface">
          <div className="flex h-11 items-center border-b border-rule-strong bg-surface-2 px-4 font-mono text-[13px] text-faint">main.cn</div>
          <div ref={host} className="min-h-0 flex-1 overflow-hidden" data-testid="editor" />
        </div>

        <section className="flex min-h-[40vh] flex-col overflow-hidden rounded-[14px] border border-rule-strong bg-surface" aria-label="Results">
          <div className="flex h-11 items-end gap-1 border-b border-rule-strong bg-surface-2 px-2" role="tablist">
            {(["problems", "output"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex h-full items-center gap-2 border-b-2 px-3 text-[14px] ${tab === t ? "border-ink-strong text-ink-strong" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t === "problems" ? "Problems" : "Output"}
                {t === "problems" ? (
                  <span
                    className={`rounded-full px-1.5 font-mono text-[12px] ${diags.length ? "bg-err-bg text-err" : "bg-surface text-faint"}`}
                    data-testid="problem-count"
                  >
                    {diags.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className={`min-h-0 flex-1 overflow-auto ${tab === "problems" ? "" : "hidden"}`} data-testid="diagnostics" role="tabpanel">
            {diags.length === 0 ? (
              <p className="flex items-center gap-2 p-4 text-[14px] text-muted">
                <span className="size-1.5 rounded-full bg-fix" aria-hidden />
                No problems.
              </p>
            ) : (
              <ul>
                {diags.map((d, i) => (
                  <li key={i} className="border-b border-rule p-4 last:border-none">
                    <div className="flex items-start gap-3 text-[14px] leading-[22px]">
                      <span className="font-mono text-[13px] text-err">{d.code}</span>
                      <span className="flex-1 text-ink">{d.message}</span>
                      <span className="font-mono text-[13px] text-faint">
                        {d.line}:{d.col}
                      </span>
                    </div>
                    {d.code === "H001" && (d.data as { candidates?: string[] } | undefined)?.candidates?.length ? (
                      <div className="mt-2 font-mono text-[13px] text-muted">{(d.data as { candidates: string[] }).candidates.join(" · ")}</div>
                    ) : null}
                    {d.fix ? (
                      <div className="mt-3 space-y-3">
                        <DiffView diff={d.fix.diff} />
                        <button
                          type="button"
                          className="inline-flex h-9 items-center rounded-[10px] bg-ink px-3.5 text-[14px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                          onClick={() => onApply(d)}
                          disabled={stale}
                        >
                          Apply fix
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <pre
            className={`min-h-0 flex-1 overflow-auto p-4 font-mono text-[14px] leading-[23px] ${tab === "output" ? "" : "hidden"}`}
            data-testid="output"
            role="tabpanel"
          >
            {output.length === 0 ? <span className="text-faint">Press Run to see the output.</span> : null}
            {output.map((l, i) => (
              <div key={i} className={l.kind === "err" ? "text-err" : l.kind === "note" ? "text-faint" : "text-ink"}>
                {l.text}
              </div>
            ))}
          </pre>
        </section>
      </div>
      <p className="text-[13px] text-faint">Runs in your browser. File and network access are off. The URL saves your code.</p>
    </main>
  );
}
