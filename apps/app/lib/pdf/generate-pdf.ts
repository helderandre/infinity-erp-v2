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
  console.log(`[pdf] start format=${format} url=${url}`)
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
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
      timeout: 90_000,
    })
    if (!response || !response.ok()) {
      throw new Error(
        `navegação falhou (${response?.status() ?? 'sem resposta'}) → ${url}`,
      )
    }

    // next/image defaults images to loading="lazy" — in a fixed-viewport PDF
    // render, that means anything below the fold never actually loads. Scroll
    // the page top→bottom to force lazy-loaded images to kick off, then wait.
    await page.evaluate(async () => {
      const step = 400
      const maxScroll = document.documentElement.scrollHeight
      for (let y = 0; y <= maxScroll; y += step) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 50))
      }
      window.scrollTo(0, 0)
    })

    // Wait for every <img> to finish loading (or fail). networkidle2 is not
    // strict enough for R2-hosted remotes — dozens of images can still be in
    // flight when it returns, producing PDFs with missing/cropped photos.
    await page.evaluate(async () => {
      const imgs = Array.from(document.images)
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete && img.naturalHeight !== 0) return resolve()
              const done = () => resolve()
              img.addEventListener('load', done, { once: true })
              img.addEventListener('error', done, { once: true })
              // Safety timeout per image so one dead URL can't hang the run
              setTimeout(done, 20_000)
            }),
        ),
      )
    })
    // Webfonts (Cormorant Garamond etc.)
    await page.evaluate(() => (document as any).fonts?.ready ?? Promise.resolve())
    // Settle tick
    await new Promise((r) => setTimeout(r, 400))

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
    console.log(`[pdf] done format=${format} bytes=${buffer.length}`)
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
