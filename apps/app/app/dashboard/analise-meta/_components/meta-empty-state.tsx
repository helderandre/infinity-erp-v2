import Link from 'next/link'
import { Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function MetaEmptyState({
  entityLabel,
  hint,
}: {
  entityLabel: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Inbox className="text-muted-foreground h-10 w-10" />
        <div>
          <p className="font-medium">Ainda não há {entityLabel}.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {hint ??
              'Os dados aparecem aqui assim que o meta-api envia eventos para o ERP.'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/integracoes/meta">Verificar integração</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
