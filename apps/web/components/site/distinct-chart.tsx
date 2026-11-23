import type { SiteData } from "@/lib/site";

type B = SiteData["benchmark"];

/**
 * Distinct programs per task: mean and 95% interval for Canon v0.2, Canon v0 and TypeScript,
 * one group per model. Identity is carried by shape and a direct label, not color: filled
 * circle (Canon v0.2), hollow circle (Canon v0), square (TypeScript). Each mark has a native
 * hover tooltip; the table below the chart is its text view.
 */
export function DistinctChart({ v02, v0 }: { v02: B; v0: B }) {
  const arms = v02.byModel.flatMap((m, mi) => {
    const old = v0.byModel.find((x) => x.model === m.model)!;
    return [
      { model: m.model, mi, label: "Canon v0.2", a: m.canon, shape: "filled" as const },
      { model: m.model, mi, label: "Canon v0", a: old.canon, shape: "hollow" as const },
      { model: m.model, mi, label: "TypeScript", a: m.typescript, shape: "square" as const },
    ];
  });
  const max = Math.ceil(Math.max(...arms.map((r) => r.a.distinctHi)));
  const W = 720;
  const left = 200;
  const right = 24;
  const rowH = 30;
  const groupGap = 26;
  const top = 16;
  const x = (v: number) => left + ((W - left - right) * v) / max;
  const y = (i: number, mi: number) => top + i * rowH + mi * groupGap + rowH / 2;
  const H = top + arms.length * rowH + (v02.byModel.length - 1) * groupGap + 40;
  const ticks = Array.from({ length: max + 1 }, (_, i) => i);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="distinct-title">
        <title id="distinct-title">Distinct programs per task, mean with 95% interval, by model and language</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 30} stroke="var(--rule)" strokeWidth={1} />
            <text x={x(t)} y={H - 12} textAnchor="middle" fontSize={12} fill="var(--faint)" className="font-mono">
              {t}
            </text>
          </g>
        ))}
        {arms.map((r, i) => {
          const cy = y(i, r.mi);
          const tip = `${r.model} · ${r.label}: ${r.a.distinct.toFixed(2)} (95% interval ${r.a.distinctLo.toFixed(2)} to ${r.a.distinctHi.toFixed(2)})`;
          return (
            <g key={i}>
              <title>{tip}</title>
              <rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill="transparent" />
              {i % 3 === 0 ? (
                <text x={0} y={cy - rowH / 2 - 4} fontSize={12} fill="var(--faint)" className="font-mono">
                  {r.model}
                </text>
              ) : null}
              <text x={16} y={cy + 4} fontSize={13} fill={r.shape === "square" ? "var(--muted)" : "var(--ink)"}>
                {r.label}
              </text>
              <line x1={x(r.a.distinctLo)} x2={x(r.a.distinctHi)} y1={cy} y2={cy} stroke={r.shape === "square" ? "var(--muted)" : "var(--ink)"} strokeWidth={2} strokeLinecap="round" />
              {r.shape === "square" ? (
                <rect x={x(r.a.distinct) - 5} y={cy - 5} width={10} height={10} rx={2} fill="var(--muted)" stroke="var(--surface)" strokeWidth={2} />
              ) : (
                <circle cx={x(r.a.distinct)} cy={cy} r={5.5} fill={r.shape === "filled" ? "var(--ink-strong)" : "var(--surface)"} stroke="var(--ink-strong)" strokeWidth={2} />
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-[13px] text-faint">
        Mean distinct programs per task (of {v02.runsPerTask} runs each), with 95% bootstrap intervals over tasks. Lower means agents wrote the same program more often.
      </figcaption>
    </figure>
  );
}
