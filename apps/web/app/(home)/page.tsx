import Link from "next/link";
import { CanonCode } from "@/components/canon-code";
import { ManyInOneOut } from "@/components/many-in-one-out";
import { githubUrl } from "@/lib/shared";
import { playHref } from "@/lib/share";
import { fmtNumber, siteData } from "@/lib/site";

const { stats, orders } = siteData;

function Button({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  const cls = primary
    ? "bg-[var(--accent)] text-white hover:opacity-90 dark:text-neutral-950"
    : "border border-fd-border hover:bg-fd-accent";
  const external = href.startsWith("http");
  return external ? (
    <a href={href} className={`rounded-md px-4 py-2 text-sm font-medium ${cls}`}>
      {children}
    </a>
  ) : (
    <Link href={href} className={`rounded-md px-4 py-2 text-sm font-medium ${cls}`}>
      {children}
    </Link>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto w-full max-w-5xl px-6 py-14">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

const IDEAS = [
  {
    title: "One text per program",
    body: "The formatter is the grammar. A file fmt would change is a compile error that carries the patch, so two programs with the same meaning are the same bytes.",
    code: "fmt(any variant) == the canonical text",
  },
  {
    title: "Effects you can see",
    body: "A function lists exactly the effects it uses, sorted, no more and no fewer. Leaving the clause out means pure. The checker enforces it both ways.",
    code: "fn fetch(url: String) -> Result[String, Error]\n  effects: net, time",
  },
  {
    title: "Patches, not prose",
    body: "Every mechanical error comes back as JSON with a unified diff the agent applies as is. Holes (?name) ask the compiler what type belongs there.",
    code: '{ "code": "E101", "fix": { "kind": "patch", ... } }',
  },
];

const LOOP = ["write", "check", "apply patch or answer hole", "check again", "run"];

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* 1. Hero */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-10 pt-20">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">The dialect models already speak.</h1>
        <p className="mt-5 max-w-2xl text-lg text-fd-muted-foreground">
          Canon is a programming language for AI agents. One way to write every program, effects in every signature, and
          a compiler that answers with patches.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/play" primary>
            Try it
          </Button>
          <Button href="/docs">Read the docs</Button>
          {githubUrl ? <Button href={githubUrl}>GitHub</Button> : null}
        </div>
      </section>

      {/* 2. Many in, one out */}
      <Section title="Many in, one out">
        <ManyInOneOut variants={orders.variants} canonical={orders.canonical} />
        <p className="mt-4 text-sm text-fd-muted-foreground">
          {fmtNumber(stats.fuzzedVariants)} scrambled variants tested. One output.
        </p>
      </Section>

      {/* 3. Three ideas */}
      <Section title="Three ideas">
        <div className="grid gap-4 md:grid-cols-3">
          {IDEAS.map((idea) => (
            <div key={idea.title} className="flex flex-col rounded-lg border border-fd-border bg-fd-card p-5">
              <h3 className="font-semibold">{idea.title}</h3>
              <p className="mt-2 flex-1 text-sm text-fd-muted-foreground">{idea.body}</p>
              <CanonCode code={idea.code} className="mt-4 whitespace-pre-wrap break-words rounded bg-fd-muted p-3 text-[12px]" />
            </div>
          ))}
        </div>
      </Section>

      {/* 4. The loop */}
      <Section title="The loop">
        <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="The agent loop">
          {LOOP.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-md border border-fd-border bg-fd-card px-3 py-2 font-mono">{step}</span>
              {i < LOOP.length - 1 ? <span aria-hidden className="text-fd-muted-foreground">→</span> : null}
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-2xl text-sm text-fd-muted-foreground">
          The agent applies patches mechanically and treats holes as questions; only parse and naming errors send it back
          to rewrite code itself, so the write, compile, fix loop closes in one or two turns.
        </p>
      </Section>

      {/* 5. Real code */}
      <Section title="Real code">
        <div className="overflow-hidden rounded-lg border border-fd-border bg-fd-card">
          <div className="flex items-center justify-between border-b border-fd-border px-4 py-2 text-xs text-fd-muted-foreground">
            <span className="font-mono">examples/orders.cn</span>
            <Link href={playHref(orders.canonical)} className="rounded bg-[var(--accent)] px-3 py-1 font-medium text-white dark:text-neutral-950">
              Run
            </Link>
          </div>
          <CanonCode code={orders.canonical} className="p-4" />
        </div>
      </Section>

      {/* 6. Numbers */}
      <section className="border-y border-fd-border bg-fd-card">
        <dl className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
          {[
            [`${fmtNumber(stats.referenceTokens)}`, "tokens in the whole language reference"],
            [fmtNumber(stats.fuzzedVariants), "fuzzed variants, one canonical text each"],
            [fmtNumber(stats.conformanceTests), "conformance tests against the reference oracle"],
            [fmtNumber(stats.stdlibFunctions), "standard library functions"],
          ].map(([n, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="font-mono text-3xl font-semibold">{n}</dd>
              <dd className="mt-1 text-sm text-fd-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 7. Why this exists */}
      <Section title="Why this exists">
        <div className="max-w-2xl space-y-4 text-fd-muted-foreground">
          <p>
            The randomness in AI-written code comes from sampling, and no language can remove that. What a language does
            control is how many legal programs exist for the same intent. When there are dozens of ways to write a button,
            two agent runs drift apart, and reviewers chase style instead of logic.
          </p>
          <p>
            Canon removes that freedom on purpose: one way to loop, one way to branch, one way to handle errors, one
            textual form per program. Fewer legal programs per intent means agent runs converge, diffs stay small and
            caches hit.
          </p>
          <p>
            It borrows the forms models already write most reliably (braces, fn, let, match, pipelines) and then removes
            every alternative. The whole reference fits in one context window, and the compiler answers with patches, so
            the loop closes in a turn or two.
          </p>
          <p>
            <Link href="/docs/design-notes" className="font-medium text-[var(--accent)] underline-offset-4 hover:underline">
              Read the design notes →
            </Link>
          </p>
        </div>
      </Section>

      {/* 8. Footer */}
      <footer className="mt-auto border-t border-fd-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 text-sm text-fd-muted-foreground">
          <span className="font-mono font-semibold text-fd-foreground">Canon</span>
          {githubUrl ? <a href={githubUrl} className="hover:text-fd-foreground">GitHub</a> : null}
          <Link href="/docs" className="hover:text-fd-foreground">Docs</Link>
          <Link href="/play" className="hover:text-fd-foreground">Playground</Link>
          <span>MIT license</span>
        </div>
      </footer>
    </main>
  );
}
