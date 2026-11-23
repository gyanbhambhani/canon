import Link from "next/link";
import type { ReactNode } from "react";
import { CanonCode } from "@/components/canon-code";
import { CopyButton } from "@/components/site/copy-button";
import { SiteFooter } from "@/components/site/footer";
import { icons } from "@/components/site/icons";
import { Terminal } from "@/components/site/terminal";
import { Window } from "@/components/site/window";
import { AGENTS_MD, INSTALL_CMD } from "@/lib/agents";
import { githubUrl, subhead, tagline } from "@/lib/shared";
import { playHref } from "@/lib/share";
import { siteData } from "@/lib/site";

const { display: d, benchmark, terminal, ordersSnippet } = siteData;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className="border-b border-rule">
      <div className={`frame px-6 py-[88px] md:py-[104px] ${className}`}>{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-4 font-mono text-[13px] text-faint">{children}</p>;
}

function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink-strong md:text-[44px] md:leading-[48px] ${className}`}>{children}</h2>;
}

function Button({ href, children, primary = false, size = "lg" }: { href: string; children: ReactNode; primary?: boolean; size?: "lg" | "sm" }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-[10px] px-5 text-[15px] font-medium transition-colors ${size === "lg" ? "h-12" : "h-9"} ${
    primary ? "bg-ink text-bg hover:opacity-90" : "border border-rule-strong text-ink hover:border-faint hover:text-ink-strong"
  }`;
  return href.startsWith("http") ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls} prefetch={href === "/play" ? false : undefined}>
      {children}
    </Link>
  );
}

const FEATURES: { icon: ReactNode; title: string; body: ReactNode }[] = [
  {
    icon: icons.prompt,
    title: "Fits in a prompt",
    body: <>The whole language reference is {d.referenceTokens} tokens. Agents load it with every request. No fine-tuning.</>,
  },
  {
    icon: icons.patch,
    title: "Errors ship with fixes",
    body: <>Diagnostics are JSON with a patch attached. Agents apply it as-is instead of guessing.</>,
  },
  {
    icon: icons.effects,
    title: "Effects in the signature",
    body: <>Network, files, time and randomness must be declared. Everything else is pure by default.</>,
  },
  {
    icon: icons.format,
    title: "One canonical form",
    body: <>The formatter is part of the compiler. Any layout of a program formats to the same text.</>,
  },
  {
    icon: icons.hole,
    title: "Typed holes",
    body: (
      <>
        Write <code className="rounded bg-surface-2 px-1 py-0.5 text-[14px] text-ink">?</code> where you&apos;re unsure. The compiler returns the type it needs and the functions
        that fit.
      </>
    ),
  },
  {
    icon: icons.runs,
    title: "Runs anywhere JavaScript runs",
    body: <>Compiles to JavaScript. Use the CLI with Node 20 or run it straight in the browser.</>,
  },
];

function Bar({ value }: { value: number }) {
  return (
    <span className="mt-2 block h-[3px] w-full max-w-[120px] overflow-hidden rounded-full bg-rule" aria-hidden>
      <span className="block h-full bg-ink" style={{ width: `${Math.round(100 * value)}%` }} />
    </span>
  );
}

const canonArms = benchmark.byModel.map((m) => m.canon);
const tsArms = benchmark.byModel.map((m) => m.typescript);
const ROWS: { metric: ReactNode; canon: string; ts: string; bars?: [number, number] }[] = [
  { metric: "Correct", canon: d.canonCorrect, ts: d.tsCorrect, bars: [avg(canonArms.map((a) => a.correct)), avg(tsArms.map((a) => a.correct))] },
  {
    metric: "Valid on the first try",
    canon: d.canonFirstPassRange,
    ts: d.tsFirstPass,
    bars: [avg(canonArms.map((a) => a.firstPass)), avg(tsArms.map((a) => a.firstPass))],
  },
  { metric: "Tries to working code", canon: d.turnsRange, ts: d.tsTurns },
  {
    metric: (
      <>
        Distinct programs per task
        <span className="mt-1 block text-[13px] text-faint">
          <span className="text-err">✗ Not yet.</span> Lower is better; not improved in v0 or v0.2.
        </span>
      </>
    ),
    canon: d.canonDistinctRange,
    ts: d.tsDistinctRange,
  },
  {
    metric: (
      <>
        Cost per working program
        <span className="mt-1 block text-[13px] text-faint">
          <span className="text-err">✗ Not yet.</span> Canon answers are longer.
        </span>
      </>
    ),
    canon: d.costMultiple,
    ts: "1×",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="border-b border-rule">
        <div className="frame flex flex-col items-center px-6 pb-[88px] pt-[72px] text-center md:pt-[112px]">
          <Link
            href="/docs/quickstart"
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-rule-strong bg-surface-2 px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:text-ink-strong"
          >
            <span>
              <code className="font-mono text-ink">canon-lang {d.version}</code> is on npm
            </span>
            <span className="text-faint">·</span>
            <span className="text-ink">Read the docs →</span>
          </Link>
          <h1 className="max-w-[900px] text-[clamp(44px,6.4vw,80px)] font-semibold leading-none tracking-[-0.045em] text-ink-strong">{tagline}</h1>
          <p className="mt-6 max-w-[640px] text-[18px] leading-[28px] text-muted md:text-[20px] md:leading-[30px]">{subhead}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button href="/docs/quickstart" primary>
              Get started
            </Button>
            <Button href="/play">Open playground</Button>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-[10px] border border-rule bg-surface py-1 pl-4 pr-1 font-mono text-[14px] text-ink">
            <span className="select-none text-faint">$</span>
            <span>{INSTALL_CMD}</span>
            <CopyButton text={INSTALL_CMD} label="Copy the command" />
          </div>
          <Window title="terminal" className="mt-16 w-full max-w-[860px]">
            <Terminal lines={terminal.lines} />
          </Window>
        </div>
      </section>

      {/* Features */}
      <Section>
        <Eyebrow>Features</Eyebrow>
        <H2>Built to be written by agents.</H2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-[14px] border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-bg p-7">
              <div className="text-ink-strong">{f.icon}</div>
              <h3 className="mt-5 text-[16px] font-semibold text-ink-strong">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-[24px] text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Benchmark */}
      <Section className="grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16 [&>*]:min-w-0">
        <div>
          <Eyebrow>Benchmark</Eyebrow>
          <H2>As reliable as TypeScript from day one.</H2>
          <p className="mt-6 text-[16px] leading-[26px] text-muted">
            {d.runs} runs across {d.tasks} tasks with {d.modelCount === "2" ? "two" : d.modelCount} frontier models. Success criteria were committed before any data
            was collected.
          </p>
          <Link href="/research" className="mt-6 inline-block text-[15px] font-medium text-ink-strong underline-offset-4 hover:underline">
            Full results and raw data →
          </Link>
        </div>
        <div>
          <div className="overflow-x-auto rounded-[14px] border border-rule-strong bg-surface">
            <table className="w-full min-w-[440px] text-left text-[15px]" data-testid="benchmark-table">
              <thead>
                <tr className="border-b border-rule font-mono text-[13px] text-faint">
                  <th className="px-5 py-3 font-normal">Metric</th>
                  <th className="px-5 py-3 font-normal">Canon</th>
                  <th className="px-5 py-3 font-normal">TypeScript</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={i} className="border-b border-rule last:border-none">
                    <th scope="row" className="px-5 py-4 align-top font-normal text-ink">
                      {r.metric}
                    </th>
                    <td className="px-5 py-4 align-top font-mono text-ink-strong">
                      {r.canon}
                      {r.bars ? <Bar value={r.bars[0]} /> : null}
                    </td>
                    <td className="px-5 py-4 align-top font-mono text-ink">
                      {r.ts}
                      {r.bars ? <Bar value={r.bars[1]} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 break-words font-mono text-[13px] text-faint">
            {d.models} · {d.tasks} tasks × {d.runsPerTask} runs × 2 languages
          </p>
        </div>
      </Section>

      {/* Syntax */}
      <Section className="grid items-center gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16 [&>*]:min-w-0">
        <div>
          <Eyebrow>Syntax</Eyebrow>
          <H2>Reads like code you already know.</H2>
          <p className="mt-6 text-[16px] leading-[26px] text-muted">
            Braces, types, pipelines and pattern matching. Familiar to agents trained on TypeScript and Python, and easy for people to review.
          </p>
          <ul className="mt-8 space-y-3 text-[15px] text-ink">
            {["Types on every signature, inferred inside", "Contracts checked at runtime", "Errors as values with Result and try"].map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span className="size-1.5 rounded-full bg-fix" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <Window
          tabs={
            <div className="flex h-full items-end gap-1 self-stretch font-mono text-[13px]">
              <span className="border-b-2 border-ink-strong px-3 pb-2.5 text-ink-strong">orders.cn</span>
              <Link prefetch={false} href={playHref(siteData.examples.find((e) => e.id === "orders")!.source)} className="px-3 pb-2.5 text-faint hover:text-ink">
                output
              </Link>
            </div>
          }
        >
          <CanonCode code={ordersSnippet} className="px-5 py-5 !text-[13px] !leading-[23px] sm:!text-[14px]" />
        </Window>
      </Section>

      {/* Call to action */}
      <Section className="flex flex-col items-center text-center">
        <h2 className="text-[38px] font-semibold leading-[1.08] tracking-[-0.035em] text-ink-strong md:text-[52px] md:leading-[56px]">Start building with Canon.</h2>
        <p className="mt-5 max-w-[560px] text-[18px] leading-[28px] text-muted">Point your agent at the reference and let it write. The compiler handles the rest.</p>
        <div className="mt-12 grid w-full max-w-[860px] gap-4 text-left md:grid-cols-2">
          {[
            { title: "Install", text: `npm i -g canon-lang\ncanon run hello.cn` },
            { title: "AGENTS.md", text: AGENTS_MD },
          ].map((p) => (
            <div key={p.title} className="overflow-hidden rounded-[14px] border border-rule-strong bg-surface">
              <div className="flex h-11 items-center justify-between border-b border-rule bg-surface-2 pl-4 pr-1.5">
                <span className="font-mono text-[13px] text-faint">{p.title}</span>
                <CopyButton text={p.text} label={`Copy ${p.title}`} />
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-4 font-mono text-[13px] leading-[22px] text-ink">{p.text}</pre>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button href="/docs" primary>
            Read the docs
          </Button>
          {githubUrl ? <Button href={githubUrl}>View on GitHub</Button> : null}
        </div>
      </Section>

      <SiteFooter />
    </main>
  );
}
