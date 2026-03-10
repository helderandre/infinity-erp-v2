'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OwnerForm } from '@/components/owners/owner-form'
import {
  UserCircle,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Building2,
  X,
  Home,
} from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate, PERSON_TYPES } from '@/lib/constants'
import { toast } from 'sonner'
import type { OwnerListItem } from '@/types/owner'

const PAGE_SIZE = 20

export default function ProprietariosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PageContent />
    </Suspense>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 7 }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function PageContent() {
  const router = useRouter()

  const [owners, setOwners] = useState<OwnerListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)

  // Filtros
  const [search, setSearch] = useState('')
  const [personType, setPersonType] = useState('all')
  const [page, setPage] = useState(0)

  const debouncedSearch = useDebounce(search, 300)

  const hasActiveFilters = debouncedSearch !== '' || personType !== 'all'

  const loadOwners = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (personType !== 'all') params.set('person_type', personType)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(page * PAGE_SIZE))

      const res = await fetch(`/api/owners?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar proprietários')

      const data = await res.json()
      setOwners(data.data || [])
      setTotal(data.total || 0)
    } catch {
      setOwners([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, personType, page])

  useEffect(() => {
    loadOwners()
  }, [loadOwners])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, personType])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/owners/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao eliminar')
      }
      toast.success('Proprietário eliminado com sucesso')
      loadOwners()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao eliminar proprietário'
      )
    } finally {
      setDeleteId(null)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setPersonType('all')
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proprietários</h1>
          <p className="text-muted-foreground">
            Gestão de proprietários de imóveis
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Proprietário
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, NIF ou email..."
            className="pl-9"
          />
        </div>
        <Select value={personType} onValueChange={setPersonType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de pessoa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(PERSON_TYPES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Imóveis</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : owners.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="Nenhum proprietário encontrado"
          description={
            hasActiveFilters
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Comece por criar o seu primeiro proprietário'
          }
          action={
            !hasActiveFilters
              ? {
                  label: 'Novo Proprietário',
                  onClick: () => setShowNewDialog(true),
                }
              : undefined
          }
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Imóveis</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((owner) => (
                  <TableRow
                    key={owner.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/proprietarios/${owner.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {owner.person_type === 'coletiva' ? (
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        {owner.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {PERSON_TYPES[owner.person_type as keyof typeof PERSON_TYPES] ||
                          owner.person_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {owner.nif || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {owner.email || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {owner.phone || '—'}
                    </TableCell>
                    <TableCell>
                      {owner.properties_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Home className="h-3.5 w-3.5 text-muted-foreground" />
                          {owner.properties_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(owner.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(
                                `/dashboard/proprietarios/${owner.id}`
                              )
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Ver / Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteId(owner.id)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} proprietário{total !== 1 ? 's' : ''} encontrado
                {total !== 1 ? 's' : ''}
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

      {/* Dialog Novo Proprietário */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Proprietário</DialogTitle>
          </DialogHeader>
          <OwnerForm
            onSuccess={(owner) => {
              setShowNewDialog(false)
              router.push(`/dashboard/proprietarios/${owner.id}`)
            }}
            onCancel={() => setShowNewDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* AlertDialog Eliminar */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proprietário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este proprietário? Esta
              acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
