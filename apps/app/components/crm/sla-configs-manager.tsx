'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock, Plus, MoreHorizontal, Pencil, Trash2, Loader2,
  Timer, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogFooter, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { LeadsSlaConfig } from '@/types/leads-crm'

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', website: 'Website',
  landing_page: 'Landing Page', partner: 'Parceiro', organic: 'Orgânico',
  walk_in: 'Walk-in', phone_call: 'Chamada', social_media: 'Redes Sociais',
}

const SECTOR_LABELS: Record<string, string> = {
  real_estate_buy: 'Compra', real_estate_sell: 'Venda', real_estate_rent: 'Arrendamento',
  recruitment: 'Recrutamento', credit: 'Crédito',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa',
}

function formatSla(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function SlaConfigsManager() {
  const [configs, setConfigs] = useState<LeadsSlaConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LeadsSlaConfig | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/crm/sla-configs')
      if (res.ok) {
        const data = await res.json()
        setConfigs(Array.isArray(data) ? data : [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza de que pretende eliminar esta configuração?')) return
    const res = await fetch(`/api/crm/sla-configs/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Configuração eliminada'); fetchData() }
    else toast.error('Erro ao eliminar')
  }

  const handleToggle = async (config: LeadsSlaConfig) => {
    const res = await fetch(`/api/crm/sla-configs/${config.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !config.is_active }),
    })
    if (res.ok) fetchData()
  }

  const sorted = [...configs].sort((a, b) => b.priority - a.priority)

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Configuração de SLA</span>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditing(null); setDialogOpen(true) }}
          className="rounded-full"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Novo SLA
        </Button>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Como funciona</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-muted-foreground">
          <div className="flex gap-2">
            <span className="shrink-0 h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-bold">!</span>
            <p>No <strong>aviso</strong> (ex: 50%), o consultor recebe uma notificação para contactar a lead.</p>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 h-5 w-5 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center text-[10px] font-bold">!!</span>
            <p>Na <strong>violação</strong> (ex: 100%), a gestora é notificada e o consultor recebe alerta urgente.</p>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 h-5 w-5 rounded-full bg-red-200 dark:bg-red-900 text-red-700 dark:text-red-300 flex items-center justify-center text-[10px] font-bold">↑</span>
            <p>Na <strong>escalonação</strong> (ex: 150%), a lead pode ser reatribuída automaticamente.</p>
          </div>
        </div>
      </div>

      {/* Configs List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium">Sem configurações de SLA</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Crie uma configuração para definir prazos de resposta.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((config, idx) => (
            <div
              key={config.id}
              className={cn(
                "group rounded-2xl border bg-card/50 backdrop-blur-sm p-5 transition-all hover:shadow-sm animate-in fade-in slide-in-from-bottom-2",
                !config.is_active && "opacity-50",
              )}
              style={{ animationDelay: `${idx * 20}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-xs font-bold text-amber-600 dark:text-amber-400">
                  {config.priority}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{config.name}</p>
                    <Badge variant="outline" className="text-[9px] rounded-full px-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                      {formatSla(config.sla_minutes)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {config.source_match?.map(s => (
                      <span key={s} className="inline-flex items-center text-[9px] font-medium bg-muted/60 dark:bg-muted/30 px-2 py-0.5 rounded-full">
                        {SOURCE_LABELS[s] ?? s}
                      </span>
                    ))}
                    {config.sector_match?.map(s => (
                      <span key={s} className="inline-flex items-center text-[9px] font-medium bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                        {SECTOR_LABELS[s] ?? s}
                      </span>
                    ))}
                    {config.priority_match?.map(p => (
                      <span key={p} className="inline-flex items-center text-[9px] font-medium bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        {PRIORITY_LABELS[p] ?? p}
                      </span>
                    ))}
                    {(!config.source_match?.length && !config.sector_match?.length && !config.priority_match?.length) && (
                      <span className="text-[10px] text-muted-foreground italic">Todas as leads (default)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Aviso: {config.warning_pct}%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      Violação: {config.critical_pct}%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                      Escalonação: {config.escalate_pct}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={config.is_active} onCheckedChange={() => handleToggle(config)} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded-full hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(config); setDialogOpen(true) }}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(config.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SlaDialog open={dialogOpen} onOpenChange={setDialogOpen} config={editing} onSaved={fetchData} />
    </div>
  )
}

function SlaDialog({ open, onOpenChange, config, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; config: LeadsSlaConfig | null; onSaved: () => void
}) {
  const isEdit = !!config
  const [form, setForm] = useState({
    name: '', sla_minutes: '1440', priority: '0',
    warning_pct: '50', critical_pct: '100', escalate_pct: '150',
    source_match: [] as string[], sector_match: [] as string[], priority_match: [] as string[],
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (config) {
      setForm({
        name: config.name, sla_minutes: String(config.sla_minutes), priority: String(config.priority),
        warning_pct: String(config.warning_pct), critical_pct: String(config.critical_pct),
        escalate_pct: String(config.escalate_pct),
        source_match: config.source_match ?? [], sector_match: config.sector_match ?? [],
        priority_match: config.priority_match ?? [],
      })
    } else {
      setForm({
        name: '', sla_minutes: '1440', priority: '0',
        warning_pct: '50', critical_pct: '100', escalate_pct: '150',
        source_match: [], sector_match: [], priority_match: [],
      })
    }
  }, [config, open])

  const toggle = (field: 'source_match' | 'sector_match' | 'priority_match', value: string) => {
    setForm(p => ({
      ...p,
      [field]: p[field].includes(value) ? p[field].filter(v => v !== value) : [...p[field], value],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        sla_minutes: parseInt(form.sla_minutes) || 1440,
        priority: parseInt(form.priority) || 0,
        warning_pct: parseInt(form.warning_pct) || 50,
        critical_pct: parseInt(form.critical_pct) || 100,
        escalate_pct: parseInt(form.escalate_pct) || 150,
        source_match: form.source_match.length ? form.source_match : null,
        sector_match: form.sector_match.length ? form.sector_match : null,
        priority_match: form.priority_match.length ? form.priority_match : null,
        is_active: true,
      }
      const url = isEdit ? `/api/crm/sla-configs/${config!.id}` : '/api/crm/sla-configs'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'SLA actualizado' : 'SLA criado')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 dark:bg-neutral-800 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Timer className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-white text-lg">
              {isEdit ? 'Editar SLA' : 'Nova Configuração de SLA'}
            </DialogTitle>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-2">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" placeholder="Ex: Meta Ads — Normal" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Prioridade</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="rounded-xl" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-medium">Prazo SLA (minutos)</Label>
            <div className="flex items-center gap-3">
              <Input type="number" value={form.sla_minutes} onChange={e => setForm(p => ({ ...p, sla_minutes: e.target.value }))} className="rounded-xl" />
              <span className="text-xs text-muted-foreground shrink-0">
                = {formatSla(parseInt(form.sla_minutes) || 0)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Aviso (%)</Label>
              <Input type="number" value={form.warning_pct} onChange={e => setForm(p => ({ ...p, warning_pct: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Violação (%)</Label>
              <Input type="number" value={form.critical_pct} onChange={e => setForm(p => ({ ...p, critical_pct: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Escalonação (%)</Label>
              <Input type="number" value={form.escalate_pct} onChange={e => setForm(p => ({ ...p, escalate_pct: e.target.value }))} className="rounded-xl" />
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aplica-se a</span>

            <div className="grid gap-2">
              <Label className="text-xs font-medium">Origens</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(SOURCE_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => toggle('source_match', val)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors',
                      form.source_match.includes(val)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-medium">Prioridades</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => toggle('priority_match', val)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors',
                      form.priority_match.includes(val)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-full w-full sm:w-auto" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Guardar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
