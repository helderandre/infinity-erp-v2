'use client'

import { useEffect, useState } from 'react'
import { DealMarketingMomentCard } from '@/components/processes/deal-marketing-moment-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Camera, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type MomentType = 'cpcv' | 'escritura' | 'contrato_arrendamento' | 'entrega_chaves'

const MOMENT_LABELS: Record<MomentType, string> = {
  cpcv: 'CPCV',
  escritura: 'Escritura',
  contrato_arrendamento: 'Contrato de Arrendamento',
  entrega_chaves: 'Entrega de Chaves',
}

interface MarketingMoment {
  id: string
  moment_type: MomentType
  photo_urls: string[]
  manual_caption: string | null
  ai_description: string | null
  ai_description_model: string | null
  ai_description_generated_at: string | null
  published_to_instagram: boolean
  published_to_linkedin: boolean
  created_at: string
}

interface MomentosTabProps {
  dealId: string | null
}

export function MomentosTab({ dealId }: MomentosTabProps) {
  const [moments, setMoments] = useState<MarketingMoment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newMomentType, setNewMomentType] = useState<MomentType>('escritura')

  const refetch = async () => {
    if (!dealId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/marketing-moments`)
      if (res.ok) {
        const { data } = await res.json()
        setMoments(data ?? [])
      }
    } catch {
      toast.error('Erro a carregar momentos')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId])

  if (!dealId) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center space-y-3 animate-in fade-in duration-200">
        <Camera className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <div>
          <p className="text-sm font-medium">Sem deal associado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Os momentos de marketing são capturados após criar um deal de fecho. Quando submeteres
            o negócio para fecho, esta tab fica disponível.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        A carregar momentos…
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-pink-600" />
          <h3 className="text-sm font-semibold">Momentos de marketing</h3>
          {moments.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {moments.length}
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Adicionar momento
        </Button>
      </div>

      {moments.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center space-y-2">
          <Camera className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Ainda não há momentos. Captura fotos de assinaturas (CPCV, escritura, entrega de chaves) e
            usa IA para gerar legendas para Instagram/LinkedIn.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {moments.map((m) => (
            <DealMarketingMomentCard
              key={m.id}
              dealId={dealId}
              momentType={m.moment_type}
              existingMoment={m}
              onSaved={(saved) => {
                setMoments((prev) => prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)))
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo momento de marketing</DialogTitle>
            <DialogDescription>
              Escolhe o tipo de momento e carrega as fotos para gerar legenda com IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Tipo de momento</label>
              <Select value={newMomentType} onValueChange={(v) => setNewMomentType(v as MomentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MOMENT_LABELS) as MomentType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {MOMENT_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DealMarketingMomentCard
              dealId={dealId}
              momentType={newMomentType}
              onSaved={() => {
                setAddOpen(false)
                refetch()
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
