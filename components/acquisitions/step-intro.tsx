'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  Clock,
  FileEdit,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User as UserIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { NegocioPickerItem } from '@/components/negocios/negocio-picker-dialog'
import type { AcquisitionDraft } from './drafts-list'

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

interface StepIntroProps {
  /** Há uma oportunidade já ligada (vinda da query string). */
  hasLinkedNegocio?: boolean
  /** Escolha persistida — se for 'opportunity' mostramos o picker inline,
   *  se for 'fresh' mostramos a confirmação "Começar do zero", se for 'draft'
   *  mostramos a lista de rascunhos guardados, se for null mostramos os
   *  cards de escolha. */
  originChoice: 'opportunity' | 'fresh' | 'draft' | null
  /** Nome do negócio escolhido (para mostrar como confirmação após pick). */
  pickedNegocioName?: string | null
  /** Picou "Começar do zero". */
  onChooseFresh: () => void
  /** Picou "De uma oportunidade" — abre o picker inline. */
  onChooseOpportunity: () => void
  /** Picou "Retomar rascunho" — abre a lista de rascunhos inline. Só é
   *  exposto/clicável quando `drafts.length > 0`. */
  onChooseDrafts: () => void
  /** Voltar a mostrar os cards de escolha. */
  onResetChoice: () => void
  /** Aplicar uma oportunidade escolhida no picker. */
  onPickNegocio: (negocio: NegocioPickerItem) => void
  /** Retomar um rascunho específico — o parent (form) bubble-up ao dialog
   *  via `onResumeDraft`, que faz remount da form com o `draftId`. */
  onResumeDraft: (draftId: string) => void
  /** Lista de rascunhos guardados pelo consultor (para o card opcional). */
  drafts: AcquisitionDraft[]
  /** Atualiza a lista de rascunhos depois de eliminar — owner é o parent. */
  onDraftDeleted: (draftId: string) => void
  /** Avançar para o passo seguinte (Dados do Imóvel). */
  onContinue: () => void
}

/**
 * Passo introdutório do formulário de Nova Angariação.
 *
 * Mostra:
 *   1. Mensagem de boas-vindas
 *   2. Decisão de origem — vem de uma oportunidade ou é nova?
 *      - Origem 'opportunity': renderiza o picker inline (lista de
 *        oportunidades com pesquisa). Sem popup.
 *      - Origem 'fresh': mostra confirmação curta com possibilidade de
 *        voltar a escolher.
 *      - null: mostra os dois cards de escolha.
 *
 * O choice é persistido no parent (AcquisitionFormV2) para que voltar ao
 * passo mantenha a mesma vista.
 */
export function StepIntro({
  hasLinkedNegocio,
  originChoice,
  pickedNegocioName,
  onChooseFresh,
  onChooseOpportunity,
  onChooseDrafts,
  onResetChoice,
  onPickNegocio,
  onResumeDraft,
  drafts,
  onDraftDeleted,
  onContinue,
}: StepIntroProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3 sm:gap-5 pt-1 sm:pt-4 pb-2">
      {/* Hero badge — mais pequeno em mobile para o passo caber no viewport. */}
      <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 ring-1 ring-violet-300/30 dark:ring-violet-700/30 flex items-center justify-center">
        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600 dark:text-violet-300" />
      </div>

      {/* Welcome */}
      <div className="space-y-1.5 sm:space-y-2 max-w-md">
        <h2 className="text-xl sm:text-3xl font-semibold tracking-tight">
          Vamos começar
        </h2>
        <p className="text-[13px] sm:text-sm text-muted-foreground leading-snug sm:leading-relaxed">
          Preenche com cuidado para iniciarmos o processo.
          <br className="hidden sm:inline" />
          <span className="text-muted-foreground/80"> Nem todos os campos são obrigatórios — quanto mais preencheres, melhor.</span>
        </p>
      </div>

      {/* Origem — quatro variantes consoante o estado actual. */}
      {hasLinkedNegocio || originChoice === 'opportunity' ? (
        <OpportunitySection
          hasLinkedNegocio={!!hasLinkedNegocio}
          pickedNegocioName={pickedNegocioName}
          onResetChoice={onResetChoice}
          onPickNegocio={onPickNegocio}
        />
      ) : originChoice === 'fresh' ? (
        <FreshConfirmation
          onResetChoice={onResetChoice}
          onContinue={onContinue}
        />
      ) : originChoice === 'draft' ? (
        <DraftsSection
          drafts={drafts}
          onResetChoice={onResetChoice}
          onResumeDraft={onResumeDraft}
          onDraftDeleted={onDraftDeleted}
        />
      ) : (
        <ChoiceGrid
          onChooseFresh={onChooseFresh}
          onChooseOpportunity={onChooseOpportunity}
          onChooseDrafts={onChooseDrafts}
          draftCount={drafts.length}
        />
      )}
    </div>
  )
}

/* ─── Choice grid ──────────────────────────────────────────────────────── */
function ChoiceGrid({
  onChooseFresh,
  onChooseOpportunity,
  onChooseDrafts,
  draftCount,
}: {
  onChooseFresh: () => void
  onChooseOpportunity: () => void
  onChooseDrafts: () => void
  draftCount: number
}) {
  const hasDrafts = draftCount > 0
  return (
    <div className="w-full max-w-2xl mt-1 sm:mt-2">
      <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground/80 mb-2 sm:mb-3">
        De onde vem esta angariação?
      </p>
      <div
        className={cn(
          'grid gap-2 sm:gap-3',
          hasDrafts ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2',
        )}
      >
        <ChoiceCard
          icon={Briefcase}
          title="De uma oportunidade"
          hint="Liga a um negócio em pipeline."
          onClick={onChooseOpportunity}
          accent="violet"
        />
        <ChoiceCard
          icon={Plus}
          title="Começar do zero"
          hint="Captação directa."
          onClick={onChooseFresh}
          accent="neutral"
        />
        {hasDrafts && (
          <ChoiceCard
            icon={FileEdit}
            title="Retomar rascunho"
            hint={`${draftCount} guardado${draftCount > 1 ? 's' : ''}.`}
            onClick={onChooseDrafts}
            accent="amber"
            badge={draftCount}
          />
        )}
      </div>
    </div>
  )
}

function ChoiceCard({
  icon: Icon,
  title,
  hint,
  onClick,
  accent,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint: string
  onClick: () => void
  accent: 'violet' | 'neutral' | 'amber'
  badge?: number
}) {
  const isViolet = accent === 'violet'
  const isAmber = accent === 'amber'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative rounded-2xl border bg-card/60 p-3 sm:p-4 text-left transition-all',
        isViolet
          ? 'border-violet-200 hover:border-violet-300 dark:border-violet-900/50 dark:hover:border-violet-700 hover:shadow-[0_0_0_3px_rgba(139,92,246,0.10)]'
          : isAmber
            ? 'border-amber-200 hover:border-amber-300 dark:border-amber-900/50 dark:hover:border-amber-700 hover:shadow-[0_0_0_3px_rgba(245,158,11,0.10)]'
            : 'border-border/60 hover:border-foreground/20',
        'focus-visible:outline-none focus-visible:ring-2',
        isViolet ? 'focus-visible:ring-violet-400' : isAmber ? 'focus-visible:ring-amber-400' : 'focus-visible:ring-border',
      )}
    >
      {typeof badge === 'number' && badge > 0 && (
        <span className="absolute top-2 right-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold tabular-nums">
          {badge}
        </span>
      )}
      <div
        className={cn(
          'h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center mb-2 sm:mb-2.5 transition-colors',
          isViolet
            ? 'bg-violet-500/15 ring-1 ring-violet-300/40 dark:ring-violet-700/40 group-hover:bg-violet-500/25'
            : isAmber
              ? 'bg-amber-500/15 ring-1 ring-amber-300/40 dark:ring-amber-700/40 group-hover:bg-amber-500/25'
              : 'bg-muted ring-1 ring-border/60 group-hover:bg-muted/80',
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4',
            isViolet
              ? 'text-violet-600 dark:text-violet-300'
              : isAmber
                ? 'text-amber-600 dark:text-amber-300'
                : 'text-foreground/70',
          )}
        />
      </div>
      <p className="text-[13px] sm:text-sm font-semibold tracking-tight">{title}</p>
      <p className="text-[10.5px] sm:text-[11px] text-muted-foreground leading-snug mt-0.5">{hint}</p>
    </button>
  )
}

/* ─── Fresh confirmation ───────────────────────────────────────────────── */
function FreshConfirmation({
  onResetChoice,
  onContinue,
}: {
  onResetChoice: () => void
  onContinue: () => void
}) {
  return (
    <div className="w-full max-w-md mt-2 space-y-3">
      <div className="rounded-2xl border border-border/40 bg-card/60 px-4 py-3 flex items-center gap-3 text-left">
        <div className="h-9 w-9 rounded-xl bg-muted ring-1 ring-border/60 flex items-center justify-center shrink-0">
          <Plus className="h-4 w-4 text-foreground/70" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold tracking-tight">Começar do zero</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Captação directa, sem pipeline anterior.
          </p>
        </div>
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      </div>
      <button
        type="button"
        onClick={onResetChoice}
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        Voltar a escolher
      </button>
      <div className="pt-1">
        <Button
          type="button"
          size="lg"
          onClick={onContinue}
          className="rounded-full gap-2 shadow-md bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white h-12 px-7 text-base font-semibold"
        >
          Continuar
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/* ─── Opportunity section ──────────────────────────────────────────────── */
function OpportunitySection({
  hasLinkedNegocio,
  pickedNegocioName,
  onResetChoice,
  onPickNegocio,
}: {
  hasLinkedNegocio: boolean
  pickedNegocioName?: string | null
  onResetChoice: () => void
  onPickNegocio: (negocio: NegocioPickerItem) => void
}) {
  if (hasLinkedNegocio || pickedNegocioName) {
    return (
      <div className="w-full max-w-md mt-2 space-y-3">
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/30 px-4 py-3 flex items-center gap-3 text-left">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Briefcase className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold tracking-tight text-emerald-700 dark:text-emerald-300 truncate">
              {pickedNegocioName || 'Oportunidade ligada'}
            </p>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
              Vamos preencher a partir dos dados existentes.
            </p>
          </div>
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        </div>
        {!hasLinkedNegocio && (
          <button
            type="button"
            onClick={onResetChoice}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Voltar a escolher
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mt-2 text-left">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
          Escolhe uma oportunidade
        </p>
        <button
          type="button"
          onClick={onResetChoice}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar
        </button>
      </div>
      <NegocioPickerInline onSelect={onPickNegocio} />
    </div>
  )
}

/* ─── Drafts section ──────────────────────────────────────────────────── */
function DraftsSection({
  drafts,
  onResetChoice,
  onResumeDraft,
  onDraftDeleted,
}: {
  drafts: AcquisitionDraft[]
  onResetChoice: () => void
  onResumeDraft: (id: string) => void
  onDraftDeleted: (id: string) => void
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setDeletingId(id)
    try {
      const res = await fetch(`/api/acquisitions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      onDraftDeleted(id)
      toast.success('Rascunho eliminado')
    } catch {
      toast.error('Erro ao eliminar rascunho')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="w-full max-w-2xl mt-2 text-left">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
          Rascunhos guardados
        </p>
        <button
          type="button"
          onClick={onResetChoice}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar
        </button>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/40 p-8 flex flex-col items-center justify-center gap-2 text-center">
          <FileEdit className="h-7 w-7 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Sem rascunhos por agora</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {drafts.map((draft) => {
            const isDeleting = deletingId === draft.proc_instance_id
            const title =
              !draft.title || draft.title === 'Rascunho' ? 'Nova angariação' : draft.title
            return (
              <li
                key={draft.proc_instance_id}
                className="rounded-2xl border border-border/40 bg-card/60 p-3 transition-all hover:border-amber-300/60 hover:bg-card/80"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onResumeDraft(draft.proc_instance_id)}
                    disabled={isDeleting}
                    className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
                  >
                    <p className="text-sm font-semibold tracking-tight truncate">{title}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {draft.property_type && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                          {draft.property_type}
                        </Badge>
                      )}
                      {draft.city && (
                        <span className="text-[11px] text-muted-foreground">{draft.city}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                      <span>Passo {draft.last_completed_step} de 5</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(draft.updated_at), {
                          locale: pt,
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${(draft.last_completed_step / 5) * 100}%` }}
                      />
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setConfirmDeleteId(draft.proc_instance_id)}
                    disabled={isDeleting}
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label="Eliminar rascunho"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-8 rounded-full mt-2"
                  onClick={() => onResumeDraft(draft.proc_instance_id)}
                  disabled={isDeleting}
                >
                  Retomar
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este rascunho? Esta acção é
              irreversível e todo o trabalho não submetido será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ─── Inline picker ────────────────────────────────────────────────────── */
function NegocioPickerInline({
  onSelect,
}: {
  onSelect: (negocio: NegocioPickerItem) => void
}) {
  const [items, setItems] = useState<NegocioPickerItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/negocios?limit=100')
        if (res.ok) {
          const json = await res.json()
          let data: NegocioPickerItem[] = json.data || []
          // Filtrar para tipos compatíveis com angariação (vendedor / arrendador).
          data = data.filter((n) => ['Venda', 'Arrendador'].includes(n.tipo))
          if (!cancelled) setItems(data)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return items
    return items.filter((n) => {
      const name = (n.lead?.full_name || n.lead?.nome || '').toLowerCase()
      const loc = (n.localizacao || '').toLowerCase()
      const tipo = (n.tipo || '').toLowerCase()
      return name.includes(q) || loc.includes(q) || tipo.includes(q)
    })
  }, [items, debouncedSearch])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, localização ou tipo…"
          className="pl-9 rounded-full bg-card/60 border-border/40"
        />
      </div>

      <ScrollArea className="h-[320px] rounded-2xl border border-border/40 bg-card/40 p-2">
        {isLoading && items.length === 0 ? (
          <div className="space-y-2 p-1">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-10">
            <Briefcase className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {debouncedSearch.trim() ? 'Sem resultados' : 'Sem oportunidades disponíveis'}
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 p-1">
            {filtered.map((n) => (
              <PickerRow
                key={n.id}
                negocio={n}
                onClick={() => onSelect(n)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}

function PickerRow({
  negocio,
  onClick,
}: {
  negocio: NegocioPickerItem
  onClick: () => void
}) {
  const name = negocio.lead?.full_name || negocio.lead?.nome || 'Sem nome'
  const value =
    negocio.preco_venda ??
    negocio.orcamento_max ??
    negocio.orcamento ??
    negocio.renda_pretendida ??
    negocio.renda_max_mensal ??
    null
  const valueLabel = value
    ? negocio.renda_pretendida || negocio.renda_max_mensal
      ? `${eur.format(value)}/mês`
      : eur.format(value)
    : null

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all border border-transparent hover:bg-card/80 hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <div className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{name}</p>
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {negocio.tipo}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 truncate">
            {negocio.tipo_imovel && <span>{negocio.tipo_imovel}</span>}
            {negocio.localizacao && (
              <span className="inline-flex items-center gap-1 truncate">
                <Building2 className="h-3 w-3" />
                {negocio.localizacao}
              </span>
            )}
            {valueLabel && (
              <span className="ml-auto font-medium text-foreground/80 whitespace-nowrap">
                {valueLabel}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  )
}
