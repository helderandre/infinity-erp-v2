'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentTemplateEditor } from '@/components/documents/document-template-editor'
import type { DocumentTemplatePayload } from '@/components/documents/document-template-editor'
import { PdfFieldMapper } from '@/components/pdf-templates/pdf-field-mapper'

interface TemplateData {
  id: string
  name: string
  description: string | null
  content_html: string | null
  doc_type_id: string | null
  template_type: string
  file_url: string | null
  letterhead_url: string | null
  letterhead_file_name: string | null
  letterhead_file_type: string | null
}

export default function EditarTemplateDocumentoPage() {
  const params = useParams<{ id: string }>()
  const [template, setTemplate] = useState<TemplateData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    fetch(`/api/libraries/docs/${params.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Template não encontrado')
        return res.json()
      })
      .then((data) => {
        if (!isMounted) return
        setTemplate(data)
        setError(null)
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar template')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-2 shrink-0">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-60 border-r p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <div className="flex-1 p-8">
            <Skeleton className="mx-auto h-96 w-full max-w-[800px]" />
          </div>
          <div className="w-60 border-l p-4 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !template) {
    return <p className="p-4 text-muted-foreground">{error || 'Template não encontrado'}</p>
  }

  // PDF template → render PdfFieldMapper (use proxy URL to avoid CORS)
  if (template.template_type === 'pdf' && template.file_url) {
    return (
      <PdfFieldMapper
        templateId={template.id}
        templateName={template.name}
        fileUrl={`/api/libraries/docs/${template.id}/pdf`}
      />
    )
  }

  // HTML template → render DocumentTemplateEditor (existing)
  const htmlPayload: DocumentTemplatePayload = {
    id: template.id,
    name: template.name,
    description: template.description,
    content_html: template.content_html || '',
    doc_type_id: template.doc_type_id,
    letterhead_url: template.letterhead_url,
    letterhead_file_name: template.letterhead_file_name,
    letterhead_file_type: template.letterhead_file_type,
  }

  return <DocumentTemplateEditor templateId={template.id} initialTemplate={htmlPayload} />
}
