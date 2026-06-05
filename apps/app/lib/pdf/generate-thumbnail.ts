/**
 * Generate a PNG thumbnail from the first page of a PDF file (browser only).
 * Returns a Blob suitable for upload, or null if generation fails.
 */
export async function generatePdfThumbnail(file: File, maxWidth = 800): Promise<Blob | null> {
  if (typeof window === 'undefined') return null
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return null

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)

    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(maxWidth / baseViewport.width, 2)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    await page.render({ canvasContext: ctx, viewport } as any).promise

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.85)
    })
  } catch (err) {
    console.error('Erro ao gerar thumbnail PDF:', err)
    return null
  }
}
