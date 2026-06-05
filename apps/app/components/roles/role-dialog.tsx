'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PERMISSION_MODULES } from '@/lib/constants'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: Record<string, boolean> | null
}

interface RoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: Role | null
  onSaved: () => void
}

export function RoleDialog({ open, onOpenChange, role, onSaved }: RoleDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const isEditing = !!role

  useEffect(() => {
    if (!open) return
    if (role) {
      setName(role.name)
      setDescription(role.description || '')
      setPermissions(role.permissions || {})
    } else {
      setName('')
      setDescription('')
      setPermissions({})
    }
  }, [open, role])

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleGroup = (group: string) => {
    const groupModules = PERMISSION_MODULES.filter((m) => m.group === group)
    const allEnabled = groupModules.every((m) => permissions[m.key])
    const newPerms = { ...permissions }
    groupModules.forEach((m) => {
      newPerms[m.key] = !allEnabled
    })
    setPermissions(newPerms)
  }

  const toggleAll = () => {
    const allEnabled = PERMISSION_MODULES.every((m) => permissions[m.key])
    const newPerms: Record<string, boolean> = {}
    PERMISSION_MODULES.forEach((m) => {
      newPerms[m.key] = !allEnabled
    })
    setPermissions(newPerms)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('O nome da role é obrigatório')
      return
    }

    setSaving(true)
    try {
      const url = isEditing
        ? `/api/libraries/roles/${role.id}`
        : '/api/libraries/roles'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, permissions }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao guardar role')
        return
      }

      toast.success(isEditing ? 'Role actualizada com sucesso' : 'Role criada com sucesso')
      onSaved()
    } catch {
      toast.error('Erro ao guardar role')
    } finally {
      setSaving(false)
    }
  }

  // Group modules by group
  const groups = PERMISSION_MODULES.reduce<Record<string, typeof PERMISSION_MODULES>>((acc, m) => {
    if (!acc[m.group]) acc[m.group] = []
    acc[m.group].push(m)
    return acc
  }, {})

  const enabledCount = PERMISSION_MODULES.filter((m) => permissions[m.key]).length
  const allEnabled = enabledCount === PERMISSION_MODULES.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Role' : 'Nova Role'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name & Description */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Nome *</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Consultor Sénior"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Descrição</Label>
              <Textarea
                id="role-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição da role..."
                rows={1}
                className="min-h-9 resize-none"
              />
            </div>
          </div>

          <Separator />

          {/* Permission matrix */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Permissões ({enabledCount}/{PERMISSION_MODULES.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAll}
              >
                {allEnabled ? 'Desmarcar todas' : 'Marcar todas'}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(groups).map(([group, modules]) => {
                const groupAllEnabled = modules.every((m) => permissions[m.key])
                const groupSomeEnabled = modules.some((m) => permissions[m.key])
                return (
                  <div key={group} className="rounded-lg border p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`group-${group}`}
                        checked={groupAllEnabled ? true : groupSomeEnabled ? 'indeterminate' : false}
                        onCheckedChange={() => toggleGroup(group)}
                      />
                      <Label
                        htmlFor={`group-${group}`}
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer"
                      >
                        {group}
                      </Label>
                    </div>
                    <div className="space-y-1.5 pl-1">
                      {modules.map((m) => (
                        <div key={m.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`perm-${m.key}`}
                            checked={!!permissions[m.key]}
                            onCheckedChange={() => togglePermission(m.key)}
                          />
                          <Label
                            htmlFor={`perm-${m.key}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {m.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Guardar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
