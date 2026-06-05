'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import { CreditFilters } from '@/components/credit/credit-filters'
import { CreditPipeline } from '@/components/credit/credit-pipeline'
import { CreditList } from '@/components/credit/credit-list'
import { useCreditRequests } from '@/hooks/use-credit-requests'
import { Landmark, Plus } from 'lucide-react'

const PAGE_SIZE = 20

export default function CreditoPedidosPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [assignedTo, setAssignedTo] = useState('all')
  const [page, setPage] = useState(1)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [view, setView] = useState<'pipeline' | 'lista'>('pipeline')

  const { requests, total, isLoading } = useCreditRequests({
    search,
    status: status !== 'all' ? status : undefined,
    assignedTo: assignedTo !== 'all' ? assignedTo : undefined,
    page,
    perPage: PAGE_SIZE,
  })

  useEffect(() => {
    fetch('/api/consultants?status=active')
      .then(res => res.ok ? res.json() : { data: [] })
      .then(json => setConsultants(json.data || []))
      .catch(() => {})
  }, [])

  const handleClearFilters = () => {
    setSearch('')
    setStatus('all')
    setAssignedTo('all')
    setPage(1)
  }

  const hasActiveFilters = search !== '' || status !== 'all' || assignedTo !== 'all'

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos de Crédito</h1>
          <p className="text-muted-foreground">
            Pipeline e gestão de pedidos de crédito habitação
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/credito/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Pedido
        </Button>
      </div>

      <CreditFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={(v) => { setStatus(v); setPage(1) }}
        assignedTo={assignedTo}
        onAssignedToChange={(v) => { setAssignedTo(v); setPage(1) }}
        consultants={consultants}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as 'pipeline' | 'lista')}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          {isLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-60 shrink-0" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="Sem pedidos de crédito"
              description="Crie o primeiro pedido de crédito para começar."
              action={{
                label: 'Novo Pedido',
                onClick: () => router.push('/dashboard/credito/novo'),
              }}
            />
          ) : (
            <CreditPipeline
              requests={requests}
              onRequestClick={(id) => router.push(`/dashboard/credito/${id}`)}
            />
          )}
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="Sem pedidos de crédito"
              description="Crie o primeiro pedido de crédito para começar."
              action={{
                label: 'Novo Pedido',
                onClick: () => router.push('/dashboard/credito/novo'),
              }}
            />
          ) : (
            <CreditList
              requests={requests}
              total={total}
              page={page}
              perPage={PAGE_SIZE}
              onPageChange={setPage}
              onRequestClick={(id) => router.push(`/dashboard/credito/${id}`)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
