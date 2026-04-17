'use client'

import { useSearchParams } from 'next/navigation'
import { EmailEditorComponent } from '@/components/email-editor/email-editor'
import { normalizeCategory } from '@/lib/constants-template-categories'

export default function NovoTemplateEmailPage() {
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
