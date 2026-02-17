'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PROCESS_STATUS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ProcessInstance } from '@/types/process'

export default function ProcessosPage() {
  const router = useRouter()
  const [processes, setProcesses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadProcesses()
  }, [])

  const loadProcesses = async () => {
    setIsLoading(true)
    try {
      // Por agora, simulamos dados
      // TODO: implementar endpoint GET /api/processes
      setTimeout(() => {
        setProcesses([])
        setIsLoading(false)
      }, 500)
    } catch (error) {
      console.error('Erro ao carregar processos:', error)
      setIsLoading(false)
    }
  }

  const filteredProcesses = processes.filter((p) =>
    p.external_ref?.toLowerCase().includes(search.toLowerCase()) ||
    p.property?.title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processos</h1>
          <p className="text-muted-foreground">
            Gestão de processos de angariação
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/angariacao')}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Angariação
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por referência ou imóvel..."
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
      ) : filteredProcesses.length === 0 ? (
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
          {filteredProcesses.map((proc) => (
            <Link key={proc.id} href={`/dashboard/processos/${proc.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm">{proc.external_ref}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {proc.property?.title}
                      </p>
                    </div>
                    <StatusBadge status={proc.current_status} type="process" showDot={false} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
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
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Criado: {formatDate(proc.created_at)}</span>
                    {proc.property?.listing_price && (
                      <span>{formatCurrency(proc.property.listing_price)}</span>
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
