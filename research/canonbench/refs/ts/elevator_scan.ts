export function elevator_scan(start: number, requests: number[], direction: string): number[] {
  const floors = [...new Set(requests)];
  const above = floors.filter((f) => f > start).sort((a, b) => a - b);
  const below = floors.filter((f) => f < start).sort((a, b) => b - a);
  const here = floors.includes(start) ? [start] : [];
  return direction === "up" ? [...here, ...above, ...below] : [...here, ...below, ...above];
}
