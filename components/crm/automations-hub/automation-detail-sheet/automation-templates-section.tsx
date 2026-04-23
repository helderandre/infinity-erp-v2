"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, Eye, ExternalLink, Plus, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { AUTOMATION_SHEET_COPY } from "@/lib/constants-automations"
import { cn } from "@/lib/utils"
import { SectionCard } from "./section-card"
import { InlineTemplateEditorDialog } from "../inline-template-editor-dialog"

interface Props {
  eventId: string
  onRefetch: () => void
}

interface EmailTemplate {
  id: string
  name: string
  subject: string | null
  body_html: string | null
  category: string | null
  scope: string
  is_system: boolean
}

interface WppTemplate {
  id: string
  name: string
  messages: unknown
  category: string | null
  scope: string
  is_system: boolean
}

interface TemplatesPayload {
  email: { default: EmailTemplate | null; used: EmailTemplate[]; available: EmailTemplate[] }
  whatsapp: { default: WppTemplate | null; used: WppTemplate[]; available: WppTemplate[] }
}

export function AutomationTemplatesSection({ eventId, onRefetch }: Props) {
  const copy = AUTOMATION_SHEET_COPY.templatesSection
  const [data, setData] = useState<TemplatesPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creatingChannel, setCreatingChannel] = useState<"email" | "whatsapp" | null>(null)
  const [previewing, setPreviewing] = useState<
    | { type: "email"; tpl: EmailTemplate }
    | { type: "whatsapp"; tpl: WppTemplate }
    | null
  >(null)

  const fetchIt = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/automacao/custom-events/${eventId}/templates`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void fetchIt()
  }, [fetchIt])

  async function makeDefault(channel: "email" | "whatsapp", templateId: string) {
    setBusyId(templateId)
    try {
      // Grava no `consultant_template_defaults` (category = eventId para custom events)
      // — fonte de verdade partilhada com a tab "Os meus templates".
      const res = await fetch("/api/automacao/template-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: eventId,
          channel,
          template_id: templateId,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(copy.madeDefaultToast)
      onRefetch()
      void fetchIt()
    } catch {
      toast.error(copy.madeDefaultError)
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (!data) return <p className="text-sm text-muted-foreground">Sem templates disponíveis.</p>

  return (
    <div className="space-y-4">
      {/* Email */}
      <SectionCard
        title={copy.emailHeading}
        action={<NewTemplateButton onClick={() => setCreatingChannel("email")} />}
      >
        <div className="space-y-3">
          <TemplateGroupEmpty show={!data.email.default && data.email.used.length === 0} text={copy.emptyUsed}>
            {data.email.default && (
              <EmailTemplateCard
                tpl={data.email.default}
                isDefault
                onPreview={() => setPreviewing({ type: "email", tpl: data.email.default! })}
              />
            )}
            {data.email.used.map((tpl) => (
              <EmailTemplateCard
                key={tpl.id}
                tpl={tpl}
                onPreview={() => setPreviewing({ type: "email", tpl })}
                onMakeDefault={() => makeDefault("email", tpl.id)}
                busy={busyId === tpl.id}
              />
            ))}
          </TemplateGroupEmpty>

          {data.email.available.length > 0 && (
            <>
              <TemplateSubheading label={copy.availableHeading} />
              <div className="space-y-2">
                {data.email.available.map((tpl) => (
                  <EmailTemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    onPreview={() => setPreviewing({ type: "email", tpl })}
                    onMakeDefault={() => makeDefault("email", tpl.id)}
                    busy={busyId === tpl.id}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* WhatsApp */}
      <SectionCard
        title={copy.whatsappHeading}
        titleClassName="text-emerald-600"
        action={<NewTemplateButton onClick={() => setCreatingChannel("whatsapp")} />}
      >
        <div className="space-y-3">
          <TemplateGroupEmpty show={!data.whatsapp.default && data.whatsapp.used.length === 0} text={copy.emptyUsed}>
            {data.whatsapp.default && (
              <WppTemplateCard
                tpl={data.whatsapp.default}
                isDefault
                onPreview={() => setPreviewing({ type: "whatsapp", tpl: data.whatsapp.default! })}
              />
            )}
            {data.whatsapp.used.map((tpl) => (
              <WppTemplateCard
                key={tpl.id}
                tpl={tpl}
                onPreview={() => setPreviewing({ type: "whatsapp", tpl })}
                onMakeDefault={() => makeDefault("whatsapp", tpl.id)}
                busy={busyId === tpl.id}
              />
            ))}
          </TemplateGroupEmpty>

          {data.whatsapp.available.length > 0 && (
            <>
              <TemplateSubheading label={copy.availableHeading} />
              <div className="space-y-2">
                {data.whatsapp.available.map((tpl) => (
                  <WppTemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    onPreview={() => setPreviewing({ type: "whatsapp", tpl })}
                    onMakeDefault={() => makeDefault("whatsapp", tpl.id)}
                    busy={busyId === tpl.id}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <TemplatePreviewDialog
        preview={previewing}
        onClose={() => setPreviewing(null)}
      />

      <InlineTemplateEditorDialog
        channel={creatingChannel ?? "email"}
        scope="consultant"
        category={eventId}
        open={creatingChannel !== null}
        onOpenChange={(o) => !o && setCreatingChannel(null)}
        onCreated={() => {
          void fetchIt()
          onRefetch()
        }}
      />
    </div>
  )
}

function NewTemplateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary hover:bg-primary/5"
    >
      <Plus className="h-3 w-3" />
      Novo template
    </button>
  )
}

function TemplateSubheading({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
  )
}

function TemplateGroupEmpty({
  show,
  text,
  children,
}: {
  show: boolean
  text: string
  children: React.ReactNode
}) {
  if (show) {
    return <p className="text-xs text-muted-foreground italic">{text}</p>
  }
  return <div className="space-y-2">{children}</div>
}

function EmailTemplateCard({
  tpl,
  isDefault,
  onPreview,
  onMakeDefault,
  busy,
}: {
  tpl: EmailTemplate
  isDefault?: boolean
  onPreview: () => void
  onMakeDefault?: () => void
  busy?: boolean
}) {
  const copy = AUTOMATION_SHEET_COPY.templatesSection
  return (
    <article
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        isDefault ? "border-primary/40 bg-primary/5" : "border-border/40 bg-background/60",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{tpl.name}</p>
          {isDefault && (
            <Badge variant="default" className="h-5 text-[10px] gap-0.5">
              <Star className="h-2.5 w-2.5" />
              {copy.defaultBadge}
            </Badge>
          )}
        </div>
        {tpl.subject && <p className="text-xs text-muted-foreground truncate">{tpl.subject}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" onClick={onPreview}>
          <Eye className="h-3 w-3 mr-1" />
          {copy.previewButton}
        </Button>
        {!isDefault && onMakeDefault && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-full text-xs"
            onClick={onMakeDefault}
            disabled={busy}
          >
            <Check className="h-3 w-3 mr-1" />
            {copy.makeDefaultButton}
          </Button>
        )}
        <Link
          href={`/dashboard/templates-email/${tpl.id}`}
          target="_blank"
          className="inline-flex items-center h-7 px-2 rounded-full text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </article>
  )
}

function WppTemplateCard({
  tpl,
  isDefault,
  onPreview,
  onMakeDefault,
  busy,
}: {
  tpl: WppTemplate
  isDefault?: boolean
  onPreview: () => void
  onMakeDefault?: () => void
  busy?: boolean
}) {
  const copy = AUTOMATION_SHEET_COPY.templatesSection
  return (
    <article
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        isDefault ? "border-primary/40 bg-primary/5" : "border-border/40 bg-background/60",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{tpl.name}</p>
          {isDefault && (
            <Badge variant="default" className="h-5 text-[10px] gap-0.5">
              <Star className="h-2.5 w-2.5" />
              {copy.defaultBadge}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" onClick={onPreview}>
          <Eye className="h-3 w-3 mr-1" />
          {copy.previewButton}
        </Button>
        {!isDefault && onMakeDefault && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-full text-xs"
            onClick={onMakeDefault}
            disabled={busy}
          >
            <Check className="h-3 w-3 mr-1" />
            {copy.makeDefaultButton}
          </Button>
        )}
        <Link
          href={`/dashboard/automacao/templates-wpp`}
          target="_blank"
          className="inline-flex items-center h-7 px-2 rounded-full text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </article>
  )
}

function TemplatePreviewDialog({
  preview,
  onClose,
}: {
  preview:
    | { type: "email"; tpl: EmailTemplate }
    | { type: "whatsapp"; tpl: WppTemplate }
    | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!preview} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{preview?.tpl.name}</DialogTitle>
          <DialogDescription>
            {preview?.type === "email" && preview.tpl.subject ? preview.tpl.subject : "Pré-visualização"}
          </DialogDescription>
        </DialogHeader>
        {preview?.type === "email" ? (
          <div
            className="prose prose-sm max-w-none border rounded-lg bg-background p-4"
            dangerouslySetInnerHTML={{ __html: preview.tpl.body_html ?? "" }}
          />
        ) : preview?.type === "whatsapp" ? (
          <pre className="text-xs bg-muted/30 rounded-lg p-4 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
            {JSON.stringify(preview.tpl.messages, null, 2)}
          </pre>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
