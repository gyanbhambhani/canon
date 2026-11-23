type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function bowling_score(rolls: number[]): Result<number> {
  const fail = (error: string): Result<number> => ({ ok: false, error });
  if (rolls.some((r) => r < 0 || r > 10)) return fail("invalid roll");
  let i = 0;
  let score = 0;
  const at = (k: number) => rolls[k];
  for (let frame = 1; frame <= 9; frame++) {
    if (i >= rolls.length) return fail("incomplete game");
    if (at(i) === 10) {
      i += 1;
      continue;
    }
    if (i + 1 >= rolls.length) return fail("incomplete game");
    if (at(i) + at(i + 1) > 10) return fail("too many pins in frame " + frame);
    i += 2;
  }
  // frame 10
  if (i + 1 >= rolls.length) return fail("incomplete game");
  let tenth: number;
  if (at(i) === 10) {
    if (i + 2 >= rolls.length) return fail("incomplete game");
    if (at(i + 1) !== 10 && at(i + 1) + at(i + 2) > 10) return fail("too many pins in frame 10");
    tenth = 3;
  } else {
    if (at(i) + at(i + 1) > 10) return fail("too many pins in frame 10");
    if (at(i) + at(i + 1) === 10) {
      if (i + 2 >= rolls.length) return fail("incomplete game");
      tenth = 3;
    } else tenth = 2;
  }
  if (i + tenth < rolls.length) return fail("too many rolls");
  // scoring
  let k = 0;
  for (let frame = 1; frame <= 9; frame++) {
    if (rolls[k] === 10) {
      score += 10 + rolls[k + 1] + rolls[k + 2];
      k += 1;
    } else if (rolls[k] + rolls[k + 1] === 10) {
      score += 10 + rolls[k + 2];
      k += 2;
    } else {
      score += rolls[k] + rolls[k + 1];
      k += 2;
    }
  }
  for (; k < rolls.length; k++) score += rolls[k];
  return { ok: true, value: score };
}
