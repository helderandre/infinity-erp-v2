'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Users,
  Zap,
  Handshake,
  CheckSquare,
  Bug,
  Lightbulb,
  Library,
  ContactRound,
  Briefcase,
  CalendarPlus,
  ChevronRight,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { isLeadership } from '@/lib/auth/roles'
import { toast } from 'sonner'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'
import { DealDialog } from '@/components/deals/deal-dialog'
import { TaskForm } from '@/components/tasks/task-form'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { LeadEntryDialog } from '@/components/leads/lead-entry-dialog'
import { ContactDialog } from '@/components/leads/contact-dialog'
import { NewNegocioDialog } from '@/components/crm/new-negocio-dialog'
import { CalendarEventForm } from '@/components/calendar/calendar-event-form'
import type { CalendarEventFormData } from '@/lib/validations/calendar'

type RowAction = {
  key: string
  icon: React.ComponentType<{ className?: string }>
  /** Tailwind tint class for the small icon tile (bg + text). */
  tint: string
  label: string
  description?: string
  onClick: () => void
}

type CardGroup = {
  title: string
  rows: RowAction[]
}

export function QuickActions() {
  const router = useRouter()
  const { user } = useUser()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [novoContactoOpen, setNovoContactoOpen] = useState(false)
  const [negocioOpen, setNegocioOpen] = useState(false)
  const [acquisitionOpen, setAcquisitionOpen] = useState(false)
  const [fechoOpen, setFechoOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [ideiaOpen, setIdeiaOpen] = useState(false)
  const [consultants, setConsultants] = useState<Array<{ id: string; commercial_name: string }>>([])

  useEffect(() => {
    fetch('/api/users/consultants')
      .then((res) => res.json())
      .then((data) => setConsultants(data.data || data || []))
      .catch(() => {})
  }, [])

  // Listen for mobile toolbar events
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail
      if (key === 'lead') setContactOpen(true)
      else if (key === 'contacto') setNovoContactoOpen(true)
      else if (key === 'negocio') setNegocioOpen(true)
      else if (key === 'acquisition') setAcquisitionOpen(true)
      else if (key === 'deal') setFechoOpen(true)
      else if (key === 'task') setTaskOpen(true)
      else if (key === 'event') setEventOpen(true)
    }
    window.addEventListener('open-quick-action', handler)
    return () => window.removeEventListener('open-quick-action', handler)
  }, [])

  // Helper: close the sheet then open the target dialog. Slight tick to let
  // the sheet's exit animation start before mounting the next overlay —
  // prevents stacking-flash on mobile.
  const trigger = (open: () => void) => {
    setSheetOpen(false)
    setTimeout(open, 80)
  }

  const handleEventSubmit = async (data: CalendarEventFormData) => {
    try {
      // Tarefas via /api/tasks; eventos normais via /api/calendar/events.
      // Mantém paridade com o handler da página de calendário.
      if (data.item_type === 'task') {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            description: data.description || null,
            priority: data.priority ?? 4,
            due_date: data.start_date || null,
            assigned_to: data.user_id || null,
            is_recurring: data.is_recurring,
            recurrence_rule: data.recurrence_rule || null,
            reminders: data.reminders ?? [],
          }),
        })
        if (!res.ok) throw new Error()
        toast.success('Tarefa criada')
      } else {
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error()
        toast.success('Evento criado')
      }
      setEventOpen(false)
    } catch {
      toast.error('Erro ao criar')
      throw new Error('falha')
    }
  }

  const groups: CardGroup[] = [
    {
      title: 'Pipeline',
      rows: [
        {
          key: 'lead',
          icon: Users,
          tint: 'bg-sky-500/15 text-sky-600',
          label: 'Nova Lead',
          description: 'Contacto vindo de um portal ou campanha',
          onClick: () => trigger(() => setContactOpen(true)),
        },
        {
          key: 'contacto',
          icon: ContactRound,
          tint: 'bg-violet-500/15 text-violet-600',
          label: 'Novo Contacto',
          description: 'Adicionar à agenda de contactos',
          onClick: () => trigger(() => setNovoContactoOpen(true)),
        },
        {
          key: 'negocio',
          icon: Briefcase,
          tint: 'bg-amber-500/15 text-amber-600',
          label: 'Nova Oportunidade',
          description: 'Abrir oportunidade a partir de um contacto',
          onClick: () => trigger(() => setNegocioOpen(true)),
        },
        {
          key: 'acquisition',
          icon: Zap,
          tint: 'bg-emerald-500/15 text-emerald-600',
          label: 'Nova Angariação',
          description: 'Iniciar processo de angariação',
          onClick: () => trigger(() => setAcquisitionOpen(true)),
        },
        {
          key: 'deal',
          icon: Handshake,
          tint: 'bg-rose-500/15 text-rose-600',
          label: 'Novo Negócio',
          description: 'Registar venda / arrendamento concluído',
          onClick: () => trigger(() => setFechoOpen(true)),
        },
      ],
    },
    {
      title: 'Trabalho',
      rows: [
        {
          key: 'task',
          icon: CheckSquare,
          tint: 'bg-indigo-500/15 text-indigo-600',
          label: 'Nova Tarefa',
          description: 'Pessoal, recorrente ou para um colega',
          onClick: () => trigger(() => setTaskOpen(true)),
        },
        {
          key: 'event',
          icon: CalendarPlus,
          tint: 'bg-teal-500/15 text-teal-600',
          label: 'Novo Evento',
          description: 'Reunião, visita ou compromisso',
          onClick: () => trigger(() => setEventOpen(true)),
        },
        {
          key: 'documentos',
          icon: Library,
          tint: 'bg-slate-500/15 text-slate-600',
          label: 'Documentos e Marketing',
          description: 'Biblioteca de templates e materiais',
          onClick: () => {
            setSheetOpen(false)
            router.push('/dashboard/documentos')
          },
        },
      ],
    },
    {
      title: 'Feedback',
      rows: [
        {
          key: 'ticket',
          icon: Bug,
          tint: 'bg-red-500/15 text-red-600',
          label: 'Reportar Problema',
          description: 'Algo não está a funcionar',
          onClick: () => trigger(() => setTicketOpen(true)),
        },
        {
          key: 'ideia',
          icon: Lightbulb,
          tint: 'bg-yellow-500/15 text-yellow-600',
          label: 'Sugerir Ideia',
          description: 'Como podemos melhorar?',
          onClick: () => trigger(() => setIdeiaOpen(true)),
        },
      ],
    },
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/70 hover:bg-zinc-900/85 text-white backdrop-blur-md border border-white/10 transition-colors"
      >
        <Plus className="size-4" />
        <span className="sr-only">Ações rápidas</span>
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className={cn(
            'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
            'w-full sm:max-w-[440px] rounded-l-3xl sm:rounded-l-3xl',
          )}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5" />
              Ações rápidas
            </SheetTitle>
            <SheetDescription className="sr-only">
              Cria algo novo ou reporta um problema
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
            {groups.map((group) => (
              <section key={group.title} className="space-y-2">
                <p className="px-1 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
                  {group.title}
                </p>
                <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden divide-y divide-border/40">
                  {group.rows.map((row) => {
                    const Icon = row.icon
                    return (
                      <button
                        key={row.key}
                        type="button"
                        onClick={row.onClick}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left group"
                      >
                        <span
                          className={cn(
                            'shrink-0 h-9 w-9 rounded-xl flex items-center justify-center',
                            row.tint,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium leading-tight">
                            {row.label}
                          </span>
                          {row.description && (
                            <span className="block text-[11px] text-muted-foreground/80 truncate mt-0.5">
                              {row.description}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-foreground transition-colors" />
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <LeadEntryDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        onComplete={() => setContactOpen(false)}
      />

      <ContactDialog
        open={novoContactoOpen}
        onOpenChange={setNovoContactoOpen}
        onComplete={() => setNovoContactoOpen(false)}
      />

      <NewNegocioDialog
        open={negocioOpen}
        onOpenChange={setNegocioOpen}
        onCreated={(negocioId) => {
          setNegocioOpen(false)
          router.push(`/dashboard/negocios/${negocioId}`)
        }}
      />

      <AcquisitionDialog
        open={acquisitionOpen}
        onOpenChange={setAcquisitionOpen}
        onComplete={(procInstanceId) => {
          setAcquisitionOpen(false)
          router.push(`/dashboard/processos/${procInstanceId}`)
        }}
      />

      <DealDialog
        open={fechoOpen}
        onOpenChange={setFechoOpen}
        onComplete={(dealId) => {
          setFechoOpen(false)
          router.push(`/dashboard/fechos/${dealId}`)
        }}
      />

      <TaskForm
        open={taskOpen}
        onOpenChange={setTaskOpen}
        onSuccess={() => setTaskOpen(false)}
        consultants={consultants}
      />

      <CalendarEventForm
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        onSubmit={handleEventSubmit}
        users={consultants.map((c) => ({ id: c.id, name: c.commercial_name }))}
        isLeadership={isLeadership(user?.role_names ?? [])}
      />

      <FeedbackDialog
        type="ticket"
        open={ticketOpen}
        onOpenChange={setTicketOpen}
      />

      <FeedbackDialog
        type="ideia"
        open={ideiaOpen}
        onOpenChange={setIdeiaOpen}
      />
    </>
  )
}
