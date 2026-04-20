'use client'



import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { EmailEditorComponent } from '@/components/email-editor/email-editor'
import { normalizeCategory } from '@/lib/constants-template-categories'

function NovoTemplateEmailPageInner() {
  const searchParams = useSearchParams()
  const scope = searchParams.get('scope') as 'consultant' | 'global' | null
  const category = normalizeCategory(searchParams.get('category'))

  return (
    <EmailEditorComponent
      initialData={null}
      templateId={null}
      initialName=""
      initialSubject=""
      initialDescription=""
      initialCategory={category}
      initialScope={scope ?? undefined}
    />
  )
}

export default function NovoTemplateEmailPage() {
  return (
    <Suspense fallback={null}>
      <NovoTemplateEmailPageInner />
    </Suspense>
  )
}

