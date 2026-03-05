"use client"

import { useState } from "react"
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
import { useDebounce } from "@/hooks/use-debounce"
import type { WhatsAppTemplateCategory } from "@/lib/types/whatsapp-template"
import { TEMPLATE_CATEGORY_LABELS } from "@/lib/types/whatsapp-template"

export default function TemplatesWppPage() {
  const router = useRouter()
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
    })

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Templates WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Biblioteca de templates de mensagens reutilizáveis
          </p>
        </div>
        <Button
          onClick={() =>
            router.push("/dashboard/automacao/templates-wpp/editor")
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Filters */}
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

      {/* Grid */}
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
            {search || category !== "all"
              ? "Tente ajustar os filtros de pesquisa"
              : "Crie o seu primeiro template de mensagens WhatsApp"}
          </p>
          {!search && category === "all" && (
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
              será desactivado e deixará de estar disponível para novos fluxos.
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
