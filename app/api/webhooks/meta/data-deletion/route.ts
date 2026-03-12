import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

// ─── Meta Data Deletion Callback ────────────────────────────────────────────
//
// When a Facebook user requests deletion of their data, Meta sends a POST
// request to this endpoint with a signed_request. We must:
//   1. Verify the signature using our app secret
//   2. Parse the user_id from the payload
//   3. Return a JSON response with a confirmation_code and a status URL
//
// Reference: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

// GET — Meta's dashboard pings this to verify the URL is reachable
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "data-deletion-callback" })
}

// POST — Actual deletion callback from Meta
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const signedRequest = formData.get("signed_request")

    if (!signedRequest || typeof signedRequest !== "string") {
      console.error("[Meta Data Deletion] Missing signed_request")
      return NextResponse.json(
        { error: "Missing signed_request parameter" },
        { status: 400 }
      )
    }

    const appSecret = process.env.META_APP_SECRET
    if (!appSecret) {
      console.error("[Meta Data Deletion] META_APP_SECRET not configured")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    // Parse and verify the signed request
    const data = parseSignedRequest(signedRequest, appSecret)

    if (!data) {
      console.error("[Meta Data Deletion] Invalid signed_request — signature mismatch")
      return NextResponse.json(
        { error: "Invalid signed_request" },
        { status: 403 }
      )
    }

    const userId = data.user_id

    // Generate a unique confirmation code for this deletion request
    const confirmationCode = generateConfirmationCode(userId)

    // Log the deletion request (in production you may want to store this in the DB
    // and actually process the deletion of any data associated with this Meta user)
    console.log(
      `[Meta Data Deletion] Deletion request received for Meta user_id: ${userId} — confirmation_code: ${confirmationCode}`
    )

    // TODO: If you store Meta user IDs in leads.meta_data, you could delete/anonymize
    // those records here. For now we log the request for compliance tracking.
    //
    // Example:
    // const supabase = createAdminClient()
    // await supabase
    //   .from("leads")
    //   .update({ full_name: "Eliminado", email: null, phone: null, meta_data: null })
    //   .contains("meta_data", { user_id: userId })

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://infinity-erp.vercel.app"

    // Meta expects this exact JSON shape
    return NextResponse.json({
      url: `${appUrl}/privacy-policy?deletion=${confirmationCode}`,
      confirmation_code: confirmationCode,
    })
  } catch (err) {
    console.error("[Meta Data Deletion] Error processing request:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a Meta signed_request.
 * The signed_request is two base64url-encoded strings joined by a dot:
 *   <signature>.<payload>
 *
 * The signature is an HMAC-SHA256 of the payload using the app secret.
 */
function parseSignedRequest(
  signedRequest: string,
  secret: string
): { user_id: string; algorithm: string; issued_at: number } | null {
  const [encodedSig, encodedPayload] = signedRequest.split(".")

  if (!encodedSig || !encodedPayload) {
    return null
  }

  // Decode the signature
  const sig = base64UrlDecode(encodedSig)

  // Compute expected signature
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest()

  // Verify signature using timing-safe comparison
  if (!crypto.timingSafeEqual(sig, expectedSig)) {
    return null
  }

  // Decode and parse the payload
  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf-8"))

  if (payload.algorithm?.toUpperCase() !== "HMAC-SHA256") {
    console.error(
      `[Meta Data Deletion] Unsupported algorithm: ${payload.algorithm}`
    )
    return null
  }

  return payload
}

/**
 * Decode a base64url-encoded string to a Buffer.
 */
function base64UrlDecode(input: string): Buffer {
  // Replace base64url characters with standard base64
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  return Buffer.from(base64, "base64")
}

/**
 * Generate a deterministic but unique confirmation code for a deletion request.
 */
function generateConfirmationCode(userId: string): string {
  const timestamp = Date.now()
  const hash = crypto
    .createHash("sha256")
    .update(`${userId}-${timestamp}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase()

  return `INF-DEL-${hash}`
}
