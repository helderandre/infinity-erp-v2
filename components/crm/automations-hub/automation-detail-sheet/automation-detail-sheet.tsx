"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Calendar, Loader2, Repeat, Trash2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { AUTOMATION_SHEET_COPY } from "@/lib/constants-automations"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAutomationDetail, type AutomationKind } from "@/hooks/use-automation-detail"
import { AutomationChannelChips } from "./automation-channel-chips"
import { AutomationInfoSection } from "./automation-info-section"
import { AutomationContactsSection } from "./automation-contacts-section"
import { AutomationTemplatesSection } from "./automation-templates-section"
import { AutomationRunsSection } from "./automation-runs-section"
import { FixedEventDetailDialog } from "../custom-events/fixed-event-detail-dialog"

interface Props {
  kind: AutomationKind
  eventId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAfterMutation?: () => void
  /** Deep-link: quando `'failed'`, abre na tab "Envios feitos" com filtro pré-aplicado. */
  initialRunsFilter?: "all" | "failed"
}

const TAB_TRIGGER_CLASS =
  "rounded-full text-xs h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-colors"

export function AutomationDetailSheet({
  kind,
  eventId,
  open,
  onOpenChange,
  onAfterMutation,
  initialRunsFilter,
}: Props) {
  const isMobile = useIsMobile()
  const defaultTab = initialRunsFilter === "failed" ? "runs" : "info"
  const [tab, setTab] = useState(defaultTab)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { event, isLoading, refetch } = useAutomationDetail(kind, open ? eventId : null)

  // Reset tab sempre que o sheet abre. Respeita initialRunsFilter como hint.
  useEffect(() => {
    if (open) setTab(initialRunsFilter === "failed" ? "runs" : "info")
  }, [open, eventId, initialRunsFilter])

  if (kind === "fixed") {
    return (
      <FixedEventDetailDialog
        eventId={eventId}
        open={open}
        onOpenChange={onOpenChange}
      />
    )
  }

  const copyTabs = isMobile ? AUTOMATION_SHEET_COPY.tabsShort : AUTOMATION_SHEET_COPY.tabsLong
  const footer = AUTOMATION_SHEET_COPY.footer

  async function handleDelete() {
    if (!eventId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/automacao/custom-events/${eventId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(footer.deleteToast)
      setDeleteOpen(false)
      onOpenChange(false)
      onAfterMutation?.()
    } catch {
      toast.error(footer.deleteError)
    } finally {
      setDeleting(false)
    }
  }

  function handleMutation() {
    void refetch()
    onAfterMutation?.()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl",
            "bg-background/90 supports-[backdrop-filter]:bg-background/90 backdrop-blur-2xl",
            isMobile
              ? "data-[side=bottom]:h-[85dvh] rounded-t-3xl"
              : "w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl",
          )}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
          )}

          {/* Header */}
          <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
            <SheetHeader className="p-0 gap-0">
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
                {event?.name ?? (isLoading ? AUTOMATION_SHEET_COPY.loading : "Automatismo")}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detalhes do automatismo de contactos, com tabs de informação, contactos, templates e envios.
              </SheetDescription>
            </SheetHeader>

            {event && (
              <div
                className={cn(
                  "mt-3 flex items-center gap-2",
                  isMobile && "overflow-x-auto",
                )}
              >
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-2 py-0.5 text-xs shrink-0">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date(event.event_date + "T00:00:00").toLocaleDateString("pt-PT", {
                      day: "2-digit",
                      month: "long",
                    })}
                    {" · "}
                    {String(event.send_hour).padStart(2, "0")}:00
                  </span>
                </div>
                {event.is_recurring && (
                  <div className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/60 px-2 py-0.5 text-xs shrink-0">
                    <Repeat className="h-3 w-3" />
                    <span>Anual</span>
                  </div>
                )}
                <AutomationChannelChips
                  email={event.effective_channels.email}
                  whatsapp={event.effective_channels.whatsapp}
                  compact
                  className="shrink-0"
                />
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
            <div className="shrink-0 px-6">
              <TabsList className="grid w-full grid-cols-4 h-9 p-0.5 rounded-full bg-muted/50 border border-border/30">
                <TabsTrigger value="info" className={TAB_TRIGGER_CLASS}>
                  {copyTabs.info}
                </TabsTrigger>
                <TabsTrigger value="contacts" className={TAB_TRIGGER_CLASS}>
                  {copyTabs.contacts}
                </TabsTrigger>
                <TabsTrigger value="templates" className={TAB_TRIGGER_CLASS}>
                  {copyTabs.templates}
                </TabsTrigger>
                <TabsTrigger value="runs" className={TAB_TRIGGER_CLASS}>
                  {copyTabs.runs}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              {isLoading && !event ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-40" />
                </div>
              ) : !event ? (
                <p className="text-sm text-muted-foreground">
                  Não foi possível carregar este automatismo.
                </p>
              ) : (
                <>
                  <TabsContent value="info" className="mt-0 space-y-5">
                    <AutomationInfoSection event={event} onRefetch={handleMutation} />
                  </TabsContent>
                  <TabsContent value="contacts" className="mt-0">
                    <AutomationContactsSection event={event} onRefetch={handleMutation} />
                  </TabsContent>
                  <TabsContent value="templates" className="mt-0">
                    <AutomationTemplatesSection eventId={event.id} onRefetch={handleMutation} />
                  </TabsContent>
                  <TabsContent value="runs" className="mt-0">
                    <AutomationRunsSection
                      runs={event.runs ?? []}
                      eventDate={event.event_date}
                      onRefetch={handleMutation}
                      initialFilter={initialRunsFilter ?? "all"}
                    />
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>

          {/* Footer */}
          <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              {footer.close}
            </Button>
            <div className="ml-auto">
              <Button
                variant="destructive"
                className="rounded-full gap-1.5"
                onClick={() => setDeleteOpen(true)}
                disabled={!event}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {footer.deleteCustom}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{footer.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{footer.confirmDeleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {footer.confirmDeleteCta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

