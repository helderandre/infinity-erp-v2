import puppeteer from 'puppeteer-core'
import type { Browser, PDFOptions } from 'puppeteer-core'

let cachedBrowser: Browser | null = null

function resolveExecutablePath(): string {
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH
  if (explicit) return explicit

  // Sensible platform fallbacks for local dev
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }
  // Linux
  return '/usr/bin/chromium-browser'
}

async function getBrowser(): Promise<Browser> {
  if (cachedBrowser && cachedBrowser.connected) return cachedBrowser
  cachedBrowser = await puppeteer.launch({
    executablePath: resolveExecutablePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  })
  return cachedBrowser
}

export type PdfFormat = 'ficha' | 'presentation'

interface GeneratePdfOptions {
  url: string
  format: PdfFormat
}

export async function generatePdf({ url, format }: GeneratePdfOptions): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    // Surface console errors / failed requests for debugging
    page.on('pageerror', (err) =>
      console.error('[pdf] pageerror:', (err as Error).message),
    )
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[pdf] console.error:', msg.text())
    })
    page.on('requestfailed', (req) =>
      console.error('[pdf] requestfailed:', req.url(), req.failure()?.errorText),
    )

    // Viewport must match the intended PDF page size so the SSR layout lines up
    if (format === 'presentation') {
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 })
    } else {
      // A4 @ 96dpi
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })
    }

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60_000,
    })
    if (!response || !response.ok()) {
      throw new Error(
        `navegação falhou (${response?.status() ?? 'sem resposta'}) → ${url}`,
      )
    }

    // Give images / webfonts a moment after network idle
    await new Promise((r) => setTimeout(r, 800))

    const pdfOptions: PDFOptions =
      format === 'presentation'
        ? {
            // 16:9 slide — width>height makes it landscape; omit `landscape` flag
            // since it would swap the dimensions.
            width: '1280px',
            height: '720px',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          }
        : {
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          }

    const buffer = await page.pdf(pdfOptions)
    return Buffer.from(buffer)
  } finally {
    await page.close()
  }
}

export async function closePdfBrowser() {
  if (cachedBrowser) {
    await cachedBrowser.close().catch(() => {})
    cachedBrowser = null
  }
}
