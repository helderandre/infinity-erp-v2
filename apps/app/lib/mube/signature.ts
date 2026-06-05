import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Valida a assinatura HMAC SHA256 enviada pelo meta-api Mube no header
 * X-Mube-Signature-256. O meta-api assina o body cru com o signing_secret
 * gerado quando se cria a destination via /api/internal/destinations.
 *
 * Comparação timing-safe para evitar timing attacks.
 *
 * Usado para validar webhooks INBOUND (meta-api → ERP).
 * Mensagem assinada = rawBody (sem timestamp).
 */
export function isValidMubeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false
  if (!secret) return false

  const expected = `sha256=${createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')}`

  if (expected.length !== signatureHeader.length) return false

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signatureHeader, 'utf8'),
    )
  } catch {
    return false
  }
}

/**
 * Constrói a mensagem canónica usada nos endpoints tenant-facing do meta-api
 * (ex: POST /api/integrations/meta/replay). Tem que bater bit-a-bit com o que
 * o meta-api recomputa, senão a verificação falha.
 *
 *   message = `${ts}.${METHOD}.${path?query}.${body}`
 *
 * Fonte canónica: meta-api lib/auth/tenant-hmac-guard.ts → buildHmacMessage().
 */
export function buildMubeHmacMessage(
  timestamp: string,
  method: string,
  pathWithQuery: string,
  rawBody: string,
): string {
  return `${timestamp}.${method.toUpperCase()}.${pathWithQuery}.${rawBody}`
}

/**
 * Assina um request OUTBOUND (ERP → meta-api) para endpoints tenant-facing.
 * Devolve o timestamp e a assinatura prontos para colocar nos headers
 * X-Mube-Timestamp e X-Mube-Signature-256.
 *
 * O timestamp é Unix em segundos (string). O meta-api aceita ±5min de skew
 * (anti-replay) — não cachear nem reutilizar para outro request.
 */
export function signMubeRequest(args: {
  method: string
  /** Path + querystring tal como o meta-api vai ver (ex: '/api/integrations/meta/replay') */
  pathWithQuery: string
  /** Body cru (JSON.stringify do payload). Para GET sem body, passar ''. */
  body: string
  secret: string
  /** Override do timestamp (Unix segundos string). Por defeito usa Date.now()/1000. */
  timestamp?: string
}): { timestamp: string; signature: string } {
  const timestamp =
    args.timestamp ?? Math.floor(Date.now() / 1000).toString()
  const message = buildMubeHmacMessage(
    timestamp,
    args.method,
    args.pathWithQuery,
    args.body,
  )
  const hmac = createHmac('sha256', args.secret)
    .update(message, 'utf8')
    .digest('hex')
  return { timestamp, signature: `sha256=${hmac}` }
}
