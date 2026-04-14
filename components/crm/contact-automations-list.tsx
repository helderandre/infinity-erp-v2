"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { pt } from "date-fns/locale"
import { Bot, Mail, MessageCircle, Plus, Trash2, History, Pencil, Send, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  useContactAutomations,
  type ContactAutomationWithLastRun,
} from "@/hooks/use-contact-automations"
import { CONTACT_AUTOMATION_EVENT_LABELS_PT } from "@/types/contact-automation"
import { ContactAutomationWizard } from "./contact-automation-wizard"
import { ContactAutomationHistoryDialog } from "./contact-automation-history-dialog"
import { ContactAutomationEditDialog } from "./contact-automation-edit-dialog"
import { ContactAutomationsCalendar } from "./contact-automations-calendar"

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
  failed: "Falhou",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "default",
  completed: "secondary",
  cancelled: "outline",
  failed: "destructive",
}

interface Props {
  contactId: string
  contactBirthday: string | null
  hasDeals: boolean
}

export function ContactAutomationsList({ contactId, contactBirthday, hasDeals }: Props) {
  const { items, isLoading, cancel, cancelAll, refetch, test } = useContactAutomations(contactId)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [confirmCancelAll, setConfirmCancelAll] = useState(false)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<ContactAutomationWithLastRun | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)

  async function handleTest(a: ContactAutomationWithLastRun) {
    setTestingId(a.id)
    try {
      await test(a.id)
      toast.success("Teste despachado — verifica o histórico em instantes")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setTestingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4" /> Automatismos
          </h3>
          <p className="text-xs text-muted-foreground">
            Envios automáticos por email ou WhatsApp em datas-chave.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCalendar((v) => !v)}
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              {showCalendar ? "Ocultar calendário" : "Calendário"}
            </Button>
          )}
          {items.some((a) => a.status === "scheduled") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmCancelAll(true)}
            >
              Cancelar todos
            </Button>
          )}
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Criar automatismo
          </Button>
        </div>
      </div>

      {showCalendar && items.length > 0 && (
        <ContactAutomationsCalendar contactId={contactId} items={items} />
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Bot className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Ainda não há automatismos para este contacto.
            </p>
            <Button size="sm" variant="outline" onClick={() => setWizardOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Criar o primeiro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <AutomationRow
              key={a.id}
              a={a}
              testing={testingId === a.id}
              onCancel={() => setConfirmCancelId(a.id)}
              onHistory={() => setHistoryId(a.id)}
              onEdit={() => setEditItem(a)}
              onTest={() => handleTest(a)}
            />
          ))}
        </div>
      )}

      <ContactAutomationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        contactId={contactId}
        contactBirthday={contactBirthday}
        hasDeals={hasDeals}
        onCreated={() => {
          setWizardOpen(false)
          refetch()
        }}
      />

      {historyId && (
        <ContactAutomationHistoryDialog
          contactId={contactId}
          automationId={historyId}
          open={!!historyId}
          onOpenChange={(o) => !o && setHistoryId(null)}
        />
      )}

      <ContactAutomationEditDialog
        open={!!editItem}
        onOpenChange={(o) => !o && setEditItem(null)}
        contactId={contactId}
        automationId={editItem?.id ?? null}
        initial={
          editItem
            ? {
                trigger_at: editItem.trigger_at,
                timezone: editItem.timezone,
                recurrence: editItem.recurrence as "once" | "yearly",
              }
            : null
        }
        onSaved={() => {
          setEditItem(null)
          refetch()
        }}
      />

      <AlertDialog open={confirmCancelAll} onOpenChange={setConfirmCancelAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar todos os agendamentos?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os automatismos agendados deste contacto serão cancelados. Os já enviados permanecem no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  const n = await cancelAll()
                  toast.success(`${n} automatismo(s) cancelado(s)`)
                } catch (e: any) {
                  toast.error(e.message)
                }
                setConfirmCancelAll(false)
              }}
            >
              Cancelar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmCancelId} onOpenChange={(o) => !o && setConfirmCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar automatismo?</AlertDialogTitle>
            <AlertDialogDescription>
              Este automatismo deixará de ser enviado. Os envios já concluídos permanecem no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmCancelId) return
                try {
                  await cancel(confirmCancelId)
                  toast.success("Automatismo cancelado")
                } catch (e: any) {
                  toast.error(e.message)
                }
                setConfirmCancelId(null)
              }}
            >
              Cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AutomationRow({
  a,
  testing,
  onCancel,
  onHistory,
  onEdit,
  onTest,
}: {
  a: ContactAutomationWithLastRun
  testing: boolean
  onCancel: () => void
  onHistory: () => void
  onEdit: () => void
  onTest: () => void
}) {
  const eventLabel =
    a.event_type === "festividade" && a.event_config?.label
      ? `Festividade: ${a.event_config.label}`
      : CONTACT_AUTOMATION_EVENT_LABELS_PT[a.event_type]

  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex -space-x-1">
            {a.channels.includes("email") && (
              <div className="rounded-full bg-blue-100 p-1.5 ring-2 ring-background">
                <Mail className="h-3.5 w-3.5 text-blue-700" />
              </div>
            )}
            {a.channels.includes("whatsapp") && (
              <div className="rounded-full bg-emerald-100 p-1.5 ring-2 ring-background">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{eventLabel}</p>
              <Badge variant={STATUS_VARIANTS[a.status]} className="text-[10px]">
                {STATUS_LABELS[a.status]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {a.recurrence === "yearly" ? "Todos os anos" : "Uma vez"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Próxima execução:{" "}
              <strong className="text-foreground">
                {format(parseISO(a.trigger_at), "d 'de' MMMM yyyy 'às' HH:mm", { locale: pt })}
              </strong>{" "}
              · {a.timezone}
            </p>
            {a.last_run && (
              <p className="text-[11px] text-muted-foreground">
                Último envio:{" "}
                {a.last_run.sent_at
                  ? format(parseISO(a.last_run.sent_at), "d/M/yyyy HH:mm", { locale: pt })
                  : STATUS_LABELS[a.last_run.status] ?? a.last_run.status}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {a.status === "scheduled" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onTest}
                disabled={testing}
                title="Testar agora"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
            {a.status === "scheduled" && (
              <Button size="icon" variant="ghost" onClick={onEdit} title="Editar data/hora">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onHistory} title="Histórico">
              <History className="h-4 w-4" />
            </Button>
            {a.status === "scheduled" && (
              <Button size="icon" variant="ghost" onClick={onCancel} title="Cancelar">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
