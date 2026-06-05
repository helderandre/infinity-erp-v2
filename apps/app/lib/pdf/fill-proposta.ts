import { PDFDocument } from 'pdf-lib'
import { readFile } from 'fs/promises'
import path from 'path'
import type { PropostaData } from '@/types/proposta'

/**
 * Splits a number into [millions, thousands, units, cents] strings
 * for the PDF money fields format: [M].[TTT].[UUU],[CC]
 */
function splitMoney(value: number): [string, string, string, string] {
  const cents = Math.round(value * 100)
  const intPart = Math.floor(cents / 100)
  const centPart = cents % 100

  const millions = Math.floor(intPart / 1_000_000)
  const thousands = Math.floor((intPart % 1_000_000) / 1_000)
  const units = intPart % 1_000

  return [
    millions > 0 ? String(millions) : '',
    millions > 0 ? String(thousands).padStart(3, '0') : thousands > 0 ? String(thousands) : '',
    (millions > 0 || thousands > 0) ? String(units).padStart(3, '0') : units > 0 ? String(units) : '0',
    String(centPart).padStart(2, '0'),
  ]
}

/**
 * Splits a date string DD/MM/YYYY into [day, month, yearLastTwo]
 */
function splitDate(dateStr: string): [string, string, string] {
  const [day, month, year] = dateStr.split('/')
  return [day || '', month || '', year?.slice(-2) || '']
}

const FONT_SIZE_TEXT = 10    // Names, addresses, conditions
const FONT_SIZE_NUMBER = 10  // Money fields, dates
const FONT_SIZE_SMALL = 8   // Small boxes (day, month, year digits)

function safeSetText(
  form: ReturnType<PDFDocument['getForm']>,
  fieldName: string,
  value: string,
  fontSize?: number
) {
  try {
    const field = form.getTextField(fieldName)
    if (fontSize) field.setFontSize(fontSize)
    field.setText(value)
  } catch {
    // Field not found or not fillable — skip silently
  }
}

export async function fillProposta(data: PropostaData): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'proposta-modelo2-decrypted.pdf')
  const templateBytes = await readFile(templatePath)
  const pdf = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()

  // === PAGE 1: IDENTIFICAÇÃO DAS PARTES ===
  safeSetText(form, 'Proprietário', data.proprietario_nome, FONT_SIZE_TEXT)
  // "undefined" is proprietário line 2 — leave blank unless name is very long
  safeSetText(form, 'Proponente', data.proponente_nome, FONT_SIZE_TEXT)
  // "undefined_2" is proponente line 2

  // === PAGE 1: A PROPOSTA ===
  safeSetText(form, 'undefined_3', data.morada, FONT_SIZE_TEXT)
  // "undefined_4" is morada line 2 — for overflow
  safeSetText(form, 'Concelho', data.concelho, FONT_SIZE_TEXT)
  safeSetText(form, 'undefined_5', data.zona, FONT_SIZE_TEXT)

  // Angariação ref — split by dash: "ANG-2025-0001" → before dash and after
  const refParts = data.angariacao_ref.split('-')
  if (refParts.length >= 2) {
    safeSetText(form, 'Angariação n', refParts.slice(0, -1).join('-'), FONT_SIZE_TEXT)
    safeSetText(form, 'undefined_6', refParts[refParts.length - 1], FONT_SIZE_TEXT)
  } else {
    safeSetText(form, 'Angariação n', data.angariacao_ref, FONT_SIZE_TEXT)
  }

  // Natureza da transacção (radio group)
  try {
    const radioGroup = form.getRadioGroup('Group5')
    // The radio has 5 options all named "Escolha1" — select by index
    const natureMap: Record<string, number> = {
      arrendamento: 0,
      propriedade_plena: 1,
      cedencia_posicao: 2,
      superficie: 3,
      outro: 4,
    }
    const idx = natureMap[data.natureza]
    if (idx !== undefined) {
      // Select by option value — all are "Escolha1" so we use widget index
      const widgets = radioGroup.acroField.getWidgets()
      if (widgets[idx]) {
        const onValue = widgets[idx].getOnValue()
        if (onValue) {
          radioGroup.select(onValue.decodeText())
        }
      }
    }
  } catch {
    // Radio group issues — skip
  }

  if (data.natureza === 'outro' && data.natureza_outro) {
    safeSetText(form, 'Plena', data.natureza_outro, FONT_SIZE_TEXT)
  }

  // Financiamento radio
  if (data.tem_financiamento) {
    try {
      const finRadio = form.getRadioGroup('Group6')
      const widgets = finRadio.acroField.getWidgets()
      if (widgets[0]) {
        const onValue = widgets[0].getOnValue()
        if (onValue) finRadio.select(onValue.decodeText())
      }
    } catch {
      // Skip
    }
  }

  // Valor financiamento: fields "Valor financiamento", "undefined_7", "undefined_8", "undefined_9"
  if (data.tem_financiamento && data.valor_financiamento) {
    const [m, t, u, c] = splitMoney(data.valor_financiamento)
    safeSetText(form, 'Valor financiamento', m, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_7', t, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_8', u, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_9', c, FONT_SIZE_NUMBER)
  }

  // Preço: fields "undefined_10" through "undefined_13"
  {
    const [m, t, u, c] = splitMoney(data.preco)
    safeSetText(form, 'undefined_10', m, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_11', t, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_12', u, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_13', c, FONT_SIZE_NUMBER)
  }

  // Valor contrato: "aceitação desta proposta", "undefined_14", "undefined_15", "undefined_16"
  {
    const [m, t, u, c] = splitMoney(data.valor_contrato)
    safeSetText(form, 'aceitação desta proposta', m, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_14', t, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_15', u, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_16', c, FONT_SIZE_NUMBER)
  }

  // Reforço 1: date + value
  if (data.valor_reforco_1 && data.data_reforco_1) {
    const [day, month, yearLast2] = splitDate(data.data_reforco_1)
    safeSetText(form, 'como reforço em', day, FONT_SIZE_SMALL)
    safeSetText(form, 'undefined_17', month, FONT_SIZE_SMALL)
    safeSetText(form, '2', yearLast2, FONT_SIZE_SMALL)

    const [m, t, u, c] = splitMoney(data.valor_reforco_1)
    safeSetText(form, 'undefined_18', m, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_19', t, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_20', u, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_21', c, FONT_SIZE_NUMBER)
  }

  // Reforço 2: date + value
  if (data.valor_reforco_2 && data.data_reforco_2) {
    const [day, month, yearLast2] = splitDate(data.data_reforco_2)
    safeSetText(form, 'como reforço em_2', day, FONT_SIZE_SMALL)
    safeSetText(form, 'undefined_22', month, FONT_SIZE_SMALL)
    safeSetText(form, '2_2', yearLast2, FONT_SIZE_SMALL)

    const [m, t, u, c] = splitMoney(data.valor_reforco_2)
    safeSetText(form, 'undefined_23', m, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_24', t, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_25', u, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_26', c, FONT_SIZE_NUMBER)
  }

  // Valor conclusão: "undefined_27" through "undefined_30"
  {
    const [m, t, u, c] = splitMoney(data.valor_conclusao)
    safeSetText(form, 'undefined_27', m, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_28', t, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_29', u, FONT_SIZE_NUMBER)
    safeSetText(form, 'undefined_30', c, FONT_SIZE_NUMBER)
  }

  // Data proposta: "undefined_31" (day), "undefined_32" (month), "2_3" (year last 2)
  {
    const [day, month, yearLast2] = splitDate(data.data_proposta)
    safeSetText(form, 'undefined_31', day, FONT_SIZE_SMALL)
    safeSetText(form, 'undefined_32', month, FONT_SIZE_SMALL)
    safeSetText(form, '2_3', yearLast2, FONT_SIZE_SMALL)
  }

  // Condições complementares
  if (data.condicoes_complementares) {
    safeSetText(form, 'Complementares', data.condicoes_complementares, FONT_SIZE_TEXT)
  }

  // Page 2 & 3 (Respostas + RGPD) — left blank for manual completion

  // Flatten form so fields are not editable in the output
  form.flatten()

  return pdf.save()
}
