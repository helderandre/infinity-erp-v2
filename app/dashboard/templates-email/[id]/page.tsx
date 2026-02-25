'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEmailTemplate } from '@/hooks/use-email-template'
import { EmailEditorComponent } from '@/components/email-editor/email-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function EditarTemplateEmailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { template, isLoading, error } = useEmailTemplate(params.id)

  if (isLoading) {
    return (
      <div className="flex flex-col -m-4 md:-m-6 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] overflow-hidden">
        {/* Topbar skeleton */}
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-24" />
        </div>
        {/* Editor skeleton */}
        <div className="flex flex-1 overflow-hidden">
          <div className="w-60 border-r p-4 space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <div className="flex-1 p-8">
            <Skeleton className="mx-auto h-96 w-full max-w-[600px]" />
          </div>
          <div className="w-72 border-l p-4 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground">
          {error || 'Template não encontrado'}
        </p>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/templates-email')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    )
  }

  const editorState =
    template.editor_state != null
      ? typeof template.editor_state === 'string'
        ? template.editor_state
        : JSON.stringify(template.editor_state)
      : null

  return (
    <EmailEditorComponent
      initialData={editorState}
      templateId={template.id}
      initialName={template.name}
      initialSubject={template.subject}
      initialDescription={template.description || ''}
    />
  )
}
