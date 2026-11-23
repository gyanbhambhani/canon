import { httpPost } from "./http";

export function variant_name(index: number): string {
  if (index === 0) return "control";
  if (index === 1) return "treatment";
  return "holdout";
}

export function hash_bucket(user_id: number, buckets: number): number {
  return (user_id * 2654435 + 12345) % buckets;
}

export function sticky_variant(user_id: number): string {
  return variant_name(hash_bucket(user_id, 3));
}

export function random_variant(): string {
  return variant_name(Math.floor(Math.random() * 3));
}

export function assign_variant(user_id: number, sticky: boolean): string {
  if (sticky) return sticky_variant(user_id);
  return random_variant();
}

export function assignment_payload(experiment: string, user_id: number, variant: string): string {
  return "experiment=" + experiment + "&user=" + String(user_id) + "&variant=" + variant;
}

export function record_assignment(api: string, experiment: string, user_id: number, variant: string): boolean {
  try {
    httpPost(api + "/assignments", assignment_payload(experiment, user_id, variant));
    return true;
  } catch {
    return false;
  }
}

export function enroll(api: string, experiment: string, user_id: number, sticky: boolean): string {
  const variant = assign_variant(user_id, sticky);
  if (!record_assignment(api, experiment, user_id, variant)) return "control";
  return variant;
}
