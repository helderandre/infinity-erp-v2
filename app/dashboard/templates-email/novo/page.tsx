'use client'

import { EmailEditorComponent } from '@/components/email-editor/email-editor'

export default function NovoTemplateEmailPage() {
  return (
    <EmailEditorComponent
      initialData={null}
      templateId={null}
      initialName=""
      initialSubject=""
      initialDescription=""
    />
  )
}
