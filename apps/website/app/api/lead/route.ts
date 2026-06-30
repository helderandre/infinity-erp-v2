import { NextResponse } from "next/server";
import { createAnonServerClient } from "@/lib/supabase-server";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) =>
  v == null ? null : String(v).slice(0, max);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Coerce malformed ids to null (matches the worker's isUuid guard) so a bad
// value becomes a clean lead instead of an RPC error / 502.
const uuidOrNull = (v: unknown) =>
  typeof v === "string" && UUID_RE.test(v) ? v : null;

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const rl = rateLimit(`lead:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "rate_limited", retry_after_seconds: rl.retryAfter },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const turnstileToken = body.turnstileToken as string | undefined;
  const name = str(body.name, 200);
  if (!turnstileToken) {
    return NextResponse.json(
      { success: false, error: "missing_turnstile_token" },
      { status: 400 },
    );
  }
  if (!name || !name.trim()) {
    return NextResponse.json({ success: false, error: "missing_name" }, { status: 400 });
  }
  const phone = str(body.phone, 50);
  const email = str(body.email, 200);
  if (!phone && !email) {
    return NextResponse.json({ success: false, error: "missing_contact" }, { status: 400 });
  }

  const ts = await verifyTurnstile(turnstileToken, ip);
  if (!ts.success) {
    const misconfigured = ts.errorCodes.includes("turnstile_misconfigured");
    return NextResponse.json(
      {
        success: false,
        error: misconfigured ? "turnstile_misconfigured" : "turnstile_failed",
        codes: ts.errorCodes,
      },
      { status: misconfigured ? 500 : 403 },
    );
  }

  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase.rpc("create_website_lead", {
      p_name: name,
      p_phone: phone,
      p_email: email,
      p_message: str(body.message, 2000),
      p_consent: !!body.consent,
      p_property_id: uuidOrNull(body.propertyId),
      p_property_slug: str(body.propertySlug, 200),
      p_property_title: str(body.propertyTitle, 500),
      p_property_external_ref: str(body.propertyExternalRef, 100),
      p_consultant_id: uuidOrNull(body.consultantId),
      p_form_url: str(body.formUrl, 500),
    });

    if (error) {
      return NextResponse.json({ success: false, error: "rpc_failed" }, { status: 502 });
    }

    const leadId =
      typeof data === "string"
        ? data
        : (data as { id?: string } | null)?.id ??
          (Array.isArray(data) ? (data[0] as string) : null) ??
          null;

    return NextResponse.json({ success: true, leadId });
  } catch {
    return NextResponse.json({ success: false, error: "rpc_unreachable" }, { status: 502 });
  }
}

export function GET() {
  return NextResponse.json({ success: false, error: "method_not_allowed" }, { status: 405 });
}
