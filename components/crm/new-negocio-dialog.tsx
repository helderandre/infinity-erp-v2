// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Building2,
  Euro,
  Key,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShoppingCart,
  Store,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { LeadEntryDialog } from '@/components/leads/lead-entry-dialog'
import { NEGOCIO_TIPOS_PICKER } from '@/lib/constants'

interface NewNegocioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when a new negócio is created. Passes the negócio id. */
  onCreated?: (negocioId: string) => void
}

interface LeadOption {
  id: string
  nome: string | null
  full_name: string | null
  telemovel: string | null
  telefone: string | null
  email: string | null
}

const TIPO_ICONS: Record<string, React.ElementType> = {
  Compra: ShoppingCart,
  Venda: Store,
  Arrendatário: Key,
  Arrendador: Building2,
  Outro: Users,
}

type Tab = 'existente' | 'novo'

// Maps a tipo to the relevant value field(s) in the negocios schema.
// "range" tipos have a min + max field; "single" tipos have one mandatory value.
const VALUE_CONFIG: Record<string, {
  mode: 'range' | 'single'
  minField?: string
  maxField?: string
  singleField?: string
  minLabel?: string
  maxLabel?: string
  singleLabel?: string
  unit?: string
}> = {
  Compra: {
    mode: 'range',
    minField: 'orcamento',
    maxField: 'orcamento_max',
    minLabel: 'Orçamento mínimo',
    maxLabel: 'Orçamento máximo',
  },
  Outro: {
    mode: 'range',
    minField: 'orcamento',
    maxField: 'orcamento_max',
    minLabel: 'Valor mínimo',
    maxLabel: 'Valor máximo',
  },
  Venda: {
    mode: 'single',
    singleField: 'preco_venda',
    singleLabel: 'Preço pretendido',
  },
  Arrendatário: {
    mode: 'single',
    singleField: 'renda_max_mensal',
    singleLabel: 'Renda máxima mensal',
    unit: '/mês',
  },
  Arrendador: {
    mode: 'single',
    singleField: 'renda_pretendida',
    singleLabel: 'Renda pretendida',
    unit: '/mês',
  },
}

export function NewNegocioDialog({ open, onOpenChange, onCreated }: NewNegocioDialogProps) {
  const [tab, setTab] = useState<Tab>('existente')
  const [search, setSearch] = useState('')
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null)
  const [tipo, setTipo] = useState<string>('')
  const [valueMin, setValueMin] = useState('')
  const [valueMax, setValueMax] = useState('')
  const [valueSingle, setValueSingle] = useState('')
  const [localizacao, setLocalizacao] = useState('')
  const [creating, setCreating] = useState(false)
  const [showLeadEntry, setShowLeadEntry] = useState(false)

  const debouncedSearch = useDebounce(search, 250)

  // Reset state on open/close
  useEffect(() => {
    if (!open) {
      setTab('existente')
      setSearch('')
      setLeads([])
      setSelectedLead(null)
      setTipo('')
      setValueMin('')
      setValueMax('')
      setValueSingle('')
      setLocalizacao('')
      setCreating(false)
      return
    }
  }, [open])

  // Reset value fields when tipo changes (different schema fields)
  useEffect(() => {
    setValueMin('')
    setValueMax('')
    setValueSingle('')
  }, [tipo])

  // Search leads — fires on debounced search OR when the dialog first opens
  useEffect(() => {
    if (!open || tab !== 'existente') return
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ qualified_only: 'true', limit: '15' })
    if (debouncedSearch.trim()) params.set('nome', debouncedSearch.trim())
    fetch(`/api/leads?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const data = json?.data || (Array.isArray(json) ? json : [])
        setLeads(data)
      })
      .catch(() => {
        if (!cancelled) setLeads([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, tab, debouncedSearch])

  const config = tipo ? VALUE_CONFIG[tipo] : null

  // Validation gate (also drives the disabled state of the Create button)
  const validationError = useMemo<string | null>(() => {
    if (!selectedLead) return 'Selecciona um contacto'
    if (!tipo) return 'Selecciona o tipo de negócio'
    if (!localizacao.trim()) return 'Localização obrigatória'
    if (!config) return 'Tipo inválido'
    if (config.mode === 'range') {
      const min = Number(valueMin)
      const max = Number(valueMax)
      if (!valueMin.trim() || !Number.isFinite(min) || min <= 0) return 'Valor mínimo obrigatório'
      if (!valueMax.trim() || !Number.isFinite(max) || max <= 0) return 'Valor máximo obrigatório'
      if (max < min) return 'O máximo tem de ser ≥ ao mínimo'
    } else {
      const v = Number(valueSingle)
      if (!valueSingle.trim() || !Number.isFinite(v) || v <= 0) return 'Valor obrigatório'
    }
    return null
  }, [selectedLead, tipo, localizacao, valueMin, valueMax, valueSingle, config])

  const handleCreate = useCallback(async () => {
    if (validationError || !selectedLead || !tipo || !config) return
    setCreating(true)
    try {
      const body: Record<string, unknown> = {
        lead_id: selectedLead.id,
        tipo,
        localizacao: localizacao.trim(),
      }
      if (config.mode === 'range' && config.minField && config.maxField) {
        body[config.minField] = Number(valueMin)
        body[config.maxField] = Number(valueMax)
      } else if (config.mode === 'single' && config.singleField) {
        body[config.singleField] = Number(valueSingle)
      }

      const res = await fetch('/api/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Erro ao criar negócio')
      }
      const data = await res.json()
      toast.success('Negócio criado com sucesso')
      onOpenChange(false)
      onCreated?.(data.id)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar negócio')
    } finally {
      setCreating(false)
    }
  }, [validationError, selectedLead, tipo, config, localizacao, valueMin, valueMax, valueSingle, onOpenChange, onCreated])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl p-0 gap-0 overflow-hidden">
          <div className="bg-neutral-900 px-6 py-5">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2.5 text-white">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                  <Plus className="h-4 w-4" />
                </div>
                Novo Negócio
              </DialogTitle>
              <DialogDescription className="text-neutral-400 text-xs">
                Cria um negócio para um contacto existente ou começa do zero.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Tab pills */}
          <div className="px-6 pt-5">
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/60 border border-border/40 w-full">
              <TabButton active={tab === 'existente'} onClick={() => setTab('existente')} icon={Users}>
                Contacto existente
              </TabButton>
              <TabButton active={tab === 'novo'} onClick={() => setTab('novo')} icon={UserPlus}>
                Novo contacto
              </TabButton>
            </div>
          </div>

          {/* Body */}
          {tab === 'existente' ? (
            <div className="px-6 py-5 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Pesquisar por nome..."
                  className="pl-9 rounded-full h-9 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="max-h-[260px] overflow-y-auto rounded-xl border border-border/40 bg-muted/20">
                {loading ? (
                  <div className="space-y-1 p-2">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-lg" />
                    ))}
                  </div>
                ) : leads.length === 0 ? (
                  <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                    {debouncedSearch
                      ? 'Sem resultados.'
                      : 'Pesquise pelo nome para listar contactos.'}
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {leads.map((l) => {
                      const name = l.full_name || l.nome || 'Sem nome'
                      const phone = l.telemovel || l.telefone || null
                      const isSelected = selectedLead?.id === l.id
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setSelectedLead(l)}
                          className={cn(
                            'w-full text-left px-3 py-2.5 transition-colors',
                            isSelected
                              ? 'bg-primary/10 text-foreground'
                              : 'hover:bg-muted/40',
                          )}
                        >
                          <p className={cn('text-sm font-medium truncate', isSelected && 'text-primary')}>
                            {name}
                          </p>
                          {(phone || l.email) && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {[phone, l.email].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {selectedLead && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Tipo de negócio
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {NEGOCIO_TIPOS_PICKER.map((t) => {
                      const Icon = TIPO_ICONS[t] || Plus
                      const isActive = tipo === t
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTipo(t)}
                          className={cn(
                            'inline-flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition-colors',
                            isActive
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/40 hover:bg-muted/40',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Mandatory fields — appear once tipo is selected */}
              {selectedLead && tipo && config && (
                <div className="space-y-2.5 pt-1">
                  {config.mode === 'range' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          {config.minLabel} *
                        </Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="0"
                          value={valueMin}
                          onChange={(e) => setValueMin(e.target.value)}
                          className="rounded-full h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          {config.maxLabel} *
                        </Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="0"
                          value={valueMax}
                          onChange={(e) => setValueMax(e.target.value)}
                          className="rounded-full h-9 text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1">
                        <Euro className="h-3 w-3" />
                        {config.singleLabel}
                        {config.unit ? ` ${config.unit}` : ''} *
                      </Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="0"
                        value={valueSingle}
                        onChange={(e) => setValueSingle(e.target.value)}
                        className="rounded-full h-9 text-xs"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Localização *
                    </Label>
                    <Input
                      placeholder="Ex: Lisboa, Cascais, Oeiras"
                      value={localizacao}
                      onChange={(e) => setLocalizacao(e.target.value)}
                      className="rounded-full h-9 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground/80">
                      Separa várias zonas por vírgulas.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-8 flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Novo contacto + negócio</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cria um novo lead e qualifica-o num negócio em poucos passos.
                </p>
              </div>
              <Button
                size="sm"
                className="rounded-full mt-1 gap-1.5"
                onClick={() => {
                  onOpenChange(false)
                  setShowLeadEntry(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Criar novo contacto
              </Button>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            {tab === 'existente' && (
              <Button
                size="sm"
                className="rounded-full px-5"
                disabled={!!validationError || creating}
                onClick={handleCreate}
                title={validationError || undefined}
              >
                {creating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Criar negócio
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadEntryDialog
        open={showLeadEntry}
        onOpenChange={setShowLeadEntry}
        onComplete={() => {
          setShowLeadEntry(false)
          onCreated?.('')
        }}
        realEstateOnly
      />
    </>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 flex-1 h-8 rounded-full text-xs font-medium transition-colors duration-200',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'bg-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}

