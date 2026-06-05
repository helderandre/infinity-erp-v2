'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, QrCode, Copy, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  title?: string
}

export function SharePropertyQrDialog({ open, onOpenChange, url, title }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !url) return
    setLoading(true)
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 640,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null))
      .finally(() => setLoading(false))
  }, [open, url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Código QR
          </DialogTitle>
          <DialogDescription>
            Aponte a câmara do telemóvel para aceder a esta apresentação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative w-[240px] h-[240px] rounded-xl border bg-white overflow-hidden flex items-center justify-center">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt="QR code" className="w-full h-full object-contain p-3" />
            ) : (
              <span className="text-xs text-muted-foreground">Falha ao gerar QR</span>
            )}
          </div>
          {title && (
            <div className="text-sm font-medium text-center line-clamp-2">{title}</div>
          )}
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1 rounded-full gap-1.5"
              onClick={copy}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar link
            </Button>
            <a
              href={dataUrl || '#'}
              download={`qr-${(title || 'imovel').replace(/\s+/g, '-').toLowerCase()}.png`}
              className="inline-flex items-center justify-center gap-1.5 flex-1 h-9 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
              aria-disabled={!dataUrl}
            >
              <Download className="h-3.5 w-3.5" /> Descarregar
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
