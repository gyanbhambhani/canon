export function tennis_score(points: string): string {
  const names = ["love", "15", "30", "40"];
  let a = 0;
  let b = 0;
  let over = false;
  for (const c of points) {
    if (over) return "error: point after game";
    if (c === "A") a++;
    else if (c === "B") b++;
    else return "error: bad point";
    if ((a >= 4 || b >= 4) && Math.abs(a - b) >= 2) over = true;
  }
  if (over) return a > b ? "game A" : "game B";
  if (a >= 3 && b >= 3) {
    if (a === b) return "deuce";
    return a > b ? "advantage A" : "advantage B";
  }
  if (a === b) return names[a] + "-all";
  return names[a] + "-" + names[b];
}
