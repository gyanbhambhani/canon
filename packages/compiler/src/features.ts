/**
 * Feature switches. Every v0.3 and v0.4 language change can be turned off on its own, so an
 * experiment can ablate it and attribute any effect (docs/v0.3-proposal.md, "Ablation switches";
 * docs/v0.4-design.md). With every switch off, the compiler behaves as Canon v0.2.
 *
 * Language switches change what parses, what fmt prints and what the checker accepts; the CLI
 * exposes each as `--no-<name>`. `py` selects the printed surface and is exposed as `--syntax py`.
 * Toolchain switches (autofix, contract fuzzing, the capability guard) live in the CLI and runtime.
 */
export interface Features {
  /** fmt breaks an over-long statement's outermost bracket one item per line (L001 becomes mechanical). */
  wrap: boolean;
  /** `break` exits the innermost loop. */
  break: boolean;
  /** `for (a, b) in xs` destructures tuple elements. */
  destructure: boolean;
  /** `&&`, `||` and `!` are the canonical logical operators (`and`, `or`, `not` still parse). */
  symbols: boolean;
  /**
   * Sealed effects: test blocks are effect-checked (fs and net must be declared; io, time and rand
   * are virtual under the test host), and requires/ensures must be pure (E103).
   */
  sealedEffects: boolean;
  /** T001 diagnostics carry ranked candidate patches in `data.suggestions`. */
  suggestions: boolean;
  /**
   * v0.4: function types carry effects (`fn(String) -> Unit effects: io`). Calling a function
   * value performs its type's effects, and an effectful function cannot be passed where a pure
   * function type is expected, so every function's own signature bounds what it can do.
   */
  fnEffects: boolean;
  /**
   * v0.4: fmt prints the Python-shaped surface, Canon-Py (docs/v0.4-design.md), and diagnostics
   * speak it. Off by default until Experiment 1 compares the two syntaxes. The parser accepts both
   * surfaces either way, so fmt migrates a file in either direction.
   */
  py: boolean;
}

/** Switches with a `--no-<name>` CLI flag (py is chosen with `--syntax`). */
export const FEATURE_NAMES = ["wrap", "break", "destructure", "symbols", "sealedEffects", "suggestions", "fnEffects"] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Canon v0.4: every language switch on, brace syntax (the default). */
export const V04: Features = {
  wrap: true,
  break: true,
  destructure: true,
  symbols: true,
  sealedEffects: true,
  suggestions: true,
  fnEffects: true,
  py: false,
};

/** Canon v0.4 with the Canon-Py surface (`--syntax py`). */
export const V04_PY: Features = { ...V04, py: true };

/** Canon v0.3: the v0.3 switches on, nothing from v0.4. */
export const V03: Features = {
  wrap: true,
  break: true,
  destructure: true,
  symbols: true,
  sealedEffects: true,
  suggestions: true,
  fnEffects: false,
  py: false,
};

/** Canon v0.2: everything off. */
export const V02: Features = {
  wrap: false,
  break: false,
  destructure: false,
  symbols: false,
  sealedEffects: false,
  suggestions: false,
  fnEffects: false,
  py: false,
};

let active: Features = V04;

/** The switches in force for the current compiler call. */
export function features(): Features {
  return active;
}

/** Run `f` with some switches changed (the compiler is synchronous, so this nests safely). */
export function withFeatures<T>(f: Partial<Features> | undefined, fn: () => T): T {
  if (f === undefined) return fn();
  const saved = active;
  active = { ...saved, ...f };
  try {
    return fn();
  } finally {
    active = saved;
  }
}

/** Options accepted by check, fmt, analyze and compileJs. */
export interface CompileOptions {
  features?: Partial<Features>;
}

/** CLI flag name for a switch: sealedEffects -> sealed-effects. */
export function flagName(f: FeatureName): string {
  return f.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}
