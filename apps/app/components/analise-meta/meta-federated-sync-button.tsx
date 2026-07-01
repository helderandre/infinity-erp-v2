'use client'

/**
 * Sincronizar (federado) — dispara o replay do meta-api Mube para os últimos N
 * dias directamente da secção CRM → Análise → Meta. Substitui o antigo botão
 * "Sincronizar" (que corria o método directo/Graph, agora desligado).
 *
 * A gestão dispara sem API key (o endpoint aceita sessão + isManagementRole);
 * o card em Integrações → Meta continua a existir para o fluxo com API key.
 */

import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// since_days do endpoint vai até 90 (máx. do meta-api).
const WINDOW_PRESETS = [
  { value: '1', label: 'Último dia' },
  { value: '7', label: 'Última semana' },
  { value: '14', label: 'Últimas 2 semanas' },
  { value: '30', label: 'Último mês' },
  { value: '90', label: 'Últimos 3 meses' },
] as const

type SyncResponse = {
  job_id?: string
  since_days?: number
  connections?: number
  error?: string
  message?: string
  upstream_status?: number
  details?: { error?: string; message?: string }
}

export function MetaFederatedSyncButton() {
  const [days, setDays] = useState('30')
  const [pending, setPending] = useState(false)

  async function sync() {
    setPending(true)
    try {
      const res = await fetch('/api/integrations/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since_days: Number(days) }),
      })
      const body = (await res.json().catch(() => ({}))) as SyncResponse

      if (res.status === 202 && body.job_id) {
        const label = WINDOW_PRESETS.find((p) => p.value === days)?.label.toLowerCase() ?? `últimos ${days} dias`
        toast.success('Sincronização iniciada', {
          description: `A buscar a atividade (${label}). Os dados vão aparecer à medida que são processados — sem precisares de refrescar.`,
          duration: 8000,
        })
        return
      }

      // Ligação inactiva / sem conexão → accionável: reconectar.
      const upstreamCode = body.details?.error ?? body.error
      if (res.status === 409 || body.upstream_status === 409 || upstreamCode === 'no_active_connection') {
        toast.error('Ligação ao Meta inactiva', {
          description: 'Reconecta a conta em Integrações → Meta e tenta de novo.',
        })
        return
      }
      if (res.status === 401 || res.status === 403) {
        toast.error('Sem permissão para sincronizar.')
        return
      }

      toast.error('Não foi possível sincronizar', {
        description: body.details?.message ?? body.message ?? body.error ?? `HTTP ${res.status}`,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={days} onValueChange={setDays} disabled={pending}>
        <SelectTrigger className="h-9 w-[150px] rounded-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WINDOW_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={sync}
        disabled={pending}
        className={
          pending
            ? 'gap-2 rounded-full'
            : 'gap-2 rounded-full border-[#1877F2]/30 text-[#1877F2] hover:bg-[#1877F2]/5 hover:text-[#1877F2]'
        }
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        <span>{pending ? 'A sincronizar…' : 'Sincronizar'}</span>
      </Button>
    </div>
  )
}
