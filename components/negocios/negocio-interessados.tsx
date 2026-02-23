'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Users, Phone } from 'lucide-react'
import type { NegocioInteressado } from '@/types/lead'

interface NegocioInteressadosProps {
  negocioId: string
}

export function NegocioInteressados({ negocioId }: NegocioInteressadosProps) {
  const [interessados, setInteressados] = useState<NegocioInteressado[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/negocios/${negocioId}/interessados`)
        if (res.ok) {
          const data = await res.json()
          setInteressados(data.data || [])
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [negocioId])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (interessados.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum interessado encontrado"
        description="Não existem compradores potenciais registados no sistema"
      />
    )
  }

  return (
    <div className="space-y-3">
      {interessados.map((int) => (
        <Card key={int.negocioId}>
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-sm">{int.firstName}</p>
              <p className="text-xs text-muted-foreground">Consultor: {int.colleague}</p>
            </div>
            {int.phone && (
              <a
                href={`tel:${int.phone}`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-4 w-4" />
                {int.phone}
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
