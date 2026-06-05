'use client'

import { AccountSetupForm } from '@/components/email/account-setup-form'

export default function EmailSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Profissional</h2>
        <p className="text-muted-foreground">
          Configure a sua conta de email RE/MAX para enviar e receber emails processuais directamente no ERP.
        </p>
      </div>

      <div className="max-w-2xl">
        <AccountSetupForm />
      </div>
    </div>
  )
}
