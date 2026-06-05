"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Calendar, Check, ChevronDown, Copy, Flag, Gift, Loader2, Mail, MessageSquareText, MoreHorizontal, Plus, Star, Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { useCustomEvents } from "@/hooks/use-custom-events"

const FIXED_AUTOMATIONS = [
  { key: "aniversario_contacto", label: "Aniversário do Contacto", isFixed: true },
  { key: "natal", label: "Natal", isFixed: true },
  { key: "ano_novo", label: "Ano Novo", isFixed: true },
] as const

interface Template {
  id: string
  name: string
  subject?: string
  description?: string
  category: string | null
  scope: string
  scope_id: string | null
  is_active: boolean
  is_system: boolean
  created_by?: string | null
}

interface Props {
  userId: string
}

interface DefaultEntry { category: string; channel: string; template_id: string }

export function MyTemplatesTab({ userId }: Props) {
  const [emailTpls, setEmailTpls] = useState<Template[]>([])
  const [wppTpls, setWppTpls] = useState<Template[]>([])
  const [defaults, setDefaults] = useState<DefaultEntry[]>([])
  const [usedEmailIds, setUsedEmailIds] = useState<Set<string>>(new Set())
  const [usedWppIds, setUsedWppIds] = useState<Set<string>>(new Set())
  const [isLoading, setLoading] = useState(true)
  const { events: customEvents } = useCustomEvents()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [emailRes, wppRes, defaultsRes, settingsRes] = await Promise.all([
        fetch("/api/automacao/email-templates?active=true"),
        fetch("/api/automacao/templates-wpp?active=true"),
        fetch("/api/automacao/template-defaults"),
        fetch("/api/automacao/lead-template-usage"),
      ])
      const emailData = emailRes.ok ? await emailRes.json() : []
      const wppData = wppRes.ok ? await wppRes.json() : []
      const defaultsData = defaultsRes.ok ? await defaultsRes.json() : {}
      const usageData = settingsRes.ok ? await settingsRes.json() : {}
      setEmailTpls(Array.isArray(emailData) ? emailData : emailData.templates ?? [])
      setWppTpls(Array.isArray(wppData) ? wppData : wppData.templates ?? [])
      setDefaults(defaultsData.defaults ?? [])
      setUsedEmailIds(new Set(usageData.email_template_ids ?? []))
      setUsedWppIds(new Set(usageData.wpp_template_ids ?? []))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  function getTemplatesForCategory(channel: "email" | "whatsapp", category: string): Template[] {
    const source = channel === "email" ? emailTpls : wppTpls
    return source.filter((t) => t.category === category)
  }

  function isDefaultTpl(channel: "email" | "whatsapp", category: string, tpl: Template): boolean {
    // 1. Check explicit default from consultant_template_defaults
    const explicit = defaults.find((d) => d.category === category && d.channel === channel)
    if (explicit) return tpl.id === explicit.template_id
    // 2. Fallback: consultant's own template, then system
    const all = getTemplatesForCategory(channel, category)
    const own = all.find((t) => t.scope === "consultant" && t.scope_id === userId)
    if (own) return tpl.id === own.id
    const system = all.find((t) => t.is_system)
    if (system) return tpl.id === system.id
    return all[0]?.id === tpl.id
  }

  const automations = [
    ...FIXED_AUTOMATIONS.map((a) => ({ key: a.key, label: a.label, isFixed: true })),
    ...customEvents.map((e) => ({ key: e.id, label: e.name, isFixed: false })),
  ]

  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Templates por Automatismo</h3>
        <p className="text-xs text-muted-foreground">
          Organize os templates de Email e WhatsApp. O template com ★ é o padrão.
        </p>
      </div>

      {automations.map((auto) => {
        const emailList = getTemplatesForCategory("email", auto.key)
        const wppList = getTemplatesForCategory("whatsapp", auto.key)
        const totalTpls = emailList.length + wppList.length

        return (
          <Collapsible key={auto.key} defaultOpen={totalTpls > 0} className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 hover:bg-muted/50 transition-colors group">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md",
                auto.isFixed ? "bg-primary/10 text-primary" : "bg-violet-100 text-violet-700",
              )}>
                {auto.isFixed ? <Calendar className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
              </div>
              <span className="text-sm font-semibold flex-1 text-left">{auto.label}</span>
              <Badge variant="secondary" className="text-[10px]">{totalTpls} template{totalTpls !== 1 ? "s" : ""}</Badge>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>

            <CollapsibleContent className="border-t px-4 py-3 space-y-4 bg-muted/20">
              {/* Email section */}
              <ChannelSection
                channel="email"
                category={auto.key}
                templates={emailList}
                isDefault={(tpl) => isDefaultTpl("email", auto.key, tpl)}
                isInUse={(tpl) => usedEmailIds.has(tpl.id)}
                userId={userId}
                createHref={`/dashboard/templates-email/novo?scope=consultant&category=${auto.key}`}
                editHrefFn={(id) => `/dashboard/templates-email/${id}`}
                onRefresh={fetchAll}
              />

              {/* WhatsApp section */}
              <ChannelSection
                channel="whatsapp"
                category={auto.key}
                templates={wppList}
                isDefault={(tpl) => isDefaultTpl("whatsapp", auto.key, tpl)}
                isInUse={(tpl) => usedWppIds.has(tpl.id)}
                userId={userId}
                createHref={`/dashboard/automacao/templates-wpp/editor?scope=consultant&category=${auto.key}`}
                editHrefFn={(id) => `/dashboard/automacao/templates-wpp/editor?id=${id}`}
                onRefresh={fetchAll}
              />
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}

// ─── Channel Section with grid cards ─────────────────────────────────

function ChannelSection({
  channel,
  category,
  templates,
  isDefault,
  isInUse,
  userId,
  createHref,
  editHrefFn,
  onRefresh,
}: {
  channel: "email" | "whatsapp"
  category: string
  templates: Template[]
  isDefault: (tpl: Template) => boolean
  isInUse: (tpl: Template) => boolean
  userId: string
  createHref: string
  editHrefFn: (id: string) => string
  onRefresh: () => void
}) {
  const Icon = channel === "email" ? Mail : MessageSquareText
  const channelLabel = channel === "email" ? "Email" : "WhatsApp"
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  async function onSetDefault(tpl: Template) {
    if (isDefault(tpl)) return
    try {
      const res = await fetch("/api/automacao/template-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          channel,
          template_id: tpl.id,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`"${tpl.name}" definido como padrão`)
      onRefresh()
    } catch {
      toast.error("Erro ao definir como padrão")
    }
  }

  async function handleDuplicate(tpl: Template) {
    setDuplicatingId(tpl.id)
    try {
      // Fetch full template data from detail endpoint
      const detailEndpoint = channel === "email"
        ? `/api/libraries/emails/${tpl.id}`
        : `/api/automacao/templates-wpp/${tpl.id}`
      const detailRes = await fetch(detailEndpoint)
      if (!detailRes.ok) throw new Error("Erro ao carregar template")
      const original = await detailRes.json()

      // Create duplicate with consultant scope
      const createEndpoint = channel === "email"
        ? "/api/libraries/emails"
        : "/api/automacao/templates-wpp"
      const res = await fetch(createEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${tpl.name} (cópia)`,
          category: tpl.category,
          scope: "consultant",
          description: original.description ?? tpl.description ?? null,
          ...(channel === "email" ? {
            subject: original.subject ?? "Sem assunto",
            body_html: original.body_html ?? "",
            editor_state: original.editor_state ?? null,
          } : {
            messages: original.messages ?? [],
          }),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Erro ao criar cópia")
      }
      toast.success("Template duplicado com sucesso")
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao duplicar template")
    } finally {
      setDuplicatingId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const endpoint = channel === "email"
        ? `/api/libraries/emails/${deleteTarget.id}`
        : `/api/automacao/templates-wpp/${deleteTarget.id}`
      const res = await fetch(endpoint, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Template eliminado")
      onRefresh()
    } catch {
      toast.error("Erro ao eliminar template")
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  // Determine which templates can be deleted:
  // Cannot delete: system templates, or templates that are the default (in use)
  // CAN delete: consultant's own templates (scope=consultant + scope_id=userId) that are not the default
  function canDelete(tpl: Template): boolean {
    if (tpl.is_system) return false
    if (isDefault(tpl)) return false
    if (isInUse(tpl)) return false
    // Own consultant templates can be deleted
    if (tpl.scope === "consultant" && tpl.scope_id === userId) return true
    // Global templates created by this user (legacy) can also be deleted
    if (tpl.created_by === userId && !tpl.is_system) return true
    return false
  }

  return (
    <div className="space-y-2 pl-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", channel === "whatsapp" ? "text-emerald-600" : "text-muted-foreground")} />
        <span className={cn(
          "text-xs font-medium uppercase tracking-wider",
          channel === "whatsapp" ? "text-emerald-600" : "text-muted-foreground",
        )}>
          {channelLabel}
        </span>
        <span className="text-[10px] text-muted-foreground">({templates.length})</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {templates.map((tpl) => {
          const isDef = isDefault(tpl)
          const isOwn = (tpl.scope === "consultant" && tpl.scope_id === userId) || (tpl.created_by === userId && !tpl.is_system)
          const isGlobal = tpl.scope === "global" && !isOwn
          const isSystem = tpl.is_system
          const deletable = canDelete(tpl)

          return (
            <div
              key={tpl.id}
              className={cn(
                "group relative flex flex-col rounded-lg border p-3 transition-all hover:shadow-md hover:border-primary/30",
                isDef && "ring-1 ring-primary/40 bg-primary/5",
              )}
            >
              {/* Top-right: star (default toggle) + menu */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
                {/* Star — always visible if default, on hover if not */}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetDefault(tpl) }}
                  className={cn(
                    "h-6 w-6 flex items-center justify-center rounded transition-all",
                    isDef
                      ? "text-primary"
                      : "text-muted-foreground/20 opacity-0 group-hover:opacity-100 hover:text-primary/60",
                  )}
                  title={isDef ? "Template padrão" : "Definir como padrão"}
                >
                  <Star className={cn("h-3.5 w-3.5", isDef && "fill-primary")} />
                </button>
                {/* Actions menu */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {!isSystem && (
                        <DropdownMenuItem asChild>
                          <Link href={editHrefFn(tpl.id)}>Editar</Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDuplicate(tpl)}
                        disabled={duplicatingId === tpl.id}
                      >
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        {duplicatingId === tpl.id ? "A duplicar..." : "Duplicar"}
                      </DropdownMenuItem>
                      {deletable && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(tpl)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Clickable area → edit */}
              <Link href={editHrefFn(tpl.id)} className="flex flex-col flex-1">
                <p className="text-xs font-medium truncate pr-14">{tpl.name}</p>
                {tpl.description && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{tpl.description}</p>
                )}

                <div className="flex flex-wrap gap-1 mt-auto pt-2">
                  {isDef && (
                    <Badge variant="default" className="text-[8px] h-4 px-1 gap-0.5">
                      <Check className="h-2 w-2" /> Padrão
                    </Badge>
                  )}
                  {isOwn && !isDef && (
                    <Badge variant="outline" className="text-[8px] h-4 px-1">Meu</Badge>
                  )}
                  {isSystem && (
                    <Badge variant="secondary" className="text-[8px] h-4 px-1">Sistema</Badge>
                  )}
                  {isGlobal && !isSystem && (
                    <Badge variant="secondary" className="text-[8px] h-4 px-1">Global</Badge>
                  )}
                  {!isDef && isInUse(tpl) && (
                    <Badge variant="outline" className="text-[8px] h-4 px-1 gap-0.5 text-amber-600 border-amber-300">
                      <Flag className="h-2 w-2" /> Em uso
                    </Badge>
                  )}
                </div>
              </Link>
            </div>
          )
        })}

        {/* Create new card */}
        <Link
          href={createHref}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/30 p-3 min-h-[80px] transition-all hover:border-primary/50 hover:bg-primary/5"
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium">Novo</span>
        </Link>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar o template &quot;{deleteTarget?.name}&quot;? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "A eliminar..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
