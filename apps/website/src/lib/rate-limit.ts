// Simple in-memory sliding-window rate limiter.
// NOTE: per-process only. The Cloudflare worker used a KV namespace shared across
// the edge; here each container instance keeps its own counters. Good enough for
// basic abuse protection on a single-instance deploy; revisit if scaled out.
type Hit = { count: number; resetAt: number };

const store = new Map<string, Hit>();

export function rateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const cur = store.get(key);

  if (!cur || cur.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (cur.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((cur.resetAt - now) / 1000) };
  }
  cur.count += 1;
  return { allowed: true, retryAfter: 0 };
}
