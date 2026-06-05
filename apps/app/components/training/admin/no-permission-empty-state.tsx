'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  backHref?: string
  backLabel?: string
}

export function NoPermissionEmptyState({
  backHref = '/dashboard/formacoes/gestao',
  backLabel = 'Voltar à Gestão de Formações',
}: Props) {
  return (
    <div className="rounded-xl border py-16 px-8 text-center flex flex-col items-center gap-4">
      <div className="h-12 w-12 rounded-full bg-amber-500/15 flex items-center justify-center">
        <ShieldAlert className="h-6 w-6 text-amber-600" />
      </div>
      <div>
        <h3 className="font-semibold">Sem permissão</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          Esta página é exclusiva para utilizadores com permissão <strong>training</strong>.
          Contacte um administrador se precisar de acesso.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  )
}
