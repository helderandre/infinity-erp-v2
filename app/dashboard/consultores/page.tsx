'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ConsultantCard } from '@/components/consultants/consultant-card'
import { ConsultantFilters } from '@/components/consultants/consultant-filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  UserCircle,
  Plus,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import type { ConsultantWithProfile } from '@/types/consultant'

const PAGE_SIZE = 50

export default function ConsultoresPage() {
  return (
    <Suspense fallback={<ConsultoresPageSkeleton />}>
      <ConsultoresPageContent />
    </Suspense>
  )
}

function ConsultoresPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="rounded-lg border p-6">
            <div className="flex flex-col items-center space-y-3">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConsultoresPageContent() {
  const router = useRouter()

  const [consultants, setConsultants] = useState<ConsultantWithProfile[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Filters
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [role, setRole] = useState('all')
  const [page, setPage] = useState(0)

  const debouncedSearch = useDebounce(search, 300)

  const hasActiveFilters = debouncedSearch !== '' || status !== 'all' || role !== 'all'

  const loadConsultants = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status !== 'all') params.set('status', status)
      if (role !== 'all') params.set('role', role)
      params.set('per_page', String(PAGE_SIZE))
      params.set('page', String(page + 1))

      const res = await fetch(`/api/consultants?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar consultores')

      const data = await res.json()
      setConsultants(data.data || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Erro ao carregar consultores:', error)
      setConsultants([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, role, page])

  const loadRoles = useCallback(async () => {
    const CONSULTANT_ROLES = ['Consultor', 'Consultora Executiva', 'Team Leader']
    try {
      const res = await fetch('/api/libraries/roles')
      if (res.ok) {
        const data = await res.json()
        setRoles(
          (data || [])
            .filter((r: { name: string }) => CONSULTANT_ROLES.includes(r.name))
            .map((r: { id: string; name: string }) => ({
              id: r.id,
              name: r.name,
            }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    loadConsultants()
  }, [loadConsultants])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, status, role])

  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setRole('all')
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consultores</h1>
          <p className="text-muted-foreground">Gestão de consultores e equipas</p>
        </div>
        <Button onClick={() => router.push('/dashboard/consultores/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Consultor
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ConsultantFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            role={role}
            onRoleChange={setRole}
            roles={roles}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="rounded-lg border p-6">
                <div className="flex flex-col items-center space-y-3">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]" />
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telemóvel</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : consultants.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="Nenhum consultor encontrado"
          description={
            hasActiveFilters
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Comece por adicionar o primeiro consultor'
          }
          action={
            !hasActiveFilters
              ? {
                  label: 'Novo Consultor',
                  onClick: () => router.push('/dashboard/consultores/novo'),
                }
              : undefined
          }
        />
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {consultants.map((consultant) => (
              <ConsultantCard
                key={consultant.id}
                consultant={consultant}
                onClick={() => router.push(`/dashboard/consultores/${consultant.id}`)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} consultor{total !== 1 ? 'es' : ''} encontrado{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]" />
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telemóvel</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultants.map((consultant) => {
                  const profile = consultant.dev_consultant_profiles
                  const roleName = consultant.user_roles?.[0]?.roles?.name
                  return (
                    <TableRow
                      key={consultant.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/consultores/${consultant.id}`)}
                    >
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profile?.profile_photo_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(consultant.commercial_name)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{consultant.commercial_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {consultant.professional_email || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {profile?.phone_commercial || '—'}
                      </TableCell>
                      <TableCell>
                        {roleName ? (
                          <Badge variant="secondary" className="text-xs">
                            {roleName}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={consultant.is_active ? 'default' : 'outline'}
                          className={
                            consultant.is_active
                              ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-0'
                              : 'text-muted-foreground'
                          }
                        >
                          {consultant.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} consultor{total !== 1 ? 'es' : ''} encontrado{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
