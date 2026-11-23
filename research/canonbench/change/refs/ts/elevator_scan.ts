export function elevator_scan(start: number, requests: number[], direction: string): number[] {
  const floors = [...new Set(requests)];
  const above = floors.filter((f) => f > start).sort((a, b) => a - b);
  const below = floors.filter((f) => f < start).sort((a, b) => b - a);
  const here = floors.includes(start) ? [start] : [];
  const nearestUp = below.length === 0 || (above.length > 0 && above[0] - start <= start - below[0]);
  const up = direction === "up" || (direction === "nearest" && nearestUp);
  return up ? [...here, ...above, ...below] : [...here, ...below, ...above];
}
