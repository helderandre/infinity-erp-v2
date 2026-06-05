"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, MessageSquareText } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

import { WppTemplateCard } from "@/components/automations/wpp-template-card"
import { useWppTemplates } from "@/hooks/use-wpp-templates"
import { useUser } from "@/hooks/use-user"
import { useDebounce } from "@/hooks/use-debounce"
import type { WhatsAppTemplateCategory } from "@/lib/types/whatsapp-template"
import { TEMPLATE_CATEGORY_LABELS } from "@/lib/types/whatsapp-template"

type ScopeTab = "all" | "global" | "consultant"

const SCOPE_TABS: Array<{ value: ScopeTab; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "global", label: "Globais" },
  { value: "consultant", label: "Meus" },
]

export default function TemplatesWppPage() {
  const router = useRouter()
  const { user } = useUser()
  const [scope, setScope] = useState<ScopeTab>("all")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<WhatsAppTemplateCategory | "all">(
    "all"
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)

  const { templates, loading, deleteTemplate, duplicateTemplate } =
    useWppTemplates({
      search: debouncedSearch,
      category,
      scope,
    })

  const counts = useMemo(() => {
    const all = templates.length
    const global = templates.filter((t) => t.scope === "global").length
    const consultant = templates.filter(
      (t) => t.scope === "consultant" && (!user || t.scope_id === user.id),
    ).length
    return { all, global, consultant }
  }, [templates, user])

  async function handleDelete() {
    if (!deleteId) return
    try {
      await deleteTemplate(deleteId)
      toast.success("Template eliminado com sucesso")
    } catch {
      toast.error("Erro ao eliminar template")
    } finally {
      setDeleteId(null)
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateTemplate(id)
      toast.success("Template duplicado com sucesso")
    } catch {
      toast.error("Erro ao duplicar template")
    }
  }

  const total = templates.length

  return (
    <div className="space-y-5">
      {/* ═══ Hero header ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 sm:px-8 py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <MessageSquareText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Templates WhatsApp
              </h1>
              <p className="text-neutral-400 text-sm">
                {total} template{total !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                router.push("/dashboard/automacao/templates-wpp/editor")
              }
              className="inline-flex items-center gap-1.5 bg-white text-neutral-900 px-4 py-2 rounded-full text-xs font-semibold hover:bg-neutral-100 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Template</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Tabs (scope) ═══ */}
      <Tabs value={scope} onValueChange={(v) => setScope(v as ScopeTab)}>
        <TabsList>
          {SCOPE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {t.value === "all" && counts.all > 0 && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  ({counts.all})
                </span>
              )}
              {t.value === "global" && counts.global > 0 && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  ({counts.global})
                </span>
              )}
              {t.value === "consultant" && counts.consultant > 0 && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  ({counts.consultant})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ═══ Filters ═══ */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar templates..."
            className="pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) =>
            setCategory(v as WhatsAppTemplateCategory | "all")
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ═══ Grid ═══ */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquareText className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">
            Nenhum template encontrado
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {search || category !== "all" || scope !== "all"
              ? "Tente ajustar os filtros de pesquisa"
              : "Crie o seu primeiro template de mensagens WhatsApp"}
          </p>
          {!search && category === "all" && scope === "all" && (
            <Button
              onClick={() =>
                router.push("/dashboard/automacao/templates-wpp/editor")
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((template) => (
            <WppTemplateCard
              key={template.id}
              template={template}
              onEdit={() =>
                router.push(
                  `/dashboard/automacao/templates-wpp/editor?id=${template.id}`
                )
              }
              onDuplicate={() => handleDuplicate(template.id)}
              onDelete={() => setDeleteId(template.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este template? O template
              será desactivado e deixará de estar disponível para novos automatismos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
