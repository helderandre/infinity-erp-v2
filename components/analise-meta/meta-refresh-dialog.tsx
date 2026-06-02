'use client'

import { useState } from 'react'
import { RefreshCw, Megaphone, CalendarIcon } from 'lucide-react'
import { format, parse, differenceInCalendarDays, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useMetaSyncJob, type SyncResource } from '@/hooks/use-meta-sync-job'

const RESOURCES: { key: SyncResource; label: string; hint: string }[] = [
  { key: 'campaigns', label: 'Campanhas', hint: 'Nome, estado, objectivo, orçamento' },
  { key: 'ads', label: 'Anúncios', hint: 'Estado e ligação ao criativo' },
  { key: 'creatives', label: 'Criativos', hint: 'Imagem/vídeo, copy, CTA, link' },
  { key: 'insights', label: 'Desempenho', hint: 'Gasto, impressões, cliques, CPL' },
  { key: 'forms', label: 'Formulários', hint: 'Formulários de lead das Pages' },
  { key: 'leads', label: 'Leads', hint: 'Leads recebidas (a partir da data)' },
]

const DEFAULT_SELECTED: SyncResource[] = ['campaigns', 'ads', 'insights']

type PeriodMode = 'today' | 'all' | '7' | '30' | '90' | 'custom'

const PERIOD_CHIPS: { mode: PeriodMode; label: string }[] = [
  { mode: 'today', label: 'Hoje' },
  { mode: '7', label: '7 dias' },
  { mode: '30', label: '30 dias' },
  { mode: '90', label: '90 dias' },
  { mode: 'all', label: 'Todo o período' },
  { mode: 'custom', label: 'Outra data' },
]

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/**
 * Diálogo geral "Atualizar dados Meta": escolhe QUE recursos sincronizar e o
 * PERÍODO — atalhos (todo o período / 7 / 30 / 90 dias) ou uma data específica
 * via calendário. Mostra quantos dias o período representa. Dispara um sync job
 * assíncrono (ver useMetaSyncJob).
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
  const [mode, setMode] = useState<PeriodMode>('today')
  const [customSince, setCustomSince] = useState<string>(() => ymd(subDays(new Date(), 30)))
  const [calOpen, setCalOpen] = useState(false)

  const customDate = customSince
    ? parse(customSince, 'yyyy-MM-dd', new Date())
    : undefined

  // Data efectiva enviada à API (null = todo o período).
  function effectiveSince(): string | null {
    if (mode === 'all') return null
    if (mode === 'today') return ymd(new Date())
    if (mode === 'custom') return customSince || null
    return ymd(subDays(new Date(), Number(mode)))
  }

  // Label "X dias" para o período activo.
  function daysLabel(): string | null {
    if (mode === 'all') return null
    if (mode === 'today') return 'hoje'
    if (mode === 'custom') {
      if (!customDate) return null
      const d = Math.max(0, differenceInCalendarDays(new Date(), customDate))
      return d === 0 ? 'hoje' : `há ${d} dia${d === 1 ? '' : 's'}`
    }
    return `últimos ${mode} dias`
  }

  function toggle(key: SyncResource, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function submit() {
    trigger([...selected], effectiveSince())
    setOpen(false)
  }

  const label = daysLabel()
  const canSubmit =
    !running && selected.size > 0 && (mode !== 'custom' || !!customSince)

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

          {/* Período: atalhos + data específica */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Período</Label>
              {label && (
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {label}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_CHIPS.map((chip) => (
                <Button
                  key={chip.mode}
                  type="button"
                  size="sm"
                  variant={mode === chip.mode ? 'default' : 'outline'}
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => setMode(chip.mode)}
                >
                  {chip.label}
                </Button>
              ))}
            </div>

            {mode === 'custom' && (
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'mt-1 justify-start text-left font-normal',
                      !customDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate
                      ? format(customDate, 'dd/MM/yyyy', { locale: pt })
                      : 'Escolher data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={(d) => {
                      if (d) setCustomSince(ymd(d))
                      setCalOpen(false)
                    }}
                    disabled={{ after: new Date() }}
                    locale={pt}
                    captionLayout="dropdown"
                    defaultMonth={customDate}
                    fromYear={2015}
                    toYear={new Date().getFullYear()}
                  />
                </PopoverContent>
              </Popover>
            )}

            <p className="text-muted-foreground text-[11px]">
              {mode === 'all'
                ? 'Sincroniza todo o histórico disponível.'
                : 'Leads/desempenho a partir da data; campanhas/anúncios/criativos alterados desde então.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            Sincronizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
