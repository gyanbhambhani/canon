export function tic_tac_toe(board: string[]): string {
  const cells = board.join("").split("");
  const nx = cells.filter((c) => c === "X").length;
  const no = cells.filter((c) => c === "O").length;
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const has = (p: string) => lines.some((l) => l.every((i) => cells[i] === p));
  const xw = has("X");
  const ow = has("O");
  if (nx !== no && nx !== no + 1) return "invalid";
  if (xw && ow) return "invalid";
  if (xw && nx !== no + 1) return "invalid";
  if (ow && nx !== no) return "invalid";
  if (xw) return "X wins";
  if (ow) return "O wins";
  if (nx + no === 9) return "draw";
  return "in progress";
}
