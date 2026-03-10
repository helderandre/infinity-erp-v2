'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Trash2, Shield, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { RoleDialog } from '@/components/roles/role-dialog'
import { PERMISSION_MODULES } from '@/lib/constants'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: Record<string, boolean> | null
  created_at: string
  updated_at: string | null
}

export default function DefinicoesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/libraries/roles')
      const data = await res.json()
      if (res.ok) {
        setRoles(data.filter((r: Role) => r.name.toLowerCase() !== 'admin'))
      }
    } catch {
      toast.error('Erro ao carregar roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const handleCreate = () => {
    setEditingRole(null)
    setDialogOpen(true)
  }

  const handleEdit = (role: Role) => {
    setEditingRole(role)
    setDialogOpen(true)
  }

  const handleSaved = () => {
    setDialogOpen(false)
    setEditingRole(null)
    fetchRoles()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/libraries/roles/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao eliminar role')
        return
      }
      toast.success('Role eliminada com sucesso')
      fetchRoles()
    } catch {
      toast.error('Erro ao eliminar role')
    } finally {
      setDeleteTarget(null)
    }
  }

  const countPermissions = (permissions: Record<string, boolean> | null) => {
    if (!permissions) return 0
    return Object.values(permissions).filter(Boolean).length
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Definições</h1>
          <p className="text-muted-foreground">
            Gestão de roles e permissões do sistema
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Role
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-center">Permissões</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                </TableRow>
              ))
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Nenhuma role encontrada
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => {
                const permCount = countPermissions(role.permissions)
                const total = PERMISSION_MODULES.length
                const allEnabled = permCount === total
                return (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {allEnabled ? (
                          <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Shield className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={allEnabled ? 'default' : permCount > 0 ? 'secondary' : 'outline'}
                      >
                        {permCount}/{total}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(role)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(role)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <RoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editingRole}
        onSaved={handleSaved}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar role</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar a role &quot;{deleteTarget?.name}&quot;? Esta acção é irreversível.
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
