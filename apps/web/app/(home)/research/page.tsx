import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DistinctChart } from "@/components/site/distinct-chart";
import { SiteFooter } from "@/components/site/footer";
import { blob, commit, tree } from "@/lib/shared";
import { fmtNumber, siteData, type SiteData } from "@/lib/site";

export const metadata: Metadata = {
  title: "Research",
  description: "Does a stricter language make agents better? Pre-registered benchmark and likelihood results for Canon, including what did not hold up.",
};

const { benchmark: v02, benchmarkV0: v0, likelihood, display: d } = siteData;
type Verdict = SiteData["benchmark"]["verdicts"][number];

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const dec = (x: number) => x.toFixed(2);
const times = (x: number) => `${x.toFixed(1)}x`;
/** 1/ratio as "N times less likely", two significant figures */
const lessLikely = (ratio: number) => fmtNumber(Number((1 / ratio).toPrecision(2)));

/** Plain-language names for the pre-registered criteria (ids and verdicts come from the reports). */
const QUESTION: Record<string, string> = {
  C1: "Agents learn Canon from the reference alone",
  C2: "Agents write correct Canon, including on hard tasks",
  C3: "Agents converge: at most half as many distinct programs as TypeScript",
  C3s: "The same, counting program structure only",
  C4: "Agents need no more tries than in TypeScript",
  C5: "Canon programs run faster",
  C6: "Cost per working program within 1.5x of TypeScript",
  D1: "v0.2 converges better than v0",
  D1s: "The same, counting program structure only",
};

/** `code` spans in plain text */
function Ticks({ text }: { text: string }) {
  return (
    <>
      {text.split(/`([^`]+)`/).map((part, i) =>
        i % 2 ? (
          <code key={i} className="font-mono text-[13px] text-ink-strong">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Pill({ v }: { v: Verdict["verdict"] }) {
  const cls =
    v === "SUPPORTED" ? "border-fix/40 bg-fix-bg text-fix" : v === "NOT SUPPORTED" ? "border-err/40 bg-err-bg text-err" : "border-rule-strong bg-surface-2 text-muted";
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[12px] ${cls}`}>{v}</span>;
}

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink-strong md:text-[34px]">
      {children}
    </h2>
  );
}

function Block({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-rule">
      <div className="frame px-6 py-16 md:py-20">
        <div className="mx-auto max-w-[860px] [&>*]:min-w-0">{children}</div>
      </div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[16px] leading-[27px] text-muted">{children}</p>;
}

function Table({ head, rows, testId }: { head: ReactNode[]; rows: ReactNode[][]; testId?: string }) {
  return (
    <div className="mt-8 overflow-x-auto rounded-[14px] border border-rule-strong bg-surface">
      <table className="w-full min-w-[560px] text-left text-[14px]" data-testid={testId}>
        <thead>
          <tr className="border-b border-rule font-mono text-[13px] text-faint">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-rule align-top last:border-none">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? "text-ink" : "text-muted"}`}>
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

function VerdictTable({ b, testId }: { b: typeof v02; testId?: string }) {
  return (
    <Table
      testId={testId}
      head={["", "Criterion", ...b.models, "Verdict"]}
      rows={b.verdicts.map((v) => [
        <span key="id" className="font-mono text-faint">
          {v.id}
        </span>,
        QUESTION[v.id] ?? v.name,
        ...v.perModel.map((p, i) => (
          <span key={i} className="font-mono text-[13px]">
            {p.detail}
          </span>
        )),
        <Pill key="v" v={v.verdict} />,
      ])}
    />
  );
}

const claude = (b: typeof v02) => b.byModel.find((m) => m.canon.costPerCorrect !== null);
const task = (b: typeof v02, id: string) => b.taskRows.find((t) => t.task === id)!;
const firstModel = v02.models[0];
const applyOps = task(v0, "apply_ops").distinct[firstModel];
const sumEvens = task(v0, "sum_evens").distinct[firstModel];
const fewerSameMore = v02.byModel.map((m) => {
  const pairs = v02.taskRows.map((t) => t.distinct[m.model]);
  return {
    model: m.model,
    fewer: pairs.filter((p) => p.canon < p.typescript).length,
    same: pairs.filter((p) => p.canon === p.typescript).length,
    more: pairs.filter((p) => p.canon > p.typescript).length,
  };
});
const supported = v02.verdicts.filter((v) => v.verdict === "SUPPORTED").map((v) => v.id);
const notSupported = v02.verdicts.filter((v) => v.verdict === "NOT SUPPORTED").map((v) => v.id);
const priced = claude(v02)!;
const pricedV0 = claude(v0)!;

export default function Research() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-rule">
        <div className="frame px-6 pb-16 pt-[72px] md:pt-[104px]">
          <div className="mx-auto max-w-[860px]">
            <p className="mb-4 font-mono text-[13px] text-faint">Research</p>
            <h1 className="text-[clamp(36px,5vw,56px)] font-semibold leading-[1.05] tracking-[-0.04em] text-ink-strong">
              Does a stricter language make agents better? What we found.
            </h1>
            <p className="mt-6 text-[18px] leading-[29px] text-muted">
              Canon removes choices a programmer would normally make, on the bet that agents then write more reliable and more consistent code. We test that bet
              against TypeScript with success criteria{" "}
              <a href={commit("2765a35")} className="text-ink underline underline-offset-4">
                committed before any data existed
              </a>{" "}
              (and again for v0.2, in{" "}
              <a href={commit("d55b804")} className="text-ink underline underline-offset-4">
                d55b804
              </a>
              ), then publish every verdict, including the misses.
            </p>
            <dl className="mt-10 grid gap-px overflow-hidden rounded-[14px] border border-rule bg-rule sm:grid-cols-3">
              {[
                ["Runs per study", d.runs],
                ["Tasks", `${d.tasks} (${d.hardTasks} hard)`],
                ["Models", d.models],
              ].map(([k, v]) => (
                <div key={k} className="bg-bg px-5 py-4">
                  <dt className="font-mono text-[13px] text-faint">{k}</dt>
                  <dd className="mt-1 break-words text-[15px] text-ink-strong">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <Block id="verdicts">
        <H2 id="verdicts-h">The verdicts.</H2>
        <P>
          Canon v0.2, {d.runs} runs. Supported: {supported.join(", ")}. Not supported: {notSupported.join(", ")}. Agents write Canon as correctly and in as few
          tries as TypeScript. They do not yet write it more consistently, and it costs more.
        </P>
        <VerdictTable b={v02} testId="verdicts" />
        <details className="mt-6 text-[14px] text-muted">
          <summary className="cursor-pointer text-ink">The earlier run: Canon v0, {d.v0Runs} runs</summary>
          <VerdictTable b={v0} />
        </details>
      </Block>

      <Block id="consistency">
        <H2 id="consistency-h">Consistency did not improve.</H2>
        <P>
          Each task ran {d.runsPerTask} times per model and language. After formatting, we counted how many different programs came out. Canon wrote about as many
          as TypeScript in both versions, and the v0.2 changes did not move it.
        </P>
        <div className="mt-8 rounded-[14px] border border-rule-strong bg-surface p-5">
          <DistinctChart v02={v02} v0={v0} />
        </div>
        <Table
          head={["Model", "Language", "Correct", "Valid first try", "Tries to working code", "Distinct per task [95% CI]"]}
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
      </Block>

      <Block id="why">
        <H2 id="why-h">Why consistency did not improve.</H2>
        <P>These readings come from looking at the programs after the data was in, so they are hypotheses for the next study, not findings.</P>
        <ol className="mt-6 space-y-5 text-[16px] leading-[27px] text-muted">
          <li>
            <strong className="font-semibold text-ink">The comparison is fair on layout.</strong> TypeScript runs were formatted with Prettier before counting, the way
            Canon is formatted by its compiler. Canon&apos;s single layout earns no advantage here by design; what is left is program structure.
          </li>
          <li>
            <strong className="font-semibold text-ink">Missing constructs push models to improvise.</strong> Canon has no <code className="font-mono text-[14px] text-ink">break</code>. On{" "}
            <code className="font-mono text-[14px] text-ink">apply_ops</code>, which wants one, {firstModel} wrote {applyOps.canon} different Canon programs in v0
            against {applyOps.typescript} in TypeScript: each run invented its own workaround.
          </li>
          <li>
            <strong className="font-semibold text-ink">Some choices no grammar can fix.</strong> Helper function names and optional contracts multiply otherwise
            identical programs. Most of the remaining variation is in how a model breaks a problem into functions.
          </li>
        </ol>
        <P>
          Where a task fits Canon&apos;s constructs directly, runs do converge: <code className="font-mono text-[14px] text-ink">sum_evens</code> came out as{" "}
          {sumEvens.canon === 1 ? "the same program" : `${sumEvens.canon} programs`} in all {d.runsPerTask} {firstModel} runs, against {sumEvens.typescript} in
          TypeScript. Across all tasks in v0.2,{" "}
          {fewerSameMore.map((f, i) => (
            <span key={f.model}>
              {i > 0 ? "; " : ""}
              {f.model} wrote fewer distinct Canon programs on {f.fewer} tasks, as many on {f.same}, and more on {f.more}
            </span>
          ))}
          .
        </P>
      </Block>

      <Block id="likelihood">
        <H2 id="likelihood-h">What models find natural.</H2>
        <P>
          A second study scored equivalent spellings of the same program by how likely an open-weights code model finds them ({likelihood.models.join(" and ")}).
          These are the constructs where every model preferred something other than Canon&apos;s original spelling, and what v0.2 changed in response.
        </P>
        <Table
          testId="likelihood"
          head={["Construct", "Canon v0", "Preferred", ...likelihood.models.map((m) => `${m.split("/").pop()}: v0 is less likely by`), "In v0.2"]}
          rows={likelihood.rows.map((r) => [
            <Ticks key="q" text={r.question.replace(/\s*\(open question.*\)\s*$/, "")} />,
            <span key="c" className="font-mono text-[13px]">
              {r.canonSpelling}
            </span>,
            <span key="p" className="font-mono text-[13px]">
              {r.preferred}
            </span>,
            ...r.byModel.map((m) => (
              <span key={m.model} className="font-mono text-[13px]">
                {lessLikely(m.ratio)}x
              </span>
            )),
            r.adopted ? <span key="a" className="text-fix">Adopted</span> : <span key="a">Unchanged</span>,
          ])}
        />
        <P>
          After adopting them, first-try validity{" "}
          {v02.byModel.map((m, i) => {
            const before = v0.byModel.find((x) => x.model === m.model)!.canon.firstPass;
            return (
              <span key={m.model}>
                {i > 0 ? " and " : ""}
                {m.canon.firstPass >= before ? "rose" : "fell"} for {m.model} ({pct(before)} to {pct(m.canon.firstPass)})
              </span>
            );
          })}
          , and consistency did not change (D1 above). &ldquo;Adopted&rdquo; is decided by the
          formatter: the v0 spelling now formats to the preferred one.
        </P>
      </Block>

      <Block id="cost">
        <H2 id="cost-h">What it costs.</H2>
        <P>
          Canon runs carry the language reference in every prompt, and Canon answers are longer. In v0.2, a working Canon program used {d.tokenMultipleRange} the tokens
          of a TypeScript one, took {d.timeMultipleRange} as long, and, with prompt caching, cost {times(priced.canon.costPerCorrect! / priced.typescript.costPerCorrect!)}{" "}
          as much for {priced.model} (v0: {times(pricedV0.canon.costPerCorrect! / pricedV0.typescript.costPerCorrect!)}).
        </P>
        <P>
          Trimming the reference between v0 and v0.2 saved almost nothing, because cached prompt tokens are cheap. Most of the cost is output: Canon answers averaged{" "}
          {d.outputTokensCanon} output tokens against {d.outputTokensTs} for TypeScript. Shorter answers are the lever, not a shorter reference.
        </P>
      </Block>

      <Block id="next">
        <H2 id="next-h">What comes next.</H2>
        <P>
          Correctness and the write, check and fix loop hold up on these tasks:{" "}
          {d.failedFirst === d.fixedInOne
            ? `every failed first draft (${d.failedFirst} of ${d.canonRuns} in v0.2) passed after one round of applying the compiler's patch.`
            : `${d.fixedInOne} of ${d.failedFirst} failed first drafts passed after one round of applying the compiler's patch.`}{" "}
          Consistency and cost remain open. Canon reports the consistency bet as a hypothesis, not a result, and every
          change aimed at it gets its own pre-registration, committed before its run.
        </P>
        <ul className="mt-8 grid gap-px overflow-hidden rounded-[14px] border border-rule bg-rule text-[15px] sm:grid-cols-2">
          {[
            ["v0.2 report", blob("research/benchmark/REPORT-v0.2.md")],
            ["v0.2 pre-registration", blob("research/benchmark/PREREGISTRATION-v0.2.md")],
            ["v0 report", blob("research/benchmark/REPORT.md")],
            ["v0 pre-registration", blob("research/benchmark/PREREGISTRATION.md")],
            ["Raw runs (JSON lines)", tree("research/benchmark/results")],
            ["Benchmark harness and tasks", tree("research/benchmark/src")],
            ["Likelihood study", blob("research/likelihood/REPORT.md")],
            ["Design notes", "/docs/design-notes"],
          ].map(([label, href]) => (
            <li key={label} className="bg-bg">
              {href.startsWith("/") ? (
                <Link href={href} className="block px-5 py-4 text-ink transition-colors hover:text-ink-strong">
                  {label} →
                </Link>
              ) : (
                <a href={href} className="block px-5 py-4 text-ink transition-colors hover:text-ink-strong">
                  {label} →
                </a>
              )}
            </li>
          ))}
        </ul>
      </Block>

      <SiteFooter />
    </main>
  );
}
