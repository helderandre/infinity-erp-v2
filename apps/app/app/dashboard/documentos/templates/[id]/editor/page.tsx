'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { PdfFieldEditor } from '@/components/pdf-templates/pdf-field-editor'
import type { PdfTemplateField } from '@/types/pdf-overlay'

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [template, setTemplate] = useState<any>(null)
  const [fields, setFields] = useState<PdfTemplateField[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch template info
      const tplRes = await fetch(`/api/libraries/docs/${id}`)
      if (!tplRes.ok) throw new Error('Template nao encontrado')
      const tplData = await tplRes.json()
      setTemplate(tplData)

      // Fetch existing fields
      const fieldsRes = await fetch(`/api/pdf-templates/${id}/fields`)
      if (fieldsRes.ok) {
        const { fields: f } = await fieldsRes.json()
        setFields(f || [])
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao carregar template')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    )
  }

  if (!template?.file_url) {
    return (
      <div className="space-y-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Este template nao tem ficheiro PDF associado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <div>
          <h1 className="text-lg font-bold">Editor de Campos</h1>
          <p className="text-xs text-muted-foreground">{template.name}</p>
        </div>
      </div>

      <PdfFieldEditor
        templateId={id}
        fileUrl={template.file_url}
        templateName={template.name}
        initialFields={fields}
        onSave={(saved) => setFields(saved as any)}
      />
    </div>
  )
}
