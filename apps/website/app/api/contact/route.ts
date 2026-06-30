import { NextResponse } from "next/server";
import { createAnonServerClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (v == null ? "" : String(v).slice(0, max));

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const rl = rateLimit(`contact:${ip}`);
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

  // Honeypot: silently accept (and discard) bot submissions that fill "company".
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ success: true });
  }

  const name = str(body.name, 200).trim();
  const email = str(body.email, 200).trim();
  const message = str(body.message, 2000).trim();
  const phone = str(body.phone, 50).trim();

  if (!name) return NextResponse.json({ success: false, error: "missing_name" }, { status: 400 });
  if (!email)
    return NextResponse.json({ success: false, error: "missing_email" }, { status: 400 });
  if (!message)
    return NextResponse.json({ success: false, error: "missing_message" }, { status: 400 });

  try {
    const supabase = createAnonServerClient();
    const { error } = await supabase.from("contact_form_submissions").insert({
      name,
      email,
      phone: phone || null,
      message,
    });

    if (error) {
      return NextResponse.json({ success: false, error: "insert_failed" }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "db_unreachable" }, { status: 502 });
  }
}

export function GET() {
  return NextResponse.json({ success: false, error: "method_not_allowed" }, { status: 405 });
}
