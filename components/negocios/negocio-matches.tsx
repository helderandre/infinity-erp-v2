'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Home, MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/constants'
import type { PropertyMatch } from '@/types/lead'

interface NegocioMatchesProps {
  negocioId: string
}

export function NegocioMatches({ negocioId }: NegocioMatchesProps) {
  const [matches, setMatches] = useState<PropertyMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadMatches() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/negocios/${negocioId}/matches`)
        if (res.ok) {
          const data = await res.json()
          setMatches(data.data || [])
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    }
    loadMatches()
  }, [negocioId])

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={Home}
        title="Nenhum imóvel correspondente"
        description="Não foram encontrados imóveis que correspondam aos critérios deste negócio"
      />
    )
  }

  const getPriceBadge = (flag: PropertyMatch['price_flag']) => {
    if (!flag) return <Badge className="bg-emerald-100 text-emerald-800">Dentro do orçamento</Badge>
    if (flag === 'yellow') return <Badge className="bg-yellow-100 text-yellow-800">0-10% acima</Badge>
    return <Badge className="bg-orange-100 text-orange-800">10-15% acima</Badge>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <a
          key={match.id}
          href={`/dashboard/imoveis/${match.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Card className="h-full cursor-pointer hover:bg-accent/50 transition-colors">
            {match.cover_url && (
              <div className="aspect-video overflow-hidden rounded-t-lg">
                <img
                  src={match.cover_url}
                  alt={match.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardContent className="space-y-2 pt-3">
              <h4 className="font-semibold text-sm line-clamp-1">{match.title}</h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {match.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {match.city}
                    {match.zone && `, ${match.zone}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {match.specs?.bedrooms && <span>{match.specs.bedrooms} quartos</span>}
                {match.specs?.area_util && <span>{match.specs.area_util} m²</span>}
                {match.property_type && <span>{match.property_type}</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {formatCurrency(match.listing_price)}
                </span>
                {getPriceBadge(match.price_flag)}
              </div>
            </CardContent>
          </Card>
        </a>
      ))}
    </div>
  )
}
