'use client'

import { useState } from 'react'
import { RefreshCw, Megaphone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMetaSyncJob, type SyncResource } from '@/hooks/use-meta-sync-job'

const RESOURCES: { key: SyncResource; label: string; hint: string }[] = [
  { key: 'campaigns', label: 'Campanhas', hint: 'Nome, estado, objectivo, orçamento' },
  { key: 'ads', label: 'Anúncios', hint: 'Estado e ligação ao criativo' },
  { key: 'creatives', label: 'Criativos', hint: 'Imagem/vídeo, copy, CTA, link' },
  { key: 'insights', label: 'Desempenho', hint: 'Gasto, impressões, cliques, CPL' },
  { key: 'forms', label: 'Formulários', hint: 'Formulários de lead das Pages' },
  { key: 'leads', label: 'Leads', hint: 'Leads recebidas (janela do período)' },
]

const PERIODS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '365', label: 'Último ano' },
]

const DEFAULT_SELECTED: SyncResource[] = ['campaigns', 'ads', 'insights']

/**
 * Diálogo geral "Atualizar dados Meta": o utilizador escolhe QUE recursos
 * sincronizar (campanhas, anúncios, criativos, formulários, leads, desempenho)
 * e o PERÍODO (since_days). Dispara um sync job assíncrono — ver useMetaSyncJob.
 */
export function MetaRefreshDialog({
  defaultResources = DEFAULT_SELECTED,
}: {
  defaultResources?: SyncResource[]
}) {
  const { trigger, running } = useMetaSyncJob()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<SyncResource>>(
    () => new Set(defaultResources),
  )
  const [sinceDays, setSinceDays] = useState('30')

  function toggle(key: SyncResource, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function submit() {
    trigger([...selected], Number(sinceDays))
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={running}>
          {running ? (
            <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Megaphone className="mr-1.5 h-4 w-4" />
          )}
          Atualizar dados Meta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar dados Meta</DialogTitle>
          <DialogDescription>
            Escolhe o que sincronizar e o período. Corre em segundo plano —
            avisamos quando terminar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2.5">
            {RESOURCES.map((r) => (
              <label
                key={r.key}
                htmlFor={`sync-${r.key}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/40"
              >
                <Checkbox
                  id={`sync-${r.key}`}
                  checked={selected.has(r.key)}
                  onCheckedChange={(c) => toggle(r.key, c === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none">{r.label}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{r.hint}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sync-period" className="text-xs">
              Período
            </Label>
            <Select value={sinceDays} onValueChange={setSinceDays}>
              <SelectTrigger id="sync-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-[11px]">
              Aplica-se a leads e desempenho. Campanhas/anúncios/criativos
              alterados no período também são sincronizados.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={running || selected.size === 0}>
            Sincronizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
