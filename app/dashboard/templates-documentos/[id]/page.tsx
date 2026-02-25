'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentTemplateEditor } from '@/components/documents/document-template-editor'
import type { DocumentTemplatePayload } from '@/components/documents/document-template-editor'

export default function EditarTemplateDocumentoPage() {
  const params = useParams<{ id: string }>()
  const [template, setTemplate] = useState<DocumentTemplatePayload | null>(null)
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
        setTemplate({
          id: data.id,
          name: data.name,
          description: data.description,
          content_html: data.content_html,
          doc_type_id: data.doc_type_id,
          letterhead_url: data.letterhead_url,
          letterhead_file_name: data.letterhead_file_name,
          letterhead_file_type: data.letterhead_file_type,
        })
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
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (error || !template) {
    return <p className="text-muted-foreground">{error || 'Template não encontrado'}</p>
  }

  return <DocumentTemplateEditor templateId={template.id || null} initialTemplate={template} />
}
