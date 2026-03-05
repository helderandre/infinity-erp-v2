"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WppTemplateBuilder } from "@/components/automations/wpp-template-builder"
import { useWppTemplates } from "@/hooks/use-wpp-templates"
import type {
  WhatsAppTemplateMessage,
  WhatsAppTemplateCategory,
} from "@/lib/types/whatsapp-template"

function TemplateEditorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get("id")

  const { getTemplate, createTemplate, updateTemplate } = useWppTemplates({
    autoFetch: false,
  })

  const [loading, setLoading] = useState(!!templateId)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<WhatsAppTemplateCategory>("outro")
  const [messages, setMessages] = useState<WhatsAppTemplateMessage[]>([])
  const [tags, setTags] = useState<string[]>([])

  // Load existing template
  useEffect(() => {
    if (!templateId) return

    let cancelled = false
    async function load() {
      try {
        const template = await getTemplate(templateId!)
        if (cancelled) return
        setName(template.name)
        setDescription(template.description || "")
        setCategory(template.category)
        setMessages(template.messages || [])
        setTags(template.tags || [])
      } catch {
        toast.error("Erro ao carregar template")
        router.push("/dashboard/automacao/templates-wpp")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [templateId, getTemplate, router])

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("O nome do template é obrigatório")
      return
    }
    if (messages.length === 0) {
      toast.error("Adicione pelo menos uma mensagem")
      return
    }

    setSaving(true)
    try {
      if (templateId) {
        await updateTemplate(templateId, {
          name,
          description,
          category,
          messages,
          tags,
        })
        toast.success("Template actualizado com sucesso")
      } else {
        const created = await createTemplate({
          name,
          description,
          messages,
          category,
          tags,
        })
        toast.success("Template criado com sucesso")
        router.push(
          `/dashboard/automacao/templates-wpp/editor?id=${created.id}`
        )
      }
    } catch {
      toast.error("Erro ao guardar template")
    } finally {
      setSaving(false)
    }
  }, [
    name,
    description,
    category,
    messages,
    tags,
    templateId,
    createTemplate,
    updateTemplate,
    router,
  ])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-[480px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/automacao/templates-wpp")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {templateId ? "Editar Template" : "Novo Template"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {templateId
                ? "Modificar template de mensagens WhatsApp"
                : "Criar novo template de mensagens WhatsApp"}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Guardar
        </Button>
      </div>

      {/* Builder */}
      <WppTemplateBuilder
        name={name}
        description={description}
        category={category}
        messages={messages}
        tags={tags}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onCategoryChange={setCategory}
        onMessagesChange={setMessages}
        onTagsChange={setTags}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}

export default function TemplateEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      }
    >
      <TemplateEditorContent />
    </Suspense>
  )
}
