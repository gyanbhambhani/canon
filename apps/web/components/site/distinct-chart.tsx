import type { SiteData } from "@/lib/site";

type B = SiteData["benchmark"];

const AXIS_MAX = 6;

/**
 * Distinct programs per task: a dot (mean) and whisker (95% interval) for Canon v0.2, Canon v0
 * and TypeScript, one panel per model. The SVG is a single image to assistive technology
 * (role="img" with a summary label), so its tick labels never enter the page's text flow.
 */
export function DistinctChart({ v02, v0 }: { v02: B; v0: B }) {
  const panels = v02.byModel.map((m) => {
    const old = v0.byModel.find((x) => x.model === m.model)!;
    return {
      model: m.model,
      rows: [
        { label: "Canon v0.2", a: m.canon, ts: false },
        { label: "Canon v0", a: old.canon, ts: false },
        { label: "TypeScript", a: m.typescript, ts: true },
      ],
    };
  });
  const summary =
    "Distinct programs per task, lower is more consistent. " +
    panels
      .map(
        (p) =>
          `${p.model}: ` +
          p.rows.map((r) => `${r.label} ${r.a.distinct.toFixed(1)} (95% interval ${r.a.distinctLo.toFixed(1)} to ${r.a.distinctHi.toFixed(1)})`).join(", "),
      )
      .join("; ") +
    ". Canon is not more consistent than TypeScript, and v0.2 did not improve on v0.";

  const W = 960;
  const left = 150;
  const right = 24;
  const rowH = 32;
  const panelTitle = 28;
  const panelGap = 20;
  const axisH = 52;
  const panelH = panelTitle + 3 * rowH;
  const H = panels.length * panelH + (panels.length - 1) * panelGap + axisH;
  const x = (v: number) => left + ((W - left - right) * Math.min(v, AXIS_MAX)) / AXIS_MAX;
  const ticks = Array.from({ length: AXIS_MAX + 1 }, (_, i) => i);
  const plotBottom = H - axisH;

  return (
    <figure className="m-0" data-testid="distinct-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={plotBottom} stroke="var(--rule)" strokeWidth={1} />
            <text x={x(t)} y={plotBottom + 20} textAnchor="middle" fontSize={13} fill="var(--faint)" className="font-mono">
              {t}
            </text>
          </g>
        ))}
        <text x={(left + W - right) / 2} y={H - 6} textAnchor="middle" fontSize={13} fill="var(--muted)">
          Distinct programs per task (lower is more consistent)
        </text>
        {panels.map((p, pi) => {
          const top = pi * (panelH + panelGap);
          return (
            <g key={p.model}>
              <text x={0} y={top + 18} fontSize={13} fill="var(--faint)" className="font-mono">
                {p.model}
              </text>
              {p.rows.map((r, ri) => {
                const cy = top + panelTitle + ri * rowH + rowH / 2;
                const color = r.ts ? "var(--muted)" : "var(--ink)";
                return (
                  <g key={r.label}>
                    <text x={0} y={cy + 5} fontSize={14} fill={color}>
                      {r.label}
                    </text>
                    <line x1={x(r.a.distinctLo)} x2={x(r.a.distinctHi)} y1={cy} y2={cy} stroke={color} strokeWidth={2} strokeLinecap="round" />
                    <line x1={x(r.a.distinctLo)} x2={x(r.a.distinctLo)} y1={cy - 6} y2={cy + 6} stroke={color} strokeWidth={2} />
                    <line x1={x(r.a.distinctHi)} x2={x(r.a.distinctHi)} y1={cy - 6} y2={cy + 6} stroke={color} strokeWidth={2} />
                    <circle cx={x(r.a.distinct)} cy={cy} r={6} fill={color} stroke="var(--surface)" strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-3 text-[14px] text-faint">
        Each task ran {v02.runsPerTask} times per model and language; identical programs after formatting count once.
      </figcaption>
    </figure>
  );
}
