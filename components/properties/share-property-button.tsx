'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Share2,
  Mail,
  MessageCircle,
  QrCode,
  Link as LinkIcon,
  Linkedin,
  Facebook,
} from 'lucide-react'
import { SharePropertyChannelDialog } from './share-channel-dialog'
import { SharePropertyQrDialog } from './share-qr-dialog'

interface Props {
  propertyId: string
  propertySlug: string | null
  propertyTitle: string
}

export function SharePropertyButton({
  propertyId,
  propertySlug,
  propertyTitle,
}: Props) {
  const [open, setOpen] = useState(false)
  const [channelDialog, setChannelDialog] = useState<'email' | 'whatsapp' | null>(
    null,
  )
  const [qrOpen, setQrOpen] = useState(false)

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const origin = window.location.origin
    return `${origin}/apresentacao/${propertySlug || propertyId}`
  }, [propertyId, propertySlug])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Link copiado')
      setOpen(false)
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const shareSocial = (network: 'linkedin' | 'facebook') => {
    const encoded = encodeURIComponent(publicUrl)
    const text = encodeURIComponent(propertyTitle)
    const href =
      network === 'linkedin'
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`
        : `https://www.facebook.com/sharer/sharer.php?u=${encoded}&t=${text}`
    window.open(href, '_blank', 'noopener,noreferrer,width=720,height=640')
    setOpen(false)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            title="Partilhar"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 p-1.5">
          <ActionRow icon={LinkIcon} label="Copiar link" onClick={copyLink} />
          <ActionRow
            icon={Mail}
            label="Email"
            onClick={() => {
              setChannelDialog('email')
              setOpen(false)
            }}
          />
          <ActionRow
            icon={MessageCircle}
            label="WhatsApp"
            onClick={() => {
              setChannelDialog('whatsapp')
              setOpen(false)
            }}
          />
          <ActionRow
            icon={QrCode}
            label="Código QR"
            onClick={() => {
              setQrOpen(true)
              setOpen(false)
            }}
          />
          <div className="h-px bg-border my-1" />
          <ActionRow
            icon={Linkedin}
            label="LinkedIn"
            onClick={() => shareSocial('linkedin')}
          />
          <ActionRow
            icon={Facebook}
            label="Facebook"
            onClick={() => shareSocial('facebook')}
          />
        </PopoverContent>
      </Popover>

      {channelDialog && (
        <SharePropertyChannelDialog
          open={!!channelDialog}
          onOpenChange={(o) => !o && setChannelDialog(null)}
          propertyId={propertyId}
          propertyTitle={propertyTitle}
          channel={channelDialog}
        />
      )}

      <SharePropertyQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        url={publicUrl}
        title={propertyTitle}
      />
    </>
  )
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{label}</span>
    </button>
  )
}
