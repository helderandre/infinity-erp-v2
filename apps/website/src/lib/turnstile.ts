// Server-side Cloudflare Turnstile verification (mirrors the worker's /api/lead flow).
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// Cloudflare "always passes" test secret — only used outside production.
const TEST_SECRET = "1x0000000000000000000000000000000AA";

export async function verifyTurnstile(
  token: string,
  remoteip?: string,
): Promise<{ success: boolean; errorCodes: string[] }> {
  const secret =
    process.env.TURNSTILE_SECRET ||
    (process.env.NODE_ENV !== "production" ? TEST_SECRET : "");

  // Fail-closed in production when no secret is configured.
  if (!secret) return { success: false, errorCodes: ["turnstile_misconfigured"] };

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteip && remoteip !== "unknown") body.append("remoteip", remoteip);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body });
    const data = (await res.json()) as {
      success?: boolean;
      ["error-codes"]?: string[];
    };
    return { success: !!data.success, errorCodes: data["error-codes"] ?? [] };
  } catch {
    return { success: false, errorCodes: ["turnstile_unreachable"] };
  }
}
