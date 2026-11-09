export type Box = { x: number; y: number; w: number; h: number };

export const TARGET_RADIUS = 0.015;
export const SESSION_TTL_MS = 60 * 60 * 1000;
export const LEADERBOARD_SIZE = 10;
export const NAME_MAX = 24;

export function hitTest(x: number, y: number, box: Box, heightPerWidth: number) {
  const dx = Math.max(box.x - x, 0, x - (box.x + box.w));
  const dy = Math.max(box.y - y, 0, y - (box.y + box.h)) * heightPerWidth;
  return dx * dx + dy * dy <= TARGET_RADIUS * TARGET_RADIUS;
}

export function isExpired(session: { ttl: number }, now: number) {
  return now >= session.ttl * 1000;
}

export function qualifies(elapsedMs: number, topTimes: number[]) {
  if (topTimes.length < LEADERBOARD_SIZE) return true
  if (topTimes.length > 0 && elapsedMs < topTimes.at(-1)!) return true 
  return false;
}

export function cleanName(name: unknown) {
  if (typeof name !== "string") return null;
  const cleaned = name.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 && cleaned.length <= NAME_MAX ? cleaned : null;
}
