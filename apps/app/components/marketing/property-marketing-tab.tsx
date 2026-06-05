'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MarketingOrderItem, MarketingRequest } from '@/types/marketing'
import { MARKETING_CATEGORIES, formatCurrency } from '@/lib/constants'
import { UseItemDialog } from './use-item-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import {
  ShoppingBag, Play, Calendar, Clock, CheckCircle2, Loader2, ExternalLink
} from 'lucide-react'

const REQUEST_STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  scheduled: { label: 'Agendado', variant: 'default' },
  in_progress: { label: 'Em Curso', variant: 'default' },
  completed: { label: 'Concluído', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
}

interface PropertyMarketingTabProps {
  propertyId: string
  propertyData?: {
    address_street?: string | null
    postal_code?: string | null
    city?: string | null
    zone?: string | null
    property_type?: string | null
  } | null
}

export function PropertyMarketingTab({ propertyId, propertyData }: PropertyMarketingTabProps) {
  const [products, setProducts] = useState<MarketingOrderItem[]>([])
  const [requests, setRequests] = useState<MarketingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [useItem, setUseItem] = useState<MarketingOrderItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [productsRes, requestsRes] = await Promise.all([
        fetch('/api/marketing/my-products'),
        fetch(`/api/marketing/requests?property_id=${propertyId}`),
      ])
      const productsData = await productsRes.json()
      const requestsData = await requestsRes.json()
      setProducts(Array.isArray(productsData) ? productsData.filter((p: any) => p.status === 'available') : [])
      setRequests(Array.isArray(requestsData) ? requestsData : [])
    } catch {
      setProducts([])
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Existing requests for this property */}
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Pedidos de Marketing para este Imóvel ({requests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.map((req) => {
              const statusInfo = REQUEST_STATUS_LABELS[req.status] || REQUEST_STATUS_LABELS.pending
              return (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{req.order_item?.name || 'Serviço'}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {req.preferred_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {req.confirmed_date || req.preferred_date}
                        </span>
                      )}
                      {req.confirmed_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {req.confirmed_time}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Available products to use */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Produtos Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                Não tem produtos disponíveis para utilizar.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/marketing">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ir à Loja
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Seleccione um produto comprado para utilizar neste imóvel. Os dados do imóvel serão preenchidos automaticamente.
              </p>
              {products.map((item) => {
                const category = item.catalog_item?.category
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm">{item.name}</p>
                      <div className="flex items-center gap-2">
                        {category && (
                          <Badge variant="outline" className="text-[10px]">
                            {MARKETING_CATEGORIES[category as keyof typeof MARKETING_CATEGORIES]}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{formatCurrency(item.price)}</span>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setUseItem(item)}>
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                      Utilizar
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Use Item Dialog — pre-filled with property data */}
      <UseItemDialog
        open={!!useItem}
        onOpenChange={(open) => { if (!open) setUseItem(null) }}
        orderItem={useItem}
        propertyId={propertyId}
        propertyData={propertyData}
        onUsed={() => {
          setUseItem(null)
          fetchData()
        }}
      />
    </div>
  )
}
