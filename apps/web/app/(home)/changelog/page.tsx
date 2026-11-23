import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CanonCode } from "@/components/canon-code";
import { SiteFooter } from "@/components/site/footer";
import { blob } from "@/lib/shared";
import { siteData } from "@/lib/site";
import { CREATE_TODO_PYTHON, CREATE_TODO_TYPESCRIPT, RELEASES, SAMPLES, V05_RELEASED, type Release } from "./releases";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What changed between Canon versions, why, what it cost, and what the measurements showed, including the predictions that failed.",
};

const { benchmark: v02, benchmarkV0: v0, display: d } = siteData;
const releaseOf = (id: string) => RELEASES.find((r) => r.id === id)!;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso: string) => {
  const [y, m, day] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
};
const dates = (r: Release) => (r.from === r.to ? longDate(r.from) : `${longDate(r.from)} to ${longDate(r.to)}`);
const both = (xs: number[]) => xs.map((x) => x.toFixed(2)).join(" and ");

function C({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.92em] text-ink-strong">{children}</code>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink-strong md:text-[32px]">{children}</h2>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-10 text-[18px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink-strong">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[17px] leading-[28px] text-muted">{children}</p>;
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="mt-4 list-disc space-y-2 pl-6 text-[17px] leading-[28px] text-muted marker:text-faint">{children}</ul>;
}

function Src({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
      {children}
    </a>
  );
}

/** A code block: Canon through the site's highlighter, anything else plain. */
function Block({ id, label }: { id: string; label?: string }) {
  const s = SAMPLES[id];
  return (
    <div className="mt-5 overflow-hidden rounded-[12px] border border-rule-strong bg-surface">
      {label ? <div className="border-b border-rule px-4 py-2 font-mono text-[12px] text-faint">{label}</div> : null}
      <CanonCode code={s.code} className="p-4" />
    </div>
  );
}

function Plain({ code, label }: { code: string; label: string }) {
  return (
    <div className="mt-5 overflow-hidden rounded-[12px] border border-rule-strong bg-surface">
      <div className="border-b border-rule px-4 py-2 font-mono text-[12px] text-faint">{label}</div>
      <pre className="overflow-auto p-4 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({ children, id }: { children: ReactNode; id: string }) {
  return (
    <section id={id} className="scroll-mt-32 border-b border-rule">
      <div className="frame px-6 py-14 md:py-16">
        <div className="mx-auto max-w-[720px] [&>*]:min-w-0">{children}</div>
      </div>
    </section>
  );
}

function VersionHead({ id, title, theme }: { id: string; title: string; theme: string }) {
  const r = releaseOf(id);
  return (
    <>
      <p className="font-mono text-[13px] text-faint">
        npm {r.npm} · {dates(r)}
      </p>
      <H2>{title}</H2>
      <p className="mt-3 text-[19px] leading-[30px] text-ink">{theme}</p>
    </>
  );
}

function Toc() {
  return (
    <nav aria-label="Versions" className="sticky top-16 z-30 border-b border-rule bg-bg/90 backdrop-blur">
      <ul className="mx-auto flex max-w-[1200px] items-center gap-5 overflow-x-auto px-6 py-3 font-mono text-[13px] text-muted">
        {RELEASES.map((r) => (
          <li key={r.id} className="shrink-0">
            <a href={`#${r.id}`} className="transition-colors hover:text-ink-strong">
              {r.language}
              {r.id === "v0-5" && !V05_RELEASED ? " (unreleased)" : ""}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Changelog() {
  const v0Claude = v0.byModel[0];
  return (
    <main>
      <header className="border-b border-rule">
        <div className="frame px-6 pb-12 pt-16 md:pt-20">
          <div className="mx-auto max-w-[720px]">
            <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.04em] text-ink-strong md:text-[52px]">Changelog</h1>
            <p className="mt-5 text-[19px] leading-[30px] text-ink">
              What changed in each version of Canon, why it changed, what it cost, and what was measured, including the predictions that did
              not hold. The newest version is first.
            </p>
            <P>
              Every version below was committed on November 22 or 23, 2026, so the order is the order of the evidence, not a release
              calendar. The npm package took the language&apos;s version number at 0.3.0; before that it was 0.1.x. Canon-Py, the Python-shaped
              syntax, arrived in v0.4. Where a number is quoted, it links to the report that produced it; the benchmark figures are
              generated from the raw runs. See <Link href="/research" className="text-ink underline decoration-rule-strong underline-offset-4">Research</Link> for the studies themselves and the{" "}
              <Link href="/docs/roadmap" className="text-ink underline decoration-rule-strong underline-offset-4">roadmap</Link> for what comes next.
            </P>
          </div>
        </div>
      </header>
      <Toc />

      {/* ------------------------------------------------------------------ v0.5 */}
      <Section id="v0-5">
        <VersionHead
          id="v0-5"
          title="v0.5: Full stack"
          theme="Write the data types, the endpoints and the logic once, in Canon. Compile them to a FastAPI backend and a typed TypeScript client that read as hand-written."
        />
        <H3>What changed</H3>
        <Ul>
          <li>
            <strong className="text-ink">Projects and modules.</strong> A folder with a <C>canon.toml</C> is a project, and each file under its source
            folder is a module. Imports name what they take: <C>use todos.{"{NewTodo, Todo}"}</C>, and in Canon-Py{" "}
            <C>from todos import NewTodo, Todo</C>. New codes: M002 (import cycle), M003 (unknown or unimported name, with a patch that adds the
            import) and M004 (a top-level name defined in two modules).
          </li>
          <li>
            <strong className="text-ink">API functions.</strong> An <C>api fn</C> is an ordinary function plus a <C>route:</C> clause. Its{" "}
            <C>requires</C> is the request validation: the server enforces it with a 422, and the generated client checks it before sending.
            A value or <C>Ok</C> is a 200, <C>Err</C> is a 400 with <C>{`{"error": ...}`}</C>, a trap is a 500. New codes: A001 (the shape of
            inputs and outputs), A002 (two endpoints with one route), A003 (validation the client cannot run), A004 (a table used as a value).
          </li>
          <li>
            <strong className="text-ink">Tables and effects with arguments.</strong> <C>table todos: Todo key id</C> declares a table, and{" "}
            <C>get</C>, <C>scan</C>, <C>insert</C>, <C>save</C>, <C>delete</C>, <C>next_id</C> and <C>count</C> work on it. Effects now name what they
            touch: <C>store(todos)</C> and <C>net(api.stripe.com)</C>. New codes: R007 (duplicate key), E104 (a literal URL to an undeclared
            host), W010 (any-host network). New built-ins: <C>is_email</C>, <C>is_some</C>, <C>uuid</C>, <C>hash_password</C> and{" "}
            <C>verify_password</C>.
          </li>
          <li>
            <strong className="text-ink">Commands.</strong> <C>canon build</C> in a project writes the backend and the client into the folders{" "}
            <C>canon.toml</C> names; <C>canon dev</C> rebuilds on every save and serves the backend with <C>uvicorn --reload</C>;{" "}
            <C>canon manifest</C> lists every endpoint with its route, effects and validation rules; <C>canon check</C>, <C>test</C> and{" "}
            <C>check --fix</C> work across every module.
          </li>
          <li>
            <strong className="text-ink">Read-only output.</strong> Every generated file starts with a header and a hash of its own contents.{" "}
            <C>canon check</C> reports a hand-edited generated file as G001, and <C>canon build</C> refuses to overwrite it without{" "}
            <C>--force</C>. G002 means the program uses something the Python target cannot express yet.
          </li>
        </Ul>
        <Block id="v05" label="canon/todos.cn" />
        <P>
          That one definition compiles to a route in Python and a method in the client. The generated files are checked in{" "}
          <Src href={blob("tests/v05/golden/todos/expected")}>tests/v05/golden/todos/expected</Src> and diffed in CI:
        </P>
        <Plain code={CREATE_TODO_PYTHON} label="backend/canon_generated/api.py" />
        <Plain code={CREATE_TODO_TYPESCRIPT} label="frontend/src/canon/client.ts" />
        <P>
          The generated Python passes <C>ruff format</C>, <C>ruff check</C> and <C>mypy --strict</C>. The TypeScript passes <C>tsc --strict</C>,
          prettier and eslint. A suite of random portable expressions runs through the JavaScript runtime, the generated Python and the
          generated TypeScript and requires identical results, so a rule cannot mean one thing in the client and another on the server.
        </P>

        <H3>Why</H3>
        <P>
          The two sides of a web application must agree on the same types, the same errors and the same validation rules, and writing them
          twice is where they drift apart. The bet was that if an agent writes these parts once and the compiler generates both sides, the
          disagreement cannot happen, and that the effects an endpoint has (which tables, which hosts) become a permission list a person can
          read before the code runs. The UI stays in React and TypeScript, which agents already write well. The{" "}
          <Link href="/docs/design-notes" className="text-ink underline decoration-rule-strong underline-offset-4">design notes</Link> record why a
          language agents write has to ship its reference with every prompt, and the full plan, with its predictions, is{" "}
          <Src href={blob("docs/v0.5-fullstack.md")}>docs/v0.5-fullstack.md</Src>.
        </P>

        <H3>What was measured, and what held up</H3>
        <P>
          Three experiments ran on v0.5. All three were pre-registered, and none of them is complete: the Anthropic and OpenAI accounts ran out
          of credit during the runs. <strong className="text-ink">The win rule, which needs both frontier models, could not be evaluated, so
          there is no verdict that Canon is the better language for agents.</strong> What the data does show:
        </P>
        <Ul>
          <li>
            <strong className="text-ink">Canon won a reading test for one frontier model, and not because of its annotations.</strong> In{" "}
            <Src href={blob("research/canonbench/REPORT.md")}>CanonBench</Src>, GPT-6.2 Sol answered questions about Canon programs more
            accurately than about TypeScript ones, by 3.6 points (interval 1.7 to 5.8), and about which functions can reach the network, files,
            clock or randomness by 8.3 points (3.6 to 13.5). Stripping Canon&apos;s contracts and effects changed its accuracy by 0.1 points. Most
            of the gap came from questions where Python and TypeScript are genuinely ambiguous, such as a network call that can also open
            local files.
          </li>
          <li>
            <strong className="text-ink">For frontier models, writing, fixing and changing code is at the ceiling.</strong> GPT-6.2 Sol scored
            100% in every language on those families, so they cannot separate the languages, and Claude Opus 5.5 scored 99% to 100% on the reading
            questions it completed (
            <Src href={blob("research/opus-partial/README.md")}>what the partial Opus runs show</Src>). The one place Canon trailed for GPT was
            shipping Python: 5 of 180 programs that passed in Canon failed after compiling to it, two from a code-generation bug (since fixed) and
            three because the Python target refuses a construct.
          </li>
          <li>
            <strong className="text-ink">The small local model lost every writing family.</strong> Qwen2.5-Coder 7B passed 0% of Canon writing
            tasks against 36% in Python and 33% in TypeScript, 49% against 81% and 77% on fixing, and 35% against 58% and 71% on changing. It
            writes Rust-like code (<C>let mut</C> in two thirds of its drafts) and resubmits the same code after the compiler&apos;s feedback.
            Canon-Py did not close the gap: its writing score was also 0%, with the Rust habits replaced by Python habits outside Canon-Py&apos;s
            subset. The compiler&apos;s <C>--fix</C> removed 9.3% of the errors in drafts across all models and families (77% of them on GPT-6.2 Sol&apos;s Canon writing drafts, and none on the small model&apos;s drafts, which did not parse), where ruff and eslint removed none. Where a program was approved by the language&apos;s own checks, GPT-6.2 Sol was wrong 0% of the time in every language; the small model was wrong 40% of the time in Canon, 35% in Python and 38% in TypeScript, so approval by the checker was no safer in Canon.
          </li>
          <li>
            <strong className="text-ink">Canon costs several times the tokens.</strong> Its reference is in every prompt, so a Canon item used
            3.2 to 7.7 times the tokens of a Python or TypeScript one.
          </li>
          <li>
            <strong className="text-ink">A prediction failed.</strong> Experiment VA-1 expected that on rules spanning several fields, a
            schema-driven client would drift from its server and Canon would not. With carefully written references, client and server agreed on
            every input in all three arms (hand-written, schema-driven and Canon), so the difference between Canon and the best conventional setup is
            0.0 points. What Canon removes is the work of writing the rule twice and the chance of forgetting it, not an expressiveness limit. The
            report lists why this is not the last word: the references were written with the rule list in front of their authors, many shared a
            template, and unusual Unicode was not tested. <Src href={blob("research/va1/REPORT.md")}>VA-1 report</Src>.
          </li>
          <li>
            <strong className="text-ink">The full-stack experiment is partial.</strong> In{" "}
            <Src href={blob("research/fs1/REPORT.md")}>FS-1</Src>, 161 of GPT-6.2 Sol&apos;s 540 planned runs and none of Opus&apos;s main run
            completed. Both ran at the ceiling, so there is no difference in whether the feature works. Where the arms did differ: client and
            server agreed on what is valid for 100% of inputs in Canon and for 35.9% in the OpenAPI arm, though those tasks never asked the
            hand-written arms to validate on the client; Canon passed 56.9% of runs in the first round against 100%, so it needed more edit rounds;
            and it used about 3.4 times the tokens. These are partial-run effects with intervals, not a result.
          </li>
        </Ul>

        <H3>What it cost, and what the experiments found in the compiler</H3>
        <Ul>
          <li>
            Running the benchmarks on the generator found real bugs, each now fixed with a regression test: temporaries hoisted out of lambdas and
            loop conditions (a NameError or a wrong value in the Python), a comprehension&apos;s tuple target split across lines (a syntax error), a
            model field whose type was declared later (an import-time error), a project with no tables failing the type checker, and an{" "}
            <C>api fn</C> named like its own file shadowing the generated module. The Canon code and its JavaScript run were right in every case; only the
            Python target was wrong.
          </li>
          <li>
            Writing the 60 FS-1 tasks showed what Canon&apos;s portable validation cannot say: it cannot look at individual characters, at each
            element of a list, or inside an <C>Option</C>, and variant names are unique across a project. Ten tasks were narrowed so a Canon
            reference could exist, and the results are reported with and without them.
          </li>
          <li>
            The Python target refuses an <C>Option</C> inside an <C>Option</C> (G002), because it writes <C>Option[T]</C> as <C>T | None</C>; agents hit
            this in practice, and the full-stack reference now names it.
          </li>
          <li>
            The Python the compiler writes is measured against ruff&apos;s rules, so the compiler carries its own line-breaking implementation. Each
            time a benchmark exposed a case ruff formatted differently, it was fixed.
          </li>
        </Ul>

        <H3>Migrating</H3>
        <Ul>
          <li>
            Outside a project, only <C>use std.name</C> is allowed (M001). In a project, <C>use</C> must name what it takes. There are no wildcards,
            renaming or cycles.
          </li>
          <li>
            <C>get</C>, <C>scan</C>, <C>insert</C>, <C>save</C>, <C>delete</C>, <C>next_id</C> and <C>count</C> are built-ins only in a program that declares or
            imports a table, so an existing program that defines its own <C>save</C> or <C>count</C> still checks.
          </li>
          <li>
            Canonical form changed for two cases that were L001 before: a contract longer than the line limit breaks before each <C>&amp;&amp;</C> or{" "}
            <C>||</C>, and a match arm that is too long breaks at its outermost bracket. <C>canon fmt --write</C> applies both.
          </li>
          <li>
            {V05_RELEASED ? (
              <>Install it with <C>npm install -g canon-lang</C>.</>
            ) : (
              <>
                Version 0.5.0 is not on npm yet: the packages in the repository say 0.5.0, and <C>canon-lang</C> on npm is still 0.4.1. This page
                will say when that changes.
              </>
            )}
          </li>
        </Ul>
        <Block id="v05contract" label="a validation rule, broken one operand per line by canon fmt" />
      </Section>

      {/* ------------------------------------------------------------------ v0.4 */}
      <Section id="v0-4">
        <VersionHead id="v0-4" title="v0.4: Canon-Py, and effects on function types" theme="Close the last hole in the effect guarantee, and test whether Canon should look like Python." />
        <H3>What changed</H3>
        <Ul>
          <li>
            <strong className="text-ink">Effects on function types.</strong> A function type can carry effects:{" "}
            <C>{"fn(String) -> Unit effects: io"}</C>. Calling a function value performs the effects of its type, and passing an effectful function
            where a pure one is expected is T011. Every function&apos;s own signature now bounds what it can do, not only the program&apos;s.
          </li>
          <li>
            <strong className="text-ink">Canon-Py.</strong> An opt-in surface (<C>--syntax py</C>) that writes the same language as a strict subset of typed
            Python: <C>def</C>, indentation, annotations, decorators for effects and contracts. It produces the same syntax tree, so the checker, the effect
            checker and the runtime are shared, and <C>canon fmt</C> converts between the two. It has its own agent reference at <C>/llms-py.txt</C>.
          </li>
          <li>
            <strong className="text-ink">Commands.</strong> <C>canon build FILE</C> writes a standalone JavaScript file, or an ES module with{" "}
            <C>--module</C>; <C>--watch</C> reruns check, test, run and build on every save; <C>--v0.3</C> and <C>--no-fn-effects</C> turn the changes off.
          </li>
          <li>
            <strong className="text-ink">0.4.1</strong> fixed six things found in review: a <C>to_float</C> fix no longer wraps an integer division (that
            silently turned a mean into a truncated one); the chained-comparison hint names <C>&amp;&amp;</C>; text output lists T001 suggestions;{" "}
            <C>canon test</C> reports every contract it did not fuzz as a SKIP with the reason; the formatter breaks long pipeline stages; and a Canon-Py
            program prints values in Python&apos;s spelling.
          </li>
        </Ul>
        <Block id="v04" label="brace syntax" />
        <Block id="v04py" label="the same function in Canon-Py (--syntax py)" />

        <H3>Why</H3>
        <P>
          v0.3 sealed the effects at the program level, but a function that received <C>print</C> as a parameter could perform <C>io</C> without
          declaring it. And the v0.3 measurement pointed at Python-shaped syntax as the largest single lever on how natural Canon is to a code
          model. Both needed answers before anything else.
        </P>

        <H3>What it cost, and where the evidence ran against the idea</H3>
        <Ul>
          <li>
            The big advantage measured for the Canon-Py prototype came mostly from Python&apos;s library (methods, indexing, comprehensions), which
            v0.4 deliberately does not adopt. Measured on the benchmark&apos;s own programs converted by <C>fmt</C>, Canon-Py is less surprising than brace
            syntax with no documentation (about 12 to 13 nats per program), but slightly <em>more</em> surprising once each syntax has its own agent
            reference (about 3 nats, intervals above zero for Claude&apos;s programs). So brace syntax stays the default.
          </li>
          <li>
            Where the model&apos;s preference would have cost a guarantee, Canon kept the guarantee: contracts stay decorators instead of bare{" "}
            <C>assert</C> lines, though the model preferred <C>assert</C> by about 12.8 nats under the small model. Pipelines were dropped from Canon-Py
            (a tie, and Python has none). Division stays truncating and <C>//</C> and <C>**</C> are rejected: the largest remaining semantic trap for a
            Python reader.
          </li>
          <li>
            Whether Canon-Py becomes the default is decided by Experiment 1b, a pre-registered comparison of agents writing both syntaxes. It has not
            reported.
          </li>
        </Ul>

        <H3>What was measured</H3>
        <P>
          Surprisal under local Qwen2.5-Coder 1.5B and 7B models, for the same 50 programs in both syntaxes, with intervals over tasks:{" "}
          <Src href={blob("docs/v0.4-design.md")}>docs/v0.4-design.md</Src> has every table. It is a proxy for how natural the text is to a model, not a
          measure of how often an agent writes it correctly; the design notes say so too.
        </P>

        <H3>Migrating</H3>
        <Ul>
          <li>Brace syntax did not change, so a v0.3 file is a v0.4 file.</li>
          <li>
            A program that passes an effectful function where the type says pure now reports T011. Declare the effect in the function type, as above.
          </li>
          <li>
            To try Canon-Py: <C>canon fmt --syntax py --write file.cn</C> converts a program, and <C>canon fmt --write</C> converts it back.
          </li>
        </Ul>
      </Section>

      {/* ------------------------------------------------------------------ v0.3 */}
      <Section id="v0-3">
        <VersionHead id="v0-3" title="v0.3: A toolchain that fixes what is mechanical" theme="Let the compiler repair the errors that only restate the program, so an agent only spends a turn on the ones that need judgment." />
        <H3>What changed</H3>
        <Ul>
          <li>
            <strong className="text-ink">Self-healing.</strong> <C>canon check --fix</C> applies every patch that only restates the program (C001, E101, E102
            and T009) until none is left. The formatter breaks long statements at their outermost brackets, which turns most L001 errors into patches.
          </li>
          <li>
            <strong className="text-ink">Judgment errors come with choices.</strong> T001 lists ranked candidate patches (<C>to_string</C>,{" "}
            <C>unwrap_or</C> with a hole, <C>Some</C>, <C>Ok</C>) and never applies one itself.
          </li>
          <li>
            <strong className="text-ink">Sealed effects.</strong> Test blocks are now effect-checked, contracts must be pure (E103), and a run-time capability
            guard enforces the entry point&apos;s effects even if the checker had a bug.
          </li>
          <li>
            <strong className="text-ink">Contracts test themselves.</strong> <C>canon test</C> fuzzes every pure function that has a contract on seeded inputs.
          </li>
          <li>
            <strong className="text-ink">Three spellings.</strong> <C>&amp;&amp;</C>, <C>||</C> and <C>!</C> replace <C>and</C>, <C>or</C> and <C>not</C>;{" "}
            <C>break</C> exists (there is no <C>continue</C>); and <C>for (i, x) in xs</C> replaces <C>pair.0</C> and <C>pair.1</C>.
          </li>
        </Ul>
        <Block id="v03" label="all three spellings in one function" />

        <H3>Why</H3>
        <P>
          The two earlier benchmarks left {d.failedFirst} first drafts that failed a check, and every one of them failed only on mechanical codes, mostly
          layout. A replay of the recorded drafts through <C>--fix</C>, with no model calls, made every one valid with its hidden tests passing. The
          replay is counterfactual: an agent told that layout fixes itself might write different drafts. Twelve of the {d.failedFirst} were long lines, so
          without the formatter&apos;s wrapping the loop would have stopped short. Each change got an ablation switch (<C>--no-wrap</C>,{" "}
          <C>--no-symbols</C> and the rest, or <C>--v0.2</C> for all of them) so a later experiment could attribute an effect to one change.
        </P>

        <H3>What it cost, and what was rejected</H3>
        <Ul>
          <li>
            Several syntax ideas were rejected on the evidence, because each made programs <em>more</em> surprising to the models: <C>fn f() -&gt; T = e</C>,
            an implicit final return, dropping <C>let</C>, and indentation instead of braces (each by about 1 to 5 nats, all together 5 to 9). <C>continue</C>{" "}
            lost to an <C>if</C> guard in every context, and a <C>find</C> function would have been a second way to do what <C>return</C> from a loop does.
          </li>
          <li>
            The largest measured effect was not built: a Python-shaped syntax, recommended for v0.4 but staged behind a cheaper test, because the evidence
            was a proxy (base-model surprisal), not agent behaviour.
          </li>
          <li>
            Even after v0.3 Python wins on that measure: Canon programs with their reference were 19 to 38 nats more surprising per program than typed
            Python, and longer (88 to 101 model tokens against 60). v0.3 was token-neutral by design.
          </li>
          <li>
            Contract fuzzing only helps where agents write contracts, which in the benchmarks was a minority of programs.
          </li>
        </Ul>

        <H3>What was measured</H3>
        <P>
          Surprisal and token counts under two local models, the replay of recorded drafts, and a red-team pass that found two holes in the effect
          guarantee (tests were not checked, and a contract could call <C>now()</C> invisibly). Every figure and its source is in{" "}
          <Src href={blob("docs/v0.3-proposal.md")}>docs/v0.3-proposal.md</Src>. v0.3 itself was not benchmarked against agents.
        </P>

        <H3>Migrating</H3>
        <Ul>
          <li>
            <C>canon fmt --write</C> rewrites <C>and</C>, <C>or</C>, <C>not</C> and <C>pair.0</C> to the new spellings. A test block that uses{" "}
            <C>fs</C> or <C>net</C> now declares it, and <C>canon check --fix --write</C> adds the line.
          </li>
          <li>
            <C>--v0.2</C> restores v0.2 behaviour, byte for byte on the conformance corpus.
          </li>
        </Ul>
      </Section>

      {/* ------------------------------------------------------------------ v0.2 */}
      <Section id="v0-2">
        <VersionHead id="v0-2" title="v0.2: Spellings models prefer" theme="Change four things the first benchmark and a likelihood study showed models did not write naturally." />
        <H3>What changed</H3>
        <Ul>
          <li>
            Assignment is <C>x = e</C> (on a <C>var</C>); <C>set</C> is retired.
          </li>
          <li>
            The condition loop is <C>while cond {"{ }"}</C>; <C>for</C> only walks a list.
          </li>
          <li>
            Strings join with <C>+</C>, and <C>concat</C> is removed (<C>String + Int</C> is still a type error).
          </li>
          <li>
            <C>match</C> may appear in any expression position, and S001 is retired.
          </li>
          <li>The agent reference was trimmed from about 9,800 to about 7,000 characters, because it is the main cost of a Canon run.</li>
        </Ul>
        <Block id="v02" label="x = e and while" />

        <H3>Why</H3>
        <P>
          A study of how likely a code model finds each spelling, scored under two Qwen2.5-Coder models, found v0&apos;s choices far less natural than the
          alternatives: <C>set x = ...</C> thousands of times less likely than <C>x = ...</C>, <C>for cond</C> tens to hundreds of times less likely than{" "}
          <C>while cond</C>, and <C>concat(a, b)</C> tens of times less likely than <C>a + b</C>. And with <C>match</C> limited to a few positions, models
          invented varied workarounds in the benchmark.
        </P>

        <H3>What did not work</H3>
        <Ul>
          <li>
            The goal was convergence: fewer different programs for the same task. The v0.2 benchmark ({d.runs} runs, {d.tasks} tasks, two models) did not
            show it. Canon averaged {both(v02.byModel.map((m) => m.canon.distinct))} distinct programs per task against {both(v0.byModel.map((m) => m.canon.distinct))} for v0, and TypeScript averaged{" "}
            {both(v02.byModel.map((m) => m.typescript.distinct))}. Both pre-registered convergence criteria were NOT SUPPORTED.
          </li>
          <li>
            Cost did not move into range either: Claude&apos;s cost per correct program stayed {d.costMultiple} TypeScript&apos;s, against a pre-registered
            bound of 1.5 times.
          </li>
          <li>
            What did hold, both times: agents wrote correct Canon from the reference alone, as often as correct TypeScript ({d.canonCorrect} against{" "}
            {d.tsCorrect}), with at most about {d.turnsRange.split("–")[1]} turns to a correct program against {d.tsTurns} for TypeScript.
          </li>
        </Ul>
        <H3>What was measured</H3>
        <P>
          <Src href={blob("research/likelihood/REPORT.md")}>The likelihood study</Src> and{" "}
          <Src href={blob("research/benchmark/REPORT-v0.2.md")}>the v0.2 benchmark report</Src>, pre-registered before the run. They are summarized on{" "}
          <Link href="/research" className="text-ink underline decoration-rule-strong underline-offset-4">Research</Link>.
        </P>
        <H3>Migrating</H3>
        <Ul>
          <li>
            The parser still reads <C>set x = e</C>, <C>for cond {"{ }"}</C> and <C>concat(...)</C>, and <C>canon fmt --write</C> rewrites them, so a
            v0 file is migrated by running it once. A <C>concat</C> you defined yourself is left alone.
          </li>
        </Ul>
      </Section>

      {/* ------------------------------------------------------------------ v0 */}
      <Section id="v0">
        <VersionHead id="v0" title="v0: The first release" theme="A small language whose compiler is a collaborator: one canonical text per program, effects in the signature, and every error with its fix." />
        <H3>What shipped</H3>
        <Ul>
          <li>
            The language: records, sum types, <C>Option</C> and <C>Result</C> with <C>try</C>, exhaustive <C>match</C>, effects written in the signature and
            checked exactly (fs, io, net, rand, time), <C>requires</C> and <C>ensures</C>, and typed holes that report the type they need.
          </li>
          <li>
            A compiler written in TypeScript against a Python reference implementation, with the same formatting and the same front-end diagnostics byte
            for byte, a type checker with exhaustive match, and code generation to JavaScript.
          </li>
          <li>
            The CLI (<C>check</C>, <C>fmt</C>, <C>run</C> and <C>test</C>, each with <C>--json</C>), diagnostics with stable codes and ready patches, a
            documentation site whose Canon examples are checked, an agent reference at <C>/llms.txt</C>, and a browser playground.
          </li>
        </Ul>
        <Block id="v0" label="effects, a contract and a loop" />
        <H3>Why</H3>
        <P>
          The premise: an agent works better with a language where the compiler returns exact, machine-applicable fixes, where the formatter decides
          one text per program (so a diff means a change), and where what a function can do is written in its signature. Every one of those is a design
          law of the language, listed in the <Link href="/docs/design-notes" className="text-ink underline decoration-rule-strong underline-offset-4">design notes</Link>.
        </P>
        <H3>What was measured, and what did not hold</H3>
        <Ul>
          <li>
            The first benchmark ({d.v0Runs} runs, {d.tasks} tasks, Claude Opus 5.5 and GPT-6.2 Sol, Canon against TypeScript) supported two of its
            claims: agents wrote correct Canon from the reference alone ({d.canonCorrect}, as often as TypeScript), and without more turns than TypeScript.
          </li>
          <li>
            It did not support the third. The pre-registered goal was half as many different programs per task as TypeScript; Canon averaged{" "}
            {both(v0.byModel.map((m) => m.canon.distinct))} against {both(v0.byModel.map((m) => m.typescript.distinct))}.
          </li>
          <li>
            Canon&apos;s first draft passed the checker {Math.round(100 * v0Claude.canon.firstPass)}% of the time for Claude against {Math.round(100 * v0Claude.typescript.firstPass)}% for TypeScript,
            and each correct Canon program cost about {v0Claude.tokenMultiple.toFixed(1)} times the tokens of a TypeScript one, the reference
            counted.
          </li>
        </Ul>
        <P>
          The tasks were also too easy to separate the languages, which is why later work built a harder set.{" "}
          <Src href={blob("research/benchmark/REPORT.md")}>The v0 report</Src> has every verdict.
        </P>
        <H3>Packages</H3>
        <P>
          Published to npm as <C>canon-lang</C> 0.1.0.
        </P>
      </Section>

      <SiteFooter />
    </main>
  );
}
