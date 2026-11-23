import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DistinctChart } from "@/components/site/distinct-chart";
import { SiteFooter } from "@/components/site/footer";
import { blob, tree } from "@/lib/shared";
import { fmtNumber, siteData, type SiteData } from "@/lib/site";

export const metadata: Metadata = {
  title: "Research",
  description: "Agents write Canon as reliably as TypeScript. Not more consistently, yet. Two pre-registered studies, with every verdict published.",
};

const { benchmark: v02, benchmarkV0: v0, likelihood, display: d } = siteData;
type Verdict = SiteData["benchmark"]["verdicts"][number];

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const dec = (x: number) => x.toFixed(2);
const WORDS = ["zero", "one", "two", "three", "four", "five"];
const countWord = (n: number) => WORDS[n] ?? fmtNumber(n);
const capitalized = (s: string) => s[0].toUpperCase() + s.slice(1);
/** 1/ratio as "N× less likely", two significant figures */
const lessLikely = (ratio: number) => `${fmtNumber(Number((1 / ratio).toPrecision(2)))}×`;

// the examples quoted under "What we learned": the latest study, first model
const exampleModel = v02.models[0];
const taskDistinct = (id: string) => v02.taskRows.find((t) => t.task === id)!.distinct[exampleModel];
const applyOps = taskDistinct("apply_ops");
const sumEvens = taskDistinct("sum_evens");

/** Plain-language spellings for the likelihood constructs (ids and verdicts come from the data). */
const SPELLING: Record<string, { construct: string; v0: ReactNode; preferred: ReactNode }> = {
  "while-loop": { construct: "Condition loop", v0: <C>{"for cond { }"}</C>, preferred: <C>{"while cond { }"}</C> },
  mutation: { construct: "Mutable assignment", v0: <C>set x = ...</C>, preferred: <C>x = ...</C> },
  "string-join": { construct: "Joining strings", v0: <C>concat(a, b)</C>, preferred: <C>a + b</C> },
  "logic-words": {
    construct: "Logical operators",
    v0: (
      <>
        <C>and</C> / <C>or</C> / <C>not</C>
      </>
    ),
    preferred: (
      <>
        <C>&amp;&amp;</C> / <C>||</C> / <C>!</C>
      </>
    ),
  },
  "effects-placement": { construct: "Effects clause", v0: "On its own line", preferred: <>Inline, before <C>{"{"}</C></> },
  "trailing-comma": { construct: "Record fields", v0: "Trailing comma", preferred: "No trailing comma" },
};
const COMPACT = ["while-loop", "mutation", "string-join", "logic-words"];

/** The pre-registered criteria as short claims (codes and verdicts come from the reports). */
const CLAIM: Record<string, string> = {
  C1: "Correct at least as often as TypeScript, within 5 points",
  C2: "At least 90% correct overall and 80% on hard tasks",
  C3: "At most half as many distinct programs as TypeScript",
  C3s: "The same, counting program structure only",
  C4: "No more tries to working code than TypeScript, within 0.25",
  C5: "Programs run faster",
  C6: "Cost per working program within 1.5× of TypeScript",
  D1: "v0.2 more consistent than v0",
  D1s: "The same, counting program structure only",
};

function C({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.92em] text-ink-strong">{children}</code>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink-strong md:text-[32px]">{children}</h2>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-10 text-[18px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink-strong">{children}</h3>;
}

function P({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-4 text-[17px] leading-[28px] text-muted ${className}`}>{children}</p>;
}

/** A page section: a full-width rule above, content in the 720px article column (or 960px when wide). */
function Section({ children, wide = false, id }: { children: ReactNode; wide?: boolean; id?: string }) {
  return (
    <section id={id} className="border-b border-rule">
      <div className="frame px-6 py-14 md:py-16">
        <div className={`mx-auto ${wide ? "max-w-[960px]" : "max-w-[720px]"} [&>*]:min-w-0`}>{children}</div>
      </div>
    </section>
  );
}

function Status({ held }: { held: boolean }) {
  return held ? (
    <span className="font-mono text-[13px] font-medium text-fix">✓ Held up</span>
  ) : (
    <span className="font-mono text-[13px] font-medium text-err">✗ Not yet</span>
  );
}

function Pill({ v }: { v: Verdict["verdict"] }) {
  const cls =
    v === "SUPPORTED" ? "border-fix/40 bg-fix-bg text-fix" : v === "NOT SUPPORTED" ? "border-err/40 bg-err-bg text-err" : "border-rule-strong bg-surface-2 text-faint";
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[12px] ${cls}`}>{v}</span>;
}

function Table({ head, rows, numeric = [], testId, caption }: { head: ReactNode[]; rows: ReactNode[][]; numeric?: number[]; testId?: string; caption?: string }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-[12px] border border-rule-strong bg-surface">
      <table className="w-full min-w-[560px] text-left text-[14px] [font-variant-numeric:tabular-nums]" data-testid={testId}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-rule font-mono text-[12px] text-faint">
            {head.map((h, i) => (
              <th key={i} scope="col" className={`px-4 py-3 font-normal ${numeric.includes(i) ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-rule align-top last:border-none">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? "text-ink" : "text-muted"} ${numeric.includes(j) ? "text-right" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FINDINGS: { held: boolean; number: string; title: string; body: ReactNode }[] = [
  {
    held: true,
    number: d.canonCorrect,
    title: "Correct",
    body: <>Every Canon program worked, same as TypeScript, including the {d.hardTasks} hard tasks.</>,
  },
  {
    held: true,
    number: `${d.fixedInOne} of ${d.failedFirst}`,
    title: "Self-correcting",
    body: <>Every failed first draft passed after applying the compiler&apos;s patch once.</>,
  },
  {
    held: false,
    number: `${d.canonDistinct1} vs ${d.tsDistinct1}`,
    title: "Consistency",
    body: <>Agents wrote about as many different programs per task in Canon as in TypeScript. Changing the syntax in v0.2 didn&apos;t move it.</>,
  },
  {
    held: false,
    number: d.costMultiple,
    title: "Cost",
    body: <>A working Canon program cost more than a TypeScript one, mostly because Canon answers are longer.</>,
  },
];

const LINKS: { label: string; desc: string; href: string }[] = [
  { label: "Raw runs", desc: "Every run as JSON lines", href: tree("research/benchmark/results") },
  { label: "Harness and tasks", desc: `The benchmark code and all ${d.tasks} tasks`, href: tree("research/benchmark/src") },
  { label: "v0.2 report", desc: "Verdicts and metrics for the latest study", href: blob("research/benchmark/REPORT-v0.2.md") },
  { label: "v0.2 pre-registration", desc: "The criteria, committed before the run", href: blob("research/benchmark/PREREGISTRATION-v0.2.md") },
  { label: "v0 report", desc: "Verdicts and metrics for the first study", href: blob("research/benchmark/REPORT.md") },
  { label: "v0 pre-registration", desc: "The criteria, committed before the run", href: blob("research/benchmark/PREREGISTRATION.md") },
  { label: "Likelihood study", desc: "Method, scores and models", href: blob("research/likelihood/REPORT.md") },
  { label: "CanonBench report", desc: "Scoreboard, ablation, costs and misses", href: blob("research/canonbench/REPORT.md") },
  { label: "CanonBench pre-registration", desc: "Committed before the main run", href: blob("research/canonbench/PREREGISTRATION.md") },
  { label: "Design notes", desc: "Why Canon is built this way", href: "/docs/design-notes" },
];

export default function Research() {
  return (
    <main className="flex flex-1 flex-col">
      {/* 1. Header */}
      <section className="border-b border-rule">
        <div className="frame px-6 pb-14 pt-[72px] md:pt-[104px]">
          <div className="mx-auto max-w-[720px]">
            <p className="font-mono text-[13px] text-faint">Research · Updated {d.lastStudyDate}</p>
            <h1 className="mt-4 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.04em] text-ink-strong">
              Agents write Canon as reliably as TypeScript. Not more consistently, yet.
            </h1>
            <p className="mt-6 text-[20px] leading-[31px] text-muted">
              We tested Canon against TypeScript in two pre-registered studies, with the success criteria committed before any data was collected. Here&apos;s what
              held up and what didn&apos;t.
            </p>
            <p className="mt-6 font-mono text-[13px] text-faint" data-testid="research-meta">
              {fmtNumber(v02.runs + v0.runs)} runs · {d.tasks} tasks · {d.modelCount} models · criteria committed before each run
            </p>
          </div>
        </div>
      </section>

      {/* 2. Findings */}
      <Section wide>
        <h2 className="sr-only">Findings</h2>
        <ul className="grid gap-px overflow-hidden rounded-[14px] border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4" data-testid="findings">
          {FINDINGS.map((f) => (
            <li key={f.title} className="flex flex-col bg-bg p-6">
              <Status held={f.held} />
              <p className="mt-4 font-mono text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink-strong [font-variant-numeric:tabular-nums]">
                {f.number}
              </p>
              <h3 className="mt-3 text-[16px] font-semibold text-ink-strong">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-[23px] text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 3. The chart */}
      <Section wide id="consistency">
        <div className="mx-auto max-w-[720px]">
          <H2>Consistency didn&apos;t improve.</H2>
        </div>
        <div className="mt-8 rounded-[14px] border border-rule-strong bg-surface p-5 md:p-7">
          <DistinctChart v02={v02} v0={v0} />
        </div>
      </Section>

      {/* 4. How we tested */}
      <Section id="method">
        <H2>How we tested.</H2>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-[17px] leading-[28px] text-muted marker:text-faint">
          <li>
            {d.tasks} tasks, {d.hardTasks} of them hard, each run {d.runsPerTask} times per model and language.
          </li>
          <li>
            {capitalized(countWord(v02.models.length))} frontier models:{" "}
            {v02.models.map((m, i) => (
              <span key={m}>
                {i > 0 ? (i === v02.models.length - 1 ? " and " : ", ") : ""}
                <C>{m}</C>
              </span>
            ))}
            .
          </li>
          <li>Canon prompts include the language reference; TypeScript prompts don&apos;t need one.</li>
          <li>Two programs count as the same if they match after formatting (Canon&apos;s formatter, Prettier for TypeScript).</li>
          <li>Success criteria were committed to the repo before each run, and every verdict is published.</li>
        </ul>
      </Section>

      {/* 5. What we learned */}
      <Section id="learned">
        <H2>What we learned.</H2>
        <P>These come from reading the programs after the runs, so they are hypotheses for the next study.</P>

        <H3>Missing features make agents improvise.</H3>
        <P>
          Canon has no <C>break</C>. On <C>apply_ops</C>, a task that wants one, <C>{exampleModel}</C> wrote {applyOps.canon} different Canon programs against{" "}
          {applyOps.typescript} in TypeScript; each run invented its own workaround. Where a task fits Canon directly, runs converge: <C>sum_evens</C> came out
          identical in all {d.runsPerTask} runs, against {sumEvens.typescript} variants in TypeScript.
        </P>

        <H3>Grammar can&apos;t fix naming.</H3>
        <P>
          Most remaining variation is in how a model splits a problem into functions and what it names them. A stricter syntax doesn&apos;t touch either.
        </P>

        <H3>Natural syntax didn&apos;t help consistency.</H3>
        <P>
          A likelihood study found three spellings models strongly prefer: <C>while</C>, plain <C>x = ...</C>, and <C>a + b</C> for strings. v0.2 adopted all three.
          First-try validity went up for one model and down for the other, and consistency didn&apos;t change.
        </P>
        <Table
          testId="likelihood-compact"
          caption="Spellings models prefer, and whether v0.2 adopted them"
          head={["Construct", "Canon v0", "Models prefer", "In v0.2"]}
          rows={COMPACT.map((id) => likelihood.rows.find((r) => r.id === id))
            .filter((r): r is NonNullable<typeof r> => Boolean(r))
            .map((r) => [
              SPELLING[r.id].construct,
              SPELLING[r.id].v0,
              SPELLING[r.id].preferred,
              r.adopted ? <span key="a" className="text-fix">Adopted</span> : <span key="a">Unchanged</span>,
            ])}
        />

        <H3>Cost is in the output, not the prompt.</H3>
        <P>
          Trimming the reference saved almost nothing, because cached prompt tokens are cheap. Canon answers averaged {d.outputTokensCanon} output tokens against{" "}
          {d.outputTokensTs} for TypeScript. Shorter answers are the lever.
        </P>
      </Section>

      {/* CanonBench, November 2026 (numbers live in the report, generated from the raw runs) */}
      <Section id="canonbench">
        <H2>CanonBench, November 2026.</H2>
        <P>
          A pre-registered benchmark of what agents do with code: read it, write it, fix it, change it, and write Canon to ship
          Python. It ran overnight against Python and TypeScript with GPT-6.2 Sol, Claude Opus 5.5 and Qwen2.5-Coder 7B.
        </P>
        <P>
          GPT-6.2 Sol answered questions about Canon programs more accurately than about Python or TypeScript ones, mostly on
          which functions can touch the network, files, the clock or randomness. Removing Canon&apos;s annotations did not
          change that. On writing, fixing and changing code it scored the same in every language, at the ceiling. The small local
          model lost in every writing task: it wrote Rust-like code instead of Canon, and the compiler&apos;s feedback did not
          fix that. Canon also cost several times the tokens of Python or TypeScript, because its reference goes in every prompt.
          Claude Opus 5.5 stopped after the reading questions when its credit ran out, so the overall verdict is undecided. The
          report gives every interval, loss and miss.
        </P>
      </Section>

      {/* 6. What's next */}
      <Section id="next">
        <H2>What&apos;s next.</H2>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-[17px] leading-[28px] text-muted marker:text-faint">
          <li>
            Add an early loop exit and test whether <C>apply_ops</C>-style tasks converge.
          </li>
          <li>Test whether a tighter answer format cuts output tokens and cost.</li>
          <li>Every change gets its own pre-registration, committed before its run.</li>
        </ul>
      </Section>

      {/* 7. Data and code */}
      <Section id="data">
        <H2>Data and code.</H2>
        <ul className="mt-6 grid gap-px overflow-hidden rounded-[14px] border border-rule bg-rule sm:grid-cols-2">
          {LINKS.map((l) => {
            const inner = (
              <>
                <span className="block text-[15px] font-medium text-ink-strong">{l.label} →</span>
                <span className="mt-1 block text-[14px] text-muted">{l.desc}</span>
              </>
            );
            const cls = "block h-full px-5 py-4 transition-colors hover:bg-surface";
            return (
              <li key={l.label} className="bg-bg">
                {l.href.startsWith("/") ? (
                  <Link href={l.href} className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <a href={l.href} className={cls}>
                    {inner}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 8. Appendix */}
      <Section id="appendix">
        <details className="group" data-testid="appendix">
          <summary className="cursor-pointer select-none text-[17px] font-medium text-ink-strong">Full verdicts and metrics</summary>

          <h3 className="mt-8 text-[16px] font-semibold text-ink-strong">Verdicts, v0.2</h3>
          <Table
            testId="verdicts"
            caption="Pre-registered criteria and verdicts for the v0.2 study"
            head={["Criterion", ...v02.models, "Verdict"]}
            rows={v02.verdicts.map((v) => [
              <span key="c">
                <span className="font-mono text-faint">{v.id}</span> · {CLAIM[v.id] ?? v.name}
              </span>,
              ...v.perModel.map((p, i) => (
                <span key={i} className="font-mono text-[13px]">
                  {p.detail}
                </span>
              )),
              <Pill key="v" v={v.verdict} />,
            ])}
          />

          <h3 className="mt-10 text-[16px] font-semibold text-ink-strong">Metrics</h3>
          <Table
            testId="metrics"
            caption="Metrics by model, language and version"
            numeric={[2, 3, 4, 5]}
            head={["Model", "Language", "Correct", "Valid first try", "Tries to working code", "Distinct per task [95% interval]"]}
            rows={v02.byModel.flatMap((m) => {
              const old = v0.byModel.find((x) => x.model === m.model)!;
              return (
                [
                  ["Canon v0.2", m.canon],
                  ["Canon v0", old.canon],
                  ["TypeScript", m.typescript],
                ] as const
              ).map(([lang, a]) => [
                <span key="m" className="font-mono text-[13px]">
                  {m.model}
                </span>,
                lang,
                pct(a.correct),
                pct(a.firstPass),
                dec(a.turns),
                <span key="d" className="font-mono text-[13px]">
                  {dec(a.distinct)} [{dec(a.distinctLo)}, {dec(a.distinctHi)}]
                </span>,
              ]);
            })}
          />

          <h3 className="mt-10 text-[16px] font-semibold text-ink-strong">Likelihood study</h3>
          <Table
            testId="likelihood"
            caption="Constructs where every model preferred another spelling, with how much less likely Canon's v0 spelling was"
            numeric={likelihood.models.map((_, i) => 3 + i)}
            head={["Construct", "Canon v0", "Models prefer", ...likelihood.models.map((m) => `${m.split("/").pop()}: v0 less likely by`), "In v0.2"]}
            rows={likelihood.rows.map((r) => [
              SPELLING[r.id]?.construct ?? r.question,
              SPELLING[r.id]?.v0 ?? <C key="c">{r.canonSpelling}</C>,
              SPELLING[r.id]?.preferred ?? <C key="p">{r.preferred}</C>,
              ...r.byModel.map((m) => (
                <span key={m.model} className="font-mono text-[13px]">
                  {lessLikely(m.ratio)}
                </span>
              )),
              r.adopted ? <span key="a" className="text-fix">Adopted</span> : <span key="a">Unchanged</span>,
            ])}
          />
          <p className="mt-4 text-[14px] text-faint">
            Scored with {likelihood.models.join(" and ")}. &ldquo;Adopted&rdquo; is decided by the formatter: the v0 spelling now formats to the preferred one.
          </p>
        </details>
      </Section>

      <SiteFooter />
    </main>
  );
}
