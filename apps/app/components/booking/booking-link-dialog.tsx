'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { CalendarClock, Copy, ExternalLink, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useUser } from '@/hooks/use-user'
import { PropertyAvailabilityPanel } from './property-availability-panel'

interface BookingLinkDialogProps {
  propertyId: string
  propertySlug: string | null
  consultantId: string | null
  trigger?: React.ReactNode
}

export function BookingLinkDialog({
  propertyId,
  propertySlug,
  consultantId,
  trigger,
}: BookingLinkDialogProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { user } = useUser()

  const publicUrl = useMemo(() => {
    if (!propertySlug) return ''
    if (typeof window === 'undefined') return `/visita/${propertySlug}`
    return `${window.location.origin}/visita/${propertySlug}`
  }, [propertySlug])

  const canEditAvailability = useMemo(() => {
    if (!user) return false
    // Own property consultant
    if (consultantId && user.id === consultantId) return true
    // Admin / broker / office manager can manage any property's availability
    const adminRoles = ['broker/ceo', 'admin', 'office manager']
    const roleName = (user.role?.name ?? '').toLowerCase()
    return adminRoles.includes(roleName)
  }, [user, consultantId])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success('Link copiado')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  if (!propertySlug) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            title="Link de agendamento público"
          >
            <CalendarClock className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Agendamento público
          </DialogTitle>
          <DialogDescription>
            Partilha este link com prospects para que agendem visitas a este imóvel directamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* URL section — link hidden, action buttons only */}
          <div className="rounded-xl border bg-muted/20 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold">Link público de agendamento</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Os prospects verão o imóvel e escolhem um horário disponível.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                className="h-8 gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir
              </Button>
              <Button
                size="sm"
                onClick={handleCopy}
                className="h-8 gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar link'}
              </Button>
            </div>
          </div>

          {/* Availability editor — only for property consultant or managers */}
          {canEditAvailability && (
            <PropertyAvailabilityPanel propertyId={propertyId} />
          )}

          {!canEditAvailability && (
            <div className="rounded-xl border border-dashed bg-muted/20 p-3 text-[11px] text-muted-foreground">
              A disponibilidade deste imóvel é gerida pelo consultor responsável.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
