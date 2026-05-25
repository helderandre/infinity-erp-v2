import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Valida a assinatura HMAC SHA256 enviada pelo meta-api Mube no header
 * X-Mube-Signature-256. O meta-api assina o body cru com o signing_secret
 * gerado quando se cria a destination via /api/internal/destinations.
 *
 * Comparação timing-safe para evitar timing attacks.
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
