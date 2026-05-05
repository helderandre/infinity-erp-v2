'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { NegocioZonasField } from '@/components/negocios/zonas/negocio-zonas-field'
import type { NegocioZone } from '@/lib/matching'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import {
  NEGOCIO_BUSINESS_TYPES,
  NEGOCIO_PERSPECTIVAS_BY_BUSINESS_TYPE,
  type NegocioBusinessType,
} from '@/lib/constants'

const PROPERTY_TYPES = [
  'Apartamento', 'Moradia', 'Quinta', 'Prédio',
  'Comércio', 'Garagem', 'Terreno Urbano', 'Terreno Rústico',
] as const

interface NewNegocioSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
  /** Called with the created negócio id after a successful insert. */
  onCreated?: (negocioId: string) => void
}

/**
 * "Nova Oportunidade" sheet — auto-managed state. Aligns with the page-level
 * lead-form: tipo de imóvel, localização, quartos mín., orçamento mín./máx.
 * (or preço único para vendedores).
 */
export function NewNegocioSheet({
  open,
  onOpenChange,
  leadId,
  onCreated,
}: NewNegocioSheetProps) {
  const isMobile = useIsMobile()
  const [businessType, setBusinessType] = useState<NegocioBusinessType | ''>('')
  const [tipo, setTipo] = useState<string>('')
  const [tipoImovel, setTipoImovel] = useState<string>('')
  const [zonas, setZonas] = useState<NegocioZone[]>([])
  const [quartosMin, setQuartosMin] = useState<string>('')
  const [orcamento, setOrcamento] = useState<string>('')
  const [orcamentoMax, setOrcamentoMax] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setBusinessType('')
      setTipo('')
      setTipoImovel('')
      setZonas([])
      setQuartosMin('')
      setOrcamento('')
      setOrcamentoMax('')
      setSubmitting(false)
    }
  }, [open])

  // When business_type changes and the current tipo is no longer valid, reset it.
  useEffect(() => {
    if (!businessType) return
    const allowed = NEGOCIO_PERSPECTIVAS_BY_BUSINESS_TYPE[businessType]
    if (tipo && !allowed.includes(tipo)) setTipo('')
  }, [businessType, tipo])

  const perspectivaOptions = businessType
    ? NEGOCIO_PERSPECTIVAS_BY_BUSINESS_TYPE[businessType]
    : []

  const isBuyer = tipo === 'Comprador' || tipo === 'Arrendatário'
  const canSubmit = !!businessType && !!tipo && !submitting

  const handleSubmit = async () => {
    if (!canSubmit || !leadId) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        lead_id: leadId,
        business_type: businessType,
        tipo,
      }
      if (tipoImovel) body.tipo_imovel = tipoImovel
      if (zonas.length > 0) body.zonas = zonas
      if (quartosMin) {
        const n = parseInt(quartosMin)
        if (!Number.isNaN(n)) {
          if (isBuyer) body.quartos_min = n
          else body.quartos = n
        }
      }
      const orcNum = orcamento.trim() ? parseFloat(orcamento) : null
      const orcMaxNum = orcamentoMax.trim() ? parseFloat(orcamentoMax) : null
      if (orcNum && Number.isFinite(orcNum) && orcNum > 0) {
        if (tipo === 'Comprador') body.orcamento = orcNum
        else if (tipo === 'Arrendatário') body.renda_max_mensal = orcNum
        else if (tipo === 'Vendedor') body.preco_venda = orcNum
        else if (tipo === 'Senhorio') body.renda_pretendida = orcNum
      }
      if (isBuyer && orcMaxNum && Number.isFinite(orcMaxNum) && orcMaxNum > 0) {
        body.orcamento_max = orcMaxNum
      }

      const res = await fetch('/api/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success('Oportunidade criada com sucesso')
      onOpenChange(false)
      onCreated?.(data.id)
    } catch {
      toast.error('Erro ao criar oportunidade')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <SheetTitle className="flex items-center gap-2 text-base">
            <Briefcase className="h-5 w-5" />
            Nova Oportunidade
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Cria uma oportunidade ligada a este contacto. Podes editar mais detalhes depois.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
            {/* Step 1 — Business type */}
            <div className="space-y-2">
              <Label>Tipo de negócio *</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {NEGOCIO_BUSINESS_TYPES.map((bt) => {
                  const active = businessType === bt
                  return (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setBusinessType(active ? '' : bt)}
                      className={cn(
                        'inline-flex items-center justify-center h-9 rounded-full text-xs font-medium transition-all border',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                      )}
                    >
                      {bt}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2 — Perspectiva (only when business_type is set) */}
            {businessType && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <Label>Perspectiva *</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {perspectivaOptions.map((p) => {
                    const active = tipo === p
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTipo(active ? '' : p)}
                        className={cn(
                          'inline-flex items-center justify-center h-9 rounded-full text-xs font-medium transition-all border',
                          active
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                        )}
                      >
                        {p}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Detalhes do negócio (opcional) */}
            {tipo && (
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-3 animate-in fade-in slide-in-from-top-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Detalhes do negócio (opcional)
                </p>
                <div className="space-y-2">
                  <Label className="text-[11px] font-medium">Tipo de Imóvel</Label>
                  <Select
                    value={tipoImovel || '_any'}
                    onValueChange={(v) => setTipoImovel(v === '_any' ? '' : v)}
                  >
                    <SelectTrigger className="rounded-xl text-xs">
                      <SelectValue placeholder="Qualquer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_any">Qualquer</SelectItem>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <NegocioZonasField
                  value={zonas}
                  onChange={setZonas}
                />
                <div className={cn('grid gap-2', isBuyer ? 'grid-cols-3' : 'grid-cols-2')}>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium">{isBuyer ? 'Quartos mín.' : 'Quartos'}</Label>
                    <Input
                      type="number"
                      placeholder="2"
                      value={quartosMin}
                      onChange={(e) => setQuartosMin(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium">{isBuyer ? 'Orç. mín. €' : 'Preço €'}</Label>
                    <Input
                      type="number"
                      placeholder="200000"
                      value={orcamento}
                      onChange={(e) => setOrcamento(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>
                  {isBuyer && (
                    <div className="space-y-2">
                      <Label className="text-[11px] font-medium">Orç. máx. €</Label>
                      <Input
                        type="number"
                        placeholder="350000"
                        value={orcamentoMax}
                        onChange={(e) => setOrcamentoMax(e.target.value)}
                        className="rounded-xl text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-w-[120px]"
          >
            {submitting && <Spinner variant="infinite" size={16} className="mr-2" />}
            Criar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
