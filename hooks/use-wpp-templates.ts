"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
  WhatsAppTemplateMessage,
} from "@/lib/types/whatsapp-template"

interface UseWppTemplatesOptions {
  search?: string
  category?: WhatsAppTemplateCategory | "all"
  autoFetch?: boolean
}

export function useWppTemplates(options: UseWppTemplatesOptions = {}) {
  const { search, category, autoFetch = true } = options
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (category && category !== "all") params.set("category", category)

      const res = await fetch(`/api/automacao/templates-wpp?${params}`)
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || "Erro ao listar templates")

      setTemplates(json.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => {
    if (autoFetch) fetchTemplates()
  }, [fetchTemplates, autoFetch])

  const getTemplate = useCallback(async (id: string) => {
    const res = await fetch(`/api/automacao/templates-wpp/${id}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || "Erro ao obter template")
    return json.template as WhatsAppTemplate
  }, [])

  const createTemplate = useCallback(
    async (data: {
      name: string
      description?: string
      messages: WhatsAppTemplateMessage[]
      category?: WhatsAppTemplateCategory
      tags?: string[]
    }) => {
      const res = await fetch("/api/automacao/templates-wpp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao criar template")
      await fetchTemplates()
      return json.template as WhatsAppTemplate
    },
    [fetchTemplates]
  )

  const updateTemplate = useCallback(
    async (
      id: string,
      data: Partial<{
        name: string
        description: string
        messages: WhatsAppTemplateMessage[]
        category: WhatsAppTemplateCategory
        tags: string[]
        is_active: boolean
      }>
    ) => {
      const res = await fetch(`/api/automacao/templates-wpp/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao actualizar template")
      await fetchTemplates()
      return json.template as WhatsAppTemplate
    },
    [fetchTemplates]
  )

  const deleteTemplate = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/automacao/templates-wpp/${id}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao eliminar template")
      await fetchTemplates()
    },
    [fetchTemplates]
  )

  const duplicateTemplate = useCallback(
    async (id: string) => {
      const template = await getTemplate(id)
      return createTemplate({
        name: `Cópia de ${template.name}`,
        description: template.description,
        messages: template.messages,
        category: template.category,
        tags: [],
      })
    },
    [getTemplate, createTemplate]
  )

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  }
}
