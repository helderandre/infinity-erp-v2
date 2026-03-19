import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface FichaVisitaData {
  angariacao: string // property ref
  morada: string
  concelho: string
}

/**
 * Generates a branded ficha de visita PDF with property fields pre-filled.
 * Layout matches the Infinity Group / RE/MAX Convictus template.
 */
export async function fillFichaVisita(data: FichaVisitaData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()

  const dark = rgb(0.12, 0.12, 0.12)
  const gray = rgb(0.45, 0.45, 0.45)
  const lightGray = rgb(0.75, 0.75, 0.75)
  const lineColor = rgb(0.85, 0.85, 0.85)
  const mx = 45
  let y = height - 50

  // Header
  page.drawText('INFINITY GROUP', { x: mx, y, font: fontBold, size: 14, color: dark })
  page.drawText('Real Estate Signature by Filipe Pereira', { x: mx, y: y - 14, font, size: 7, color: gray })
  y -= 10
  page.drawText('RELATÓRIO DE VISITA', { x: width - mx - fontBold.widthOfTextAtSize('RELATÓRIO DE VISITA', 12), y, font: fontBold, size: 12, color: dark })

  y -= 40
  page.drawLine({ start: { x: mx, y }, end: { x: width - mx, y }, thickness: 0.5, color: lineColor })
  y -= 20

  // Pre-filled fields
  const fieldRow = (label: string, value: string, x: number, w: number, yPos: number) => {
    page.drawText(label, { x, y: yPos, font, size: 7, color: gray })
    page.drawText(value || '', { x, y: yPos - 11, font: fontBold, size: 9, color: dark })
    page.drawLine({ start: { x, y: yPos - 14 }, end: { x: x + w, y: yPos - 14 }, thickness: 0.3, color: lineColor })
  }

  fieldRow('Data / Date', '____/____/2025', mx, 120, y)
  fieldRow('Hora / Hour', '____:____', mx + 140, 80, y)
  fieldRow('Angariação / Listing', data.angariacao, mx + 240, width - mx * 2 - 240, y)
  y -= 30
  fieldRow('Morada / Address', data.morada, mx, 340, y)
  fieldRow('Concelho / District', data.concelho, mx + 360, width - mx * 2 - 360, y)
  y -= 35
  page.drawLine({ start: { x: mx, y: y + 5 }, end: { x: width - mx, y: y + 5 }, thickness: 0.5, color: lineColor })

  // Client fields (blank)
  fieldRow('Nome do Cliente / Client\'s Name', '', mx, 300, y)
  fieldRow('BI/CC / National ID Card', '', mx + 320, width - mx * 2 - 320, y)
  y -= 30
  fieldRow('Telefone / Phone', '', mx, 200, y)
  fieldRow('E-mail / Email', '', mx + 220, width - mx * 2 - 220, y)
  y -= 35
  page.drawLine({ start: { x: mx, y: y + 5 }, end: { x: width - mx, y: y + 5 }, thickness: 0.5, color: lineColor })

  // Ratings
  const LABELS = [
    'Planta do Imóvel / Floorplan', 'Qualidade de Construção / Construction', 'Acabamentos / Finishes',
    'Exposição Solar / Sun Exposition', 'Localização / Location', 'Valor / Value',
    'Apreciação Global / Overall', 'Serviço do Agente / Agent Service',
  ]
  const SCALE = ['Mau/Bad', 'Médio/Medium', 'Bom/Good', 'Muito Bom/Very Good']
  const colW = (width - mx * 2 - 200) / 4
  const ratingX = mx + 200

  SCALE.forEach((lbl, i) => {
    const cx = ratingX + i * colW + colW / 2
    page.drawText(lbl, { x: cx - font.widthOfTextAtSize(lbl, 5.5) / 2, y, font, size: 5.5, color: gray })
  })
  y -= 5

  LABELS.forEach((label, idx) => {
    y -= 20
    page.drawText(label, { x: mx, y: y + 2, font, size: 7.5, color: dark })
    SCALE.forEach((_, i) => {
      const cx = ratingX + i * colW + colW / 2
      page.drawCircle({ x: cx, y: y + 4, size: 5, borderWidth: 0.8, borderColor: lightGray, color: rgb(1, 1, 1) })
    })
    if (idx < LABELS.length - 1) {
      page.drawLine({ start: { x: mx, y: y - 6 }, end: { x: width - mx, y: y - 6 }, thickness: 0.2, color: lineColor })
    }
  })
  y -= 25
  page.drawLine({ start: { x: mx, y }, end: { x: width - mx, y }, thickness: 0.5, color: lineColor })

  // Questions
  const qBox = (label: string, h: number) => {
    y -= 18
    page.drawText(label, { x: mx, y, font: fontBold, size: 7.5, color: dark })
    y -= h
    page.drawRectangle({ x: mx, y, width: width - mx * 2, height: h - 5, borderWidth: 0.5, borderColor: lineColor, color: rgb(0.98, 0.98, 0.98) })
    y -= 5
  }
  qBox('O que mais gostou? / What did you like most?', 35)
  qBox('O que menos gostou? / What didn\'t you like?', 35)

  y -= 15
  page.drawText('Compraria/arrendaria? Would you buy/rent?', { x: mx, y, font: fontBold, size: 7.5, color: dark })
  page.drawCircle({ x: mx + 260, y: y + 3, size: 4, borderWidth: 0.5, borderColor: lightGray })
  page.drawText('Sim/Yes', { x: mx + 268, y, font, size: 7, color: gray })
  page.drawCircle({ x: mx + 310, y: y + 3, size: 4, borderWidth: 0.5, borderColor: lightGray })
  page.drawText('Não/No', { x: mx + 318, y, font, size: 7, color: gray })
  page.drawText('Porquê? / Why? ___________________________', { x: mx + 360, y, font, size: 7, color: gray })

  y -= 18
  page.drawText('Quanto vale para si este imóvel? / Worth to you?', { x: mx, y, font: fontBold, size: 7.5, color: dark })
  page.drawText('________________€', { x: mx + 300, y, font, size: 9, color: dark })

  y -= 18
  page.drawText('Tem imóvel para vender? / Property to sell?', { x: mx, y, font: fontBold, size: 7.5, color: dark })
  page.drawCircle({ x: mx + 260, y: y + 3, size: 4, borderWidth: 0.5, borderColor: lightGray })
  page.drawText('Sim', { x: mx + 268, y, font, size: 7, color: gray })
  page.drawCircle({ x: mx + 295, y: y + 3, size: 4, borderWidth: 0.5, borderColor: lightGray })
  page.drawText('Não', { x: mx + 303, y, font, size: 7, color: gray })

  // Discovery
  y -= 22
  page.drawLine({ start: { x: mx, y: y + 5 }, end: { x: width - mx, y: y + 5 }, thickness: 0.5, color: lineColor })
  page.drawText('COMO CONHECEU? / How did you find out?', { x: mx, y, font: fontBold, size: 7, color: dark })
  y -= 13
  let sx = mx
  for (const s of ['Internet', 'Revista', 'Placa', 'Montra', 'Folhetos', 'Agente', 'Outro']) {
    page.drawCircle({ x: sx, y: y + 3, size: 3.5, borderWidth: 0.5, borderColor: lightGray })
    page.drawText(s, { x: sx + 7, y, font, size: 6.5, color: gray })
    sx += font.widthOfTextAtSize(s, 6.5) + 22
  }

  // Signatures
  y -= 28
  page.drawLine({ start: { x: mx, y: y + 5 }, end: { x: width - mx, y: y + 5 }, thickness: 0.5, color: lineColor })
  page.drawText('Agente / Agent', { x: mx, y, font: fontBold, size: 7, color: dark })
  page.drawText('Assinatura do Cliente / Client', { x: mx + 280, y, font: fontBold, size: 7, color: dark })
  y -= 28
  page.drawLine({ start: { x: mx, y }, end: { x: mx + 200, y }, thickness: 0.5, color: lightGray })
  page.drawLine({ start: { x: mx + 280, y }, end: { x: mx + 480, y }, thickness: 0.5, color: lightGray })

  // Consent
  y -= 15
  page.drawCircle({ x: mx + 5, y: y + 3, size: 3, borderWidth: 0.4, borderColor: lightGray })
  page.drawText('autorizo', { x: mx + 12, y, font, size: 6, color: gray })
  page.drawCircle({ x: mx + 50, y: y + 3, size: 3, borderWidth: 0.4, borderColor: lightGray })
  page.drawText('não autorizo a partilha de dados com o proprietário.', { x: mx + 57, y, font, size: 6, color: gray })

  y -= 15
  page.drawText('CONVICTUS MEDIAÇÃO IMOBILIÁRIA, LDA / LIC 4719 – AMI', { x: mx, y, font, size: 5.5, color: lightGray })

  return pdf.save()
}
