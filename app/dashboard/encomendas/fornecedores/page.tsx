'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { SupplierFormDialog } from '@/components/encomendas/supplier-form-dialog'
import { useEncomendaSuppliers } from '@/hooks/use-encomenda-suppliers'
import { toast } from 'sonner'
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
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Truck, MoreHorizontal, Pencil, Ban } from 'lucide-react'
import type { Supplier } from '@/types/encomenda'

export default function FornecedoresPage() {
  const [search, setSearch] = useState('')
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)

  const { suppliers, loading, setFilters, createSupplier, updateSupplier, deleteSupplier, refetch } =
    useEncomendaSuppliers()

  const handleFormSubmit = async (data: Partial<Supplier>) => {
    try {
      if (editSupplier) {
        await updateSupplier(editSupplier.id, data)
        toast.success('Fornecedor actualizado com sucesso')
      } else {
        await createSupplier(data)
        toast.success('Fornecedor criado com sucesso')
      }
      setShowFormDialog(false)
      setEditSupplier(null)
    } catch {
      toast.error(editSupplier ? 'Erro ao actualizar fornecedor' : 'Erro ao criar fornecedor')
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateId) return
    try {
      await deleteSupplier(deactivateId)
      toast.success('Fornecedor desativado com sucesso')
    } catch {
      toast.error('Erro ao desativar fornecedor')
    } finally {
      setDeactivateId(null)
    }
  }

  const handleEdit = (supplier: Supplier) => {
    setEditSupplier(supplier)
    setShowFormDialog(true)
  }

  const handleNewClick = () => {
    setEditSupplier(null)
    setShowFormDialog(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground">
            Gestao de fornecedores de materiais
          </p>
        </div>
        <Button onClick={handleNewClick}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar fornecedores..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))
          }}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="rounded-lg border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Nenhum fornecedor encontrado"
          description={
            search
              ? 'Tente ajustar os criterios de pesquisa'
              : 'Comece por adicionar o primeiro fornecedor'
          }
          action={
            !search
              ? { label: 'Novo Fornecedor', onClick: handleNewClick }
              : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Prazo Medio (dias)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.contact_name || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.phone || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.email || '—'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {supplier.average_delivery_days ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                      {supplier.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        {supplier.is_active && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeactivateId(supplier.id)}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Desativar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SupplierFormDialog
        open={showFormDialog}
        onOpenChange={(open: boolean) => {
          setShowFormDialog(open)
          if (!open) setEditSupplier(null)
        }}
        supplier={editSupplier}
        onSubmit={handleFormSubmit}
      />

      <AlertDialog open={!!deactivateId} onOpenChange={() => setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende desativar este fornecedor? Podera reactiva-lo posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
