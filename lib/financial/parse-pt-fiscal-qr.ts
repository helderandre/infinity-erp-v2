/**
 * Parser do QR code fiscal português (Portaria nº 195/2020).
 *
 * Formato: campos separados por `*`, cada um no formato `LETRA:VALOR` ou `LETRAN:VALOR`.
 *
 * Exemplo:
 *   A:500000000*B:999999990*C:PT*D:FT*E:N*F:20240115*G:FT 2024/123*H:CSDF7T5H-123*
 *   I1:PT*I7:100.00*I8:23.00*N:23.00*O:123.00*Q:abcd*R:1234
 *
 * Campos relevantes:
 * - A: NIF do emissor
 * - B: NIF do adquirente (cliente)
 * - C: País do adquirente
 * - D: Tipo de documento (FT=Fatura, FS=Fatura Simplificada, FR=Fatura-Recibo, NC=Nota Crédito, ND=Nota Débito)
 * - F: Data do documento (YYYYMMDD)
 * - G: Identificação única do documento (ex: "FT 2024/123")
 * - H: ATCUD (código de validação AT)
 * - I7: Base tributável à taxa normal (sem IVA)
 * - I8: Total IVA à taxa normal
 * - I3..I6: Outras taxas de IVA (isento, reduzida, intermédia)
 * - N: Total de IVA
 * - O: Total do documento com impostos
 * - Q: Hash dos 4 caracteres
 * - R: Nº do certificado do programa
 */

import type { ReceiptScanResult } from '@/types/financial'

/** Códigos de tipo de documento → label PT */
const DOC_TYPE_LABELS: Record<string, string> = {
  FT: 'Fatura',
  FS: 'Fatura Simplificada',
  FR: 'Fatura-Recibo',
  NC: 'Nota de Crédito',
  ND: 'Nota de Débito',
  RC: 'Recibo',
  RG: 'Recibo',
}

/**
 * Tenta fazer parse de uma string como QR code fiscal AT português.
 * Retorna null se não for um QR fiscal válido.
 */
export function parsePtFiscalQr(qrText: string): ReceiptScanResult | null {
  if (!qrText || typeof qrText !== 'string') return null

  // Validação rápida: deve conter pelo menos os campos A: e O: (NIF emissor + total)
  if (!/A:\d/.test(qrText) || !/[*^]O:/.test('*' + qrText)) return null

  // Os separadores podem variar (alguns leitores devolvem `*`, outros `\n`).
  // Normalizamos para `*`.
  const normalized = qrText.replace(/\r?\n/g, '*').trim()
  const fields: Record<string, string> = {}

  for (const part of normalized.split('*')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx <= 0) continue
    const key = trimmed.slice(0, colonIdx).trim().toUpperCase()
    const value = trimmed.slice(colonIdx + 1).trim()
    if (key && value) fields[key] = value
  }

  // Sanity check: NIF emissor obrigatório
  if (!fields.A || !/^\d{9}$/.test(fields.A)) return null

  // Total — campo O é obrigatório no QR fiscal
  const totalGross = fields.O ? parseFloat(fields.O.replace(',', '.')) : null
  if (totalGross == null || isNaN(totalGross)) return null

  // Base tributável: somar todas as bases (I7 normal, I5 reduzida, I3 isento, etc.)
  let totalNet = 0
  let hasNet = false
  for (const k of ['I3', 'I5', 'I7', 'I9', 'I11']) {
    if (fields[k]) {
      const v = parseFloat(fields[k].replace(',', '.'))
      if (!isNaN(v)) { totalNet += v; hasNet = true }
    }
  }

  // Total IVA — campo N
  const totalVat = fields.N ? parseFloat(fields.N.replace(',', '.')) : null

  // Se não temos base tributável explícita, deduz a partir do total - IVA
  if (!hasNet && totalVat != null && !isNaN(totalVat)) {
    totalNet = totalGross - totalVat
    hasNet = true
  }

  // Percentagem de IVA implícita
  let vatPct: number | null = null
  if (hasNet && totalNet > 0 && totalVat != null && !isNaN(totalVat)) {
    vatPct = Math.round((totalVat / totalNet) * 100)
  }

  // Data: YYYYMMDD → YYYY-MM-DD
  let invoiceDate: string | null = null
  if (fields.F && /^\d{8}$/.test(fields.F)) {
    invoiceDate = `${fields.F.slice(0, 4)}-${fields.F.slice(4, 6)}-${fields.F.slice(6, 8)}`
  }

  // Tipo de documento + número
  const docType = fields.D ? DOC_TYPE_LABELS[fields.D.toUpperCase()] || fields.D : null
  const invoiceNumber = fields.G || null

  // Descrição automática a partir do tipo de documento
  const description = docType
    ? `${docType}${invoiceNumber ? ` ${invoiceNumber}` : ''}`
    : invoiceNumber || null

  return {
    entity_name: null, // QR fiscal não inclui nome — só NIF
    entity_nif: fields.A,
    amount_net: hasNet ? Number(totalNet.toFixed(2)) : null,
    amount_gross: Number(totalGross.toFixed(2)),
    vat_amount: totalVat != null && !isNaN(totalVat) ? Number(totalVat.toFixed(2)) : null,
    vat_pct: vatPct,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    description,
    category: null,
    confidence: 1, // QR fiscal é dado oficial → confiança máxima
    field_confidences: {
      entity_nif: 1,
      amount_net: hasNet ? 1 : 0,
      amount_gross: 1,
      vat_amount: totalVat != null ? 1 : 0,
      vat_pct: vatPct != null ? 1 : 0,
      invoice_number: invoiceNumber ? 1 : 0,
      invoice_date: invoiceDate ? 1 : 0,
    },
  }
}
