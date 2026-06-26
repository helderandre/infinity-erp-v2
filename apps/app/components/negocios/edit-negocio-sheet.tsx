'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { LEAD_TEMPERATURAS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Consultant {
  id: string
  commercial_name: string
}

export interface EditNegocioInitialValues {
  assigned_consultant_id: string | null
  expected_value: number | null
  expected_close_date: string | null
  temperatura: 'Frio' | 'Morno' | 'Quente' | null
  observacoes: string | null
}

interface EditNegocioSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  negocioId: string
  initial: EditNegocioInitialValues
  onSaved: () => void
  /** Quando a oportunidade tem fecho, permite editar valor + comissão aqui. */
  dealId?: string | null
  dealInitial?: { deal_value: number | null; commission_pct: number | null }
}

/**
 * Sheet minimalista para editar campos chave de um négocio a partir da página
 * de detalhe. Foco no fluxo "broker reatribui négocio criado em nome doutro
 * consultor" — o picker de consultor só aparece a roles de gestão. Reutiliza
 * `PUT /api/negocios/[id]`, que valida e descarta `assigned_consultant_id`
 * para callers não-management.
 */
export function EditNegocioSheet({
  open,
  onOpenChange,
  negocioId,
  initial,
  onSaved,
  dealId,
  dealInitial,
}: EditNegocioSheetProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const canManage = isManagementRole(user?.role_names ?? [])

  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [assignedConsultantId, setAssignedConsultantId] = useState<string | null>(
    initial.assigned_consultant_id,
  )
  const [expectedValue, setExpectedValue] = useState<string>(
    initial.expected_value != null ? String(initial.expected_value) : '',
  )
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>(
    initial.expected_close_date ?? '',
  )
  const [temperatura, setTemperatura] = useState<string>(initial.temperatura ?? '_none')
  const [observacoes, setObservacoes] = useState<string>(initial.observacoes ?? '')
  const [dealValue, setDealValue] = useState<string>(
    dealInitial?.deal_value != null ? String(dealInitial.deal_value) : '',
  )
  const [commissionPct, setCommissionPct] = useState<string>(
    dealInitial?.commission_pct != null ? String(dealInitial.commission_pct) : '',
  )
  const [isSaving, setIsSaving] = useState(false)

  // Reset quando o sheet abre com um négocio diferente — evita arrastar
  // estado entre abrir/fechar consecutivos.
  useEffect(() => {
    if (!open) return
    setAssignedConsultantId(initial.assigned_consultant_id)
    setExpectedValue(initial.expected_value != null ? String(initial.expected_value) : '')
    setExpectedCloseDate(initial.expected_close_date ?? '')
    setTemperatura(initial.temperatura ?? '_none')
    setObservacoes(initial.observacoes ?? '')
  }, [open, initial])

  // Reset dos campos do fecho — keyed nos primitivos para evitar churn do objecto.
  useEffect(() => {
    if (!open) return
    setDealValue(dealInitial?.deal_value != null ? String(dealInitial.deal_value) : '')
    setCommissionPct(dealInitial?.commission_pct != null ? String(dealInitial.commission_pct) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealInitial?.deal_value, dealInitial?.commission_pct])

  // Lista de consultores apenas relevante para gestão (só eles podem
  // reatribuir). Lazy fetch quando o sheet abre.
  useEffect(() => {
    if (!open || !canManage || consultants.length > 0) return
    fetch('/api/users/consultants')
      .then((res) => res.json())
      .then((payload) => {
        const list = Array.isArray(payload) ? payload : payload.data ?? []
        setConsultants(list)
      })
      .catch(() => {})
  }, [open, canManage, consultants.length])

  async function handleSave() {
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {}

      if (canManage && assignedConsultantId !== initial.assigned_consultant_id) {
        body.assigned_consultant_id = assignedConsultantId
      }

      const parsedValue = expectedValue.trim() === '' ? null : Number(expectedValue)
      if (parsedValue !== initial.expected_value) {
        if (parsedValue != null && Number.isNaN(parsedValue)) {
          toast.error('Valor esperado inválido')
          setIsSaving(false)
          return
        }
        body.expected_value = parsedValue
      }

      const nextDate = expectedCloseDate.trim() === '' ? null : expectedCloseDate
      if (nextDate !== initial.expected_close_date) {
        body.expected_close_date = nextDate
      }

      const nextTemp = temperatura === '_none' ? null : temperatura
      if (nextTemp !== initial.temperatura) {
        body.temperatura = nextTemp
      }

      const nextObs = observacoes.trim() === '' ? null : observacoes
      if (nextObs !== initial.observacoes) {
        body.observacoes = nextObs
      }

      // ── Fecho (deals) — valor + comissão. Disparam o recálculo do mapa. ──
      const dealBody: Record<string, unknown> = {}
      if (dealId) {
        const nextDealValue = dealValue.trim() === '' ? null : Number(dealValue)
        if (nextDealValue != null && Number.isNaN(nextDealValue)) {
          toast.error('Valor do negócio inválido'); setIsSaving(false); return
        }
        if (nextDealValue != null && nextDealValue !== (dealInitial?.deal_value ?? null)) {
          dealBody.deal_value = nextDealValue
        }
        const nextPct = commissionPct.trim() === '' ? null : Number(commissionPct)
        if (nextPct != null && Number.isNaN(nextPct)) {
          toast.error('% de comissão inválida'); setIsSaving(false); return
        }
        if (nextPct != null && nextPct !== (dealInitial?.commission_pct ?? null)) {
          dealBody.commission_pct = nextPct
        }
      }

      if (Object.keys(body).length === 0 && Object.keys(dealBody).length === 0) {
        toast.info('Nada para guardar')
        setIsSaving(false)
        return
      }

      if (Object.keys(body).length > 0) {
        const res = await fetch(`/api/negocios/${negocioId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || 'Erro ao guardar oportunidade')
        }
      }

      if (dealId && Object.keys(dealBody).length > 0) {
        const res = await fetch(`/api/deals/${dealId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dealBody),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || 'Erro ao guardar fecho')
        }
      }

      toast.success('Guardado')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Editar oportunidade</SheetTitle>
          <SheetDescription>Editar campos chave do négocio.</SheetDescription>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <div className="shrink-0 px-6 pt-7 pb-4 sm:px-8 sm:pt-8 border-b border-border/40">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
            Editar
          </p>
          <h2 className="mt-0.5 text-[18px] sm:text-[20px] font-semibold leading-tight">
            Oportunidade
          </h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-6 space-y-5">
          {canManage && (
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                Consultor responsável
              </Label>
              <Select
                value={assignedConsultantId ?? '_none'}
                onValueChange={(v) => setAssignedConsultantId(v === '_none' ? null : v)}
                disabled={isSaving}
              >
                <SelectTrigger className="rounded-full h-10 bg-background/60">
                  <SelectValue placeholder="Sem consultor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem consultor</SelectItem>
                  {consultants.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.commercial_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                A gestão pode reatribuir o consultor responsável (útil quando o broker cria
                o négocio em nome de outro colega).
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="expected_value" className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                Valor esperado (€)
              </Label>
              <Input
                id="expected_value"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={expectedValue}
                onChange={(e) => setExpectedValue(e.target.value)}
                placeholder="0,00"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_close_date" className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                Data prevista
              </Label>
              <Input
                id="expected_close_date"
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
              Temperatura
            </Label>
            <Select
              value={temperatura}
              onValueChange={setTemperatura}
              disabled={isSaving}
            >
              <SelectTrigger className="rounded-full h-10 bg-background/60">
                <SelectValue placeholder="Sem temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sem temperatura</SelectItem>
                {LEAD_TEMPERATURAS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes" className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
              Observações
            </Label>
            <Textarea
              id="observacoes"
              rows={4}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas internas sobre o négocio..."
              disabled={isSaving}
            />
          </div>

          {dealId && (
            <div className="space-y-3 rounded-2xl ring-1 ring-border/40 bg-background/40 p-4">
              <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                Fecho (financeiro)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="deal_value" className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                    Valor do negócio (€)
                  </Label>
                  <Input
                    id="deal_value"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="0,00"
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_pct" className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                    Comissão (%)
                  </Label>
                  <Input
                    id="commission_pct"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={commissionPct}
                    onChange={(e) => setCommissionPct(e.target.value)}
                    placeholder="5"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Alterar o valor ou a comissão recalcula automaticamente o mapa de gestão, preservando os ajustes manuais e o que já foi faturado ou recebido.
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/40 bg-background/60 px-6 sm:px-8 py-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full h-9"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-full h-9"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                A guardar
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
