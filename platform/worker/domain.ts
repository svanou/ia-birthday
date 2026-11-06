export const HOURS = 4 * 3600_000;
export const DAY = 86400_000;
export const THEMES = ["forest", "space", "heroes"] as const;
export function sixMonths(now: number) {
  const d = new Date(now);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 6);
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return d.getTime();
}
export interface Party {
  id: string;
  owner: string;
  theme: string;
  names: string;
  status: string;
  purchased_at: number;
  activate_by: number;
  activated_at: number | null;
  ends_at: number | null;
  retain_until: number;
  step: number;
  story: string | null;
  story_approved: number;
  payment_id: string | null;
}
export function phase(p: Party, now = Date.now()) {
  if (p.status === "revoked") return "revoked";
  if (now >= p.retain_until) return "deleted";
  if (p.ends_at) return now < p.ends_at ? "active" : "gallery";
  return now < p.activate_by ? "preparation" : "expired";
}
export function canGenerate(p: Party, kind: string, now = Date.now()) {
  return kind === "trial"
    ? phase(p, now) === "preparation"
    : phase(p, now) === "active";
}
export const isLocal = (mode: string, url: string) =>
  mode === "local" &&
  ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
export function allowed(email: string, list: string) {
  return list
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
