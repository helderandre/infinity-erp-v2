'use client'

import { useState } from 'react'
import { History, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PRESETS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '14', label: 'Últimos 14 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
  { value: '90', label: 'Últimos 90 dias' },
] as const

type SyncResponse = {
  job_id?: string
  tenant_id?: string
  since_days?: number
  connections?: number
  status?: string
  queued_at?: string
  error?: string
  message?: string
  upstream_status?: number
  details?: { error?: string; message?: string }
}

function pluralConn(n: number): string {
  return n === 1 ? '1 conexão' : `${n} conexões`
}

export function MetaSyncCard({ enabled }: { enabled: boolean }) {
  const [days, setDays] = useState('30')
  const [isPending, setIsPending] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)

  function openDialog() {
    setApiKey('')
    setKeyError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!apiKey.trim()) {
      setKeyError('Introduz a API key.')
      return
    }

    setKeyError(null)
    setIsPending(true)
    try {
      const res = await fetch('/api/integrations/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since_days: Number(days), api_key: apiKey }),
      })
      const body = (await res.json().catch(() => ({}))) as SyncResponse

      if (res.status === 401) {
        setKeyError('API key inválida. Tenta novamente.')
        return
      }

      if (res.status === 202 && body.job_id) {
        setDialogOpen(false)
        setApiKey('')
        toast.success('Solicitação enviada', {
          description: [
            `Pedido para sincronizar os últimos ${body.since_days} dias enfileirado em ${pluralConn(body.connections ?? 1)}.`,
            'Serás notificado à medida que os dados chegam (sem necessidade de refresh).',
          ].join(' '),
          duration: 9000,
        })
        return
      }

      const upstreamDetail =
        body.details?.message ?? body.details?.error ?? body.message ?? body.error
      toast.error('Não foi possível agendar a sincronização', {
        description: upstreamDetail ?? `HTTP ${res.status}`,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" />
            Sincronizar histórico
          </CardTitle>
          <CardDescription>
            Vai buscar formulários, campanhas, anúncios e leads dos últimos N
            dias (máx. 90). Os dados vão aparecendo em <em>Análise Meta</em> à
            medida que são processados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select
            value={days}
            onValueChange={setDays}
            disabled={!enabled || isPending}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openDialog} disabled={!enabled || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? 'A enviar pedido…' : 'Sincronizar'}
          </Button>
          {!enabled && (
            <span className="text-muted-foreground text-xs">
              Liga primeiro a conta Facebook para sincronizar.
            </span>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !isPending && setDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Confirmar com API key
              </DialogTitle>
              <DialogDescription>
                Esta operação requer a API key da integração. Pede-a a um
                administrador da Mube Systems se ainda não a tens.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="meta-sync-api-key">API key</Label>
              <Input
                id="meta-sync-api-key"
                type="password"
                autoComplete="off"
                autoFocus
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  if (keyError) setKeyError(null)
                }}
                disabled={isPending}
                aria-invalid={!!keyError}
              />
              {keyError && (
                <p className="text-destructive text-xs">{keyError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !apiKey.trim()}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? 'A enviar…' : 'Confirmar e sincronizar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
