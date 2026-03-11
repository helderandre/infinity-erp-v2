'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OwnerSearch } from '@/components/owners/owner-search'
import { OWNER_ROLE_COLORS } from '@/lib/constants'
import { Loader2, Search, UserPlus, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { OwnerRoleType } from '@/types/owner'

interface AddOwnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  processId?: string
  roleTypes: OwnerRoleType[]
  existingOwnerIds: string[]
  onAdded?: () => void
}

export function AddOwnerDialog({
  open,
  onOpenChange,
  propertyId,
  processId,
  roleTypes,
  existingOwnerIds,
  onAdded,
}: AddOwnerDialogProps) {
  const [tab, setTab] = useState<string>('search')
  const [saving, setSaving] = useState(false)

  // Search state
  const [selectedOwner, setSelectedOwner] = useState<any>(null)

  // New owner state
  const [newOwner, setNewOwner] = useState({
    name: '',
    nif: '',
    email: '',
    phone: '',
    person_type: 'singular' as 'singular' | 'coletiva',
  })

  // Junction data
  const [ownerRoleId, setOwnerRoleId] = useState('')
  const [ownershipPercentage, setOwnershipPercentage] = useState(100)

  // Task creation confirmation
  const [taskConfirmOpen, setTaskConfirmOpen] = useState(false)
  const [addedOwnerId, setAddedOwnerId] = useState<string | null>(null)
  const [addedOwnerName, setAddedOwnerName] = useState('')
  const [populatingTasks, setPopulatingTasks] = useState(false)

  // Default to 'proprietario' role
  const defaultRoleId = roleTypes.find((r) => r.name === 'proprietario')?.id || ''

  const resetState = useCallback(() => {
    setSelectedOwner(null)
    setNewOwner({ name: '', nif: '', email: '', phone: '', person_type: 'singular' })
    setOwnerRoleId('')
    setOwnershipPercentage(100)
    setTab('search')
  }, [])

  const handleAdd = async () => {
    const roleId = ownerRoleId || defaultRoleId

    setSaving(true)
    try {
      let body: any

      if (tab === 'search' && selectedOwner) {
        body = {
          owner_id: selectedOwner.id,
          ownership_percentage: ownershipPercentage,
          is_main_contact: false,
          owner_role_id: roleId,
        }
      } else if (tab === 'new') {
        if (!newOwner.name) {
          toast.error('O nome é obrigatório')
          setSaving(false)
          return
        }

        body = {
          owner: {
            person_type: newOwner.person_type,
            name: newOwner.name,
            nif: newOwner.nif || undefined,
            email: newOwner.email || undefined,
            phone: newOwner.phone || undefined,
          },
          ownership_percentage: ownershipPercentage,
          is_main_contact: false,
          owner_role_id: roleId,
        }
      } else {
        toast.error('Seleccione um proprietário existente ou crie um novo')
        setSaving(false)
        return
      }

      const res = await fetch(`/api/properties/${propertyId}/owners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        if (res.status === 409 && err.existing_id) {
          toast.error('Este proprietário já está associado a este imóvel')
        } else {
          throw new Error(err.error || 'Erro ao adicionar proprietário')
        }
        setSaving(false)
        return
      }

      const result = await res.json()
      const ownerId = result.owner_id || selectedOwner?.id
      const ownerName = selectedOwner?.name || newOwner.name

      toast.success('Proprietário adicionado com sucesso')
      onAdded?.()
      onOpenChange(false)
      resetState()

      // Se há processo activo, perguntar se quer criar tarefas
      if (processId && ownerId) {
        setAddedOwnerId(ownerId)
        setAddedOwnerName(ownerName)
        setTaskConfirmOpen(true)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao adicionar proprietário'
      )
    } finally {
      setSaving(false)
    }
  }

  const handlePopulateTasks = async () => {
    if (!processId || !addedOwnerId) return

    setPopulatingTasks(true)
    try {
      const res = await fetch(`/api/processes/${processId}/owners/populate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: addedOwnerId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar tarefas')
      }

      const total = (data.tasks_created || 0) + (data.subtasks_created || 0)
      if (total > 0) {
        toast.success(`${total} item(ns) criado(s) no fluxo para ${addedOwnerName}`)
      } else {
        toast.info('Nenhuma tarefa do template corresponde a este tipo de proprietário')
      }

      onAdded?.() // Refresh para mostrar novas tarefas
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao criar tarefas'
      )
    } finally {
      setPopulatingTasks(false)
      setTaskConfirmOpen(false)
      setAddedOwnerId(null)
      setAddedOwnerName('')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Adicionar Proprietário
            </DialogTitle>
            <DialogDescription>
              Pesquise um proprietário existente ou crie um novo para associar a este imóvel.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Pesquisar Existente
              </TabsTrigger>
              <TabsTrigger value="new" className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Criar Novo
              </TabsTrigger>
            </TabsList>

            {/* Search existing */}
            <TabsContent value="search" className="space-y-4">
              <div className="space-y-2">
                <Label>Pesquisar por nome, NIF ou email</Label>
                <OwnerSearch
                  placeholder="Pesquisar proprietário..."
                  excludeIds={existingOwnerIds}
                  onSelect={setSelectedOwner}
                />
              </div>

              {selectedOwner && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                  <p className="text-sm font-medium">{selectedOwner.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedOwner.person_type === 'singular' ? 'Pessoa Singular' : 'Pessoa Colectiva'}
                    {selectedOwner.nif && ` · NIF: ${selectedOwner.nif}`}
                    {selectedOwner.email && ` · ${selectedOwner.email}`}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Create new */}
            <TabsContent value="new" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Tipo de Pessoa</Label>
                  <Select
                    value={newOwner.person_type}
                    onValueChange={(v) => setNewOwner((p) => ({ ...p, person_type: v as 'singular' | 'coletiva' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="singular">Pessoa Singular</SelectItem>
                      <SelectItem value="coletiva">Pessoa Colectiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Nome *</Label>
                  <Input
                    value={newOwner.name}
                    onChange={(e) => setNewOwner((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>NIF</Label>
                  <Input
                    value={newOwner.nif}
                    onChange={(e) => setNewOwner((p) => ({ ...p, nif: e.target.value }))}
                    maxLength={9}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newOwner.email}
                    onChange={(e) => setNewOwner((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Telefone</Label>
                  <Input
                    value={newOwner.phone}
                    onChange={(e) => setNewOwner((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Junction data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={ownerRoleId || defaultRoleId} onValueChange={setOwnerRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {roleTypes.map((role) => {
                    const colors = OWNER_ROLE_COLORS[role.name] || OWNER_ROLE_COLORS.proprietario
                    return (
                      <SelectItem key={role.id} value={role.id}>
                        <span className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', colors.bg.replace('100', '500'))} />
                          {role.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Percentagem (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={ownershipPercentage}
                onChange={(e) => setOwnershipPercentage(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { resetState(); onOpenChange(false) }}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={saving || (tab === 'search' && !selectedOwner) || (tab === 'new' && !newOwner.name)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar Proprietário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task creation confirmation */}
      <AlertDialog open={taskConfirmOpen} onOpenChange={setTaskConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Criar Tarefas no Processo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O proprietário <strong>{addedOwnerName}</strong> foi adicionado ao imóvel.
              Deseja criar as tarefas correspondentes no fluxo do processo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={populatingTasks}>
              Não, apenas adicionar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handlePopulateTasks} disabled={populatingTasks}>
              {populatingTasks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sim, criar tarefas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
