import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFPageTree,
} from 'pdf-lib'

/**
 * Attempts to repair a PDF whose Pages tree or AcroForm references are corrupted.
 * Rebuilds the Pages tree from individual /Page objects found in the context.
 * Returns repaired bytes if the PDF needed repair, or null if it's already healthy.
 */
export async function repairPdfIfNeeded(pdfBytes: Uint8Array): Promise<Uint8Array | null> {
  const pdf = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  })

  // Check if getPages() works — only repair if pages are broken
  try {
    const pages = pdf.getPages()
    if (pages.length > 0) {
      return null // Pages tree is healthy, no repair needed
    }
  } catch {
    // Pages tree is broken — needs repair
    console.log('[repairPdf] Pages tree broken, attempting repair...')
  }

  // Repair: find /Page objects manually in the context
  const ctx = pdf.context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageRefObjs: Array<{ ref: any; dict: PDFDict }> = []

  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict) {
      const t = obj.get(PDFName.of('Type'))
      if (t && t.toString() === '/Page') {
        pageRefObjs.push({ ref, dict: obj })
      }
    }
  }

  if (pageRefObjs.length === 0) {
    return null // No page objects found — can't repair
  }

  // Build new Pages tree
  const pageTreeDict = PDFDict.withContext(ctx)
  pageTreeDict.set(PDFName.of('Type'), PDFName.of('Pages'))

  const kidsArray = PDFArray.withContext(ctx)
  for (const { ref } of pageRefObjs) kidsArray.push(ref)
  pageTreeDict.set(PDFName.of('Kids'), kidsArray)
  pageTreeDict.set(PDFName.of('Count'), ctx.obj(pageRefObjs.length))

  // Use type assertion for PDFPageTree.fromMapWithContext which expects a DictMap
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageTree = PDFPageTree.fromMapWithContext(pageTreeDict as any, ctx)
  const newPagesRef = ctx.register(pageTree)

  // Update catalog
  const catalog = ctx.lookup(ctx.trailerInfo.Root) as PDFDict
  catalog.set(PDFName.of('Pages'), newPagesRef)

  // Set Parent on each page
  for (const { dict } of pageRefObjs) {
    dict.set(PDFName.of('Parent'), newPagesRef)
  }

  // Save repaired bytes — .slice() creates an independent copy
  const repairedBytes = await pdf.save()
  return repairedBytes.slice()
}
