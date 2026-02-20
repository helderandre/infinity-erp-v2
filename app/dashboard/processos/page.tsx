'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Plus, Search, Building2, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

export default function ProcessosPage() {
  const router = useRouter()
  const [processes, setProcesses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const loadProcesses = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/processes?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar processos')

      const data = await res.json()
      setProcesses(data)
    } catch (error) {
      console.error('Erro ao carregar processos:', error)
      setProcesses([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    loadProcesses()
  }, [loadProcesses])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processos</h1>
          <p className="text-muted-foreground">
            Gestão de processos de angariação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard/processos/templates')}>
            <FileText className="mr-2 h-4 w-4" />
            Gerir Templates
          </Button>
          <Button onClick={() => router.push('/dashboard/angariacao')}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Angariação
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por referência, imóvel ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : processes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum processo encontrado"
          description={
            search
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Crie a sua primeira angariação para começar'
          }
          action={
            !search
              ? {
                  label: 'Nova Angariação',
                  onClick: () => router.push('/dashboard/angariacao'),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {processes.map((proc) => (
            <Link key={proc.id} href={`/dashboard/processos/${proc.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm">
                        {proc.external_ref || 'Sem referência'}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {proc.dev_properties?.title || 'Imóvel sem título'}
                      </p>
                    </div>
                    <StatusBadge status={proc.current_status} type="process" showDot={false} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Info do imóvel */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {proc.dev_properties?.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {proc.dev_properties.city}
                      </span>
                    )}
                    {proc.dev_properties?.property_type && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {proc.dev_properties.property_type}
                      </span>
                    )}
                  </div>

                  {/* Barra de progresso */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{proc.percent_complete}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${proc.percent_complete}%` }}
                    />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {proc.started_at
                        ? formatDate(proc.started_at)
                        : proc.updated_at
                          ? formatDate(proc.updated_at)
                          : '—'}
                    </span>
                    {proc.dev_properties?.listing_price && (
                      <span className="font-medium text-foreground">
                        {formatCurrency(Number(proc.dev_properties.listing_price))}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
