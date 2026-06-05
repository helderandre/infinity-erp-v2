import { PDFDocument } from 'pdf-lib'

/**
 * Lossless PDF compression for client-side upload flows.
 *
 * Re-saves the document via pdf-lib using object streams + a tighter object
 * graph, which removes unused indirect objects, drops document-level
 * metadata that's regenerated, and serialises with deflate streams. Image
 * and font streams inside the PDF are NOT recompressed — quality is
 * preserved.
 *
 * Returns a new File when the result is meaningfully smaller (≥3% saved),
 * otherwise the original file (so we never make uploads larger).
 */
export async function compressPdfLossless(input: File): Promise<File> {
  if (input.type !== 'application/pdf') return input

  try {
    const original = new Uint8Array(await input.arrayBuffer())
    const pdf = await PDFDocument.load(original, {
      ignoreEncryption: true,
      updateMetadata: false,
    })

    const compressed = await pdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
    })

    // Only swap if we saved at least 3% — re-saving sometimes grows tiny PDFs
    // because adding the object-stream header isn't worth it.
    if (compressed.byteLength >= original.byteLength * 0.97) return input

    // Construct a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues.
    const buffer = new ArrayBuffer(compressed.byteLength)
    new Uint8Array(buffer).set(compressed)
    return new File([buffer], input.name, {
      type: 'application/pdf',
      lastModified: Date.now(),
    })
  } catch {
    // Encrypted or malformed PDFs — fall back to the original bytes.
    return input
  }
}
