'use client'

import { Send } from 'lucide-react'

/**
 * Stub page for the new "Referências" view — accessible via the chevron next
 * to Pipeline in the sidebar / mobile bottom-nav. Will eventually list the
 * referrals the consultor sent to other consultores; for now it's an empty
 * shell so the route resolves.
 */
export default function ReferenciasPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Send className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight">Referências</h1>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Vão aparecer aqui as referências que enviaste a outros consultores.
        Em desenvolvimento.
      </p>
    </div>
  )
}
