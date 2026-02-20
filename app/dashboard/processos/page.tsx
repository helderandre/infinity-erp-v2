'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Plus, Search, Building2, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BUSINESS_TYPES, PROPERTY_TYPES } from '@/lib/constants'
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
              <Card className="h-full cursor-pointer transition-colors hover:bg-accent/50 hover:border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        {proc.external_ref || 'Sem referência'}
                      </p>
                      <h3 className="text-base font-bold text-foreground tracking-tight line-clamp-1">
                        {proc.dev_properties?.title || 'Imóvel sem título'}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {proc.dev_properties?.business_type
                          ? (BUSINESS_TYPES as Record<string, string>)[proc.dev_properties.business_type] || proc.dev_properties.business_type
                          : proc.tpl_processes?.name || 'Sem template'}
                      </p>
                    </div>
                    <StatusBadge status={proc.current_status} type="process" showDot={false} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Linha de metadados */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {proc.dev_properties?.property_type && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {(PROPERTY_TYPES as Record<string, string>)[proc.dev_properties.property_type] || proc.dev_properties.property_type}
                      </span>
                    )}
                    {proc.dev_properties?.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {proc.dev_properties.city}
                      </span>
                    )}
                    {proc.requested_by_user?.commercial_name && (
                      <span className="ml-auto flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={proc.requested_by_user?.avatar_url} />
                          <AvatarFallback className="text-[9px]">
                            {proc.requested_by_user.commercial_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[120px]">
                          {proc.requested_by_user.commercial_name}
                        </span>
                      </span>
                    )}
                  </div>

                  <Separator />

                  {/* Barra de progresso */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Progresso</span>
                      {proc.percent_complete === 0 ? (
                        <span className="text-muted-foreground">Não iniciado</span>
                      ) : (
                        <span className="text-foreground font-semibold">{proc.percent_complete}%</span>
                      )}
                    </div>
                    <div className="h-[3px] rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${proc.percent_complete === 100 ? 'bg-emerald-500' : 'bg-foreground'}`}
                        style={{ width: `${proc.percent_complete}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {proc.started_at
                        ? formatDate(proc.started_at)
                        : proc.updated_at
                          ? formatDate(proc.updated_at)
                          : '—'}
                    </span>
                    {proc.dev_properties?.listing_price ? (
                      <span className="text-sm font-bold text-foreground tracking-tight">
                        {formatCurrency(Number(proc.dev_properties.listing_price))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Preço não definido</span>
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
