'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/kibo-ui/spinner'
import {
  Check, Clock, FileText, Images, ImageIcon, Layers, Plus, Video, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { MediaTaskSheet } from '@/components/tasks/media-task-sheet'

interface Props {
  processId: string
  /** Quando false, esconde o botão. Tipicamente passado pelo caller que
   *  já decidiu visibilidade (gestão + angariação + primeira stage). */
  visible?: boolean
  /**
   * Quando true, o clique NÃO cria a tarefa imediatamente — abre primeiro uma
   * sheet a explicar o que a "Tarefa Media" vai fazer; só ao confirmar é que
   * cria (se ainda não existir) e abre o editor. Usado na vista nova de passos.
   */
  introFirst?: boolean
}

interface MediaTaskRow {
  id: string
  is_completed: boolean
  due_date: string | null
}

/**
 * Botão "Tarefa Media" no header da primeira stage do processo.
 *
 * Comportamento idempotente:
 *  - Mount → GET /api/processes/[id]/media-task: descobre se já existe.
 *  - Click sem tarefa → POST cria + abre o <MediaTaskSheet>.
 *  - Click com tarefa → abre o sheet (não cria nova).
 *  - Com `introFirst`, o clique abre primeiro a sheet explicativa.
 *
 * Só a gestão vê o botão (a criação é gated server-side na mesma).
 *
 * O label muda consoante o estado:
 *  - sem tarefa: "Tarefa Media"
 *  - tarefa pendente: "Ver tarefa Media" (clock icon)
 *  - tarefa concluída: "Media concluída" (check icon)
 */
export function MediaTaskStageButton({ processId, visible = true, introFirst = false }: Props) {
  const { user } = useUser()
  const isMgmt = isManagementRole(user?.role_names ?? [])
  const [task, setTask] = useState<MediaTaskRow | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [introOpen, setIntroOpen] = useState(false)

  const fetchTask = useCallback(async () => {
    if (!visible || !isMgmt) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/media-task`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setTask(data.task ?? null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [processId, visible, isMgmt])

  useEffect(() => {
    fetchTask()
  }, [fetchTask])

  /** Cria a tarefa (se não existir) e abre o editor. */
  const openOrCreate = useCallback(async () => {
    if (task) {
      setSheetOpen(true)
      return
    }
    setIsCreating(true)
    try {
      const res = await fetch(`/api/processes/${processId}/media-task`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao criar tarefa Media')
      }
      const data = await res.json()
      setTask(data.task)
      toast.success(
        data.created
          ? 'Tarefa Media criada e atribuída ao consultor'
          : 'Tarefa Media já existia',
      )
      setSheetOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar tarefa Media')
    } finally {
      setIsCreating(false)
    }
  }, [task, processId])

  const handleClick = useCallback(() => {
    if (introFirst) {
      setIntroOpen(true)
      return
    }
    openOrCreate()
  }, [introFirst, openOrCreate])

  const handleIntroConfirm = useCallback(async () => {
    setIntroOpen(false)
    await openOrCreate()
  }, [openOrCreate])

  if (!visible || !isMgmt) return null

  const label = task
    ? task.is_completed
      ? 'Media concluída'
      : 'Ver tarefa Media'
    : 'Tarefa Media'
  const icon = task
    ? task.is_completed
      ? <Check className="h-3.5 w-3.5" />
      : <Clock className="h-3.5 w-3.5" />
    : <Plus className="h-3.5 w-3.5" />
  const tone = task
    ? task.is_completed
      ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
      : 'text-violet-700 dark:text-violet-300 border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10'
    : 'text-violet-700 dark:text-violet-300 border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10'

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isLoading || isCreating}
        onClick={handleClick}
        className={cn(
          'h-7 rounded-full text-[11px] font-medium gap-1.5 px-3',
          tone,
        )}
        title={label}
      >
        {isCreating ? (
          <Spinner className="h-3 w-3" />
        ) : (
          <>
            <Images className="h-3.5 w-3.5" />
            {icon}
          </>
        )}
        <span className="hidden sm:inline">{label}</span>
      </Button>

      <MediaTaskIntroSheet
        open={introOpen}
        onOpenChange={setIntroOpen}
        task={task}
        isCreating={isCreating}
        onConfirm={handleIntroConfirm}
      />

      <MediaTaskSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        taskId={task?.id ?? null}
        onCompleted={fetchTask}
      />
    </>
  )
}

/* ── Sheet explicativa — "o que vai acontecer" antes de criar ──────────── */

function MediaTaskIntroSheet({
  open,
  onOpenChange,
  task,
  isCreating,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: MediaTaskRow | null
  isCreating: boolean
  onConfirm: () => void
}) {
  const isMobile = useIsMobile()
  const exists = !!task
  const completed = !!task?.is_completed

  const confirmLabel = exists ? 'Abrir tarefa' : 'Criar tarefa e abrir'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        showCloseButton={false}
        className={cn(
          'flex flex-col gap-0 overflow-hidden border-border/40 p-0 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[460px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/25" />
        )}

        <SheetHeader className="shrink-0 flex-row items-start justify-between gap-3 px-5 pb-3 pt-8 sm:pt-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-300/40 dark:ring-violet-700/40">
              <Images className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base leading-tight">Tarefa Media</SheetTitle>
              <SheetDescription className="text-xs">
                Recolha de fotos, vídeos, plantas e descrição do imóvel.
              </SheetDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 shrink-0 rounded-full"
            aria-label="Fechar"
            disabled={isCreating}
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          {exists && (
            <div
              className={cn(
                'rounded-2xl border px-3.5 py-3 text-sm',
                completed
                  ? 'border-emerald-500/30 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                  : 'border-violet-500/30 bg-violet-50/60 text-violet-700 dark:bg-violet-950/20 dark:text-violet-300',
              )}
            >
              {completed
                ? 'Esta tarefa Media já foi concluída. Podes reabri-la para rever ou actualizar a media.'
                : 'Já existe uma tarefa Media para este imóvel. Vais abri-la em vez de criar uma nova.'}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {exists ? 'O que inclui' : 'O que vai acontecer'}
            </p>
            <ul className="space-y-2.5">
              {!exists && (
                <IntroItem icon={Plus}>
                  Cria uma tarefa de recolha de media para este imóvel, atribuída
                  ao <strong>consultor responsável</strong>, com vencimento hoje
                  (o consultor é notificado).
                </IntroItem>
              )}
              <IntroItem icon={ImageIcon}>
                <strong>Fotos</strong> — carrega e organiza as fotografias do imóvel.
              </IntroItem>
              <IntroItem icon={Video}>
                <strong>Vídeos</strong> — adiciona vídeos da visita ou apresentação.
              </IntroItem>
              <IntroItem icon={Layers}>
                <strong>Plantas</strong> — plantas e renders 3D do imóvel.
              </IntroItem>
              <IntroItem icon={FileText}>
                <strong>Descrição</strong> — gerada por IA a partir dos dados do
                imóvel, com assistente para alterar e edição à mão.
              </IntroItem>
              <IntroItem icon={Check}>
                Tudo é escrito directamente no imóvel. Ao marcar como concluída, a
                gestão é notificada.
              </IntroItem>
            </ul>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border/40 bg-background/60 px-5 py-3 backdrop-blur-xl">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-full bg-neutral-900 text-xs text-white hover:bg-neutral-800"
            onClick={onConfirm}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Spinner className="h-3 w-3" />
                A criar…
              </>
            ) : (
              <>
                <Images className="h-3.5 w-3.5" />
                {confirmLabel}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function IntroItem({
  icon: Icon,
  children,
}: {
  icon: typeof Images
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-snug text-foreground/90">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="[&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </span>
    </li>
  )
}
