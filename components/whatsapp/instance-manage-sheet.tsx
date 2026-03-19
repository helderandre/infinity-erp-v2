'use client'

import { useState } from 'react'
import {
  Plug,
  Unplug,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Settings,
  Plus,
  QrCode,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

interface Instance {
  id: string
  name: string
  connection_status: string
  phone?: string | null
  profile_name?: string | null
  profile_pic_url?: string | null
  user_id?: string | null
}

interface InstanceManageSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instance: Instance | null
  onRename: (id: string, name: string) => Promise<void>
  onConnect: (id: string) => void
  onDisconnect: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreate: () => void
}

export function InstanceManageSheet({
  open,
  onOpenChange,
  instance,
  onRename,
  onConnect,
  onDisconnect,
  onDelete,
  onCreate,
}: InstanceManageSheetProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!instance) return null

  const isConnected = instance.connection_status === 'connected'

  const statusColor = isConnected
    ? 'bg-emerald-500'
    : instance.connection_status === 'connecting'
      ? 'bg-yellow-500'
      : 'bg-slate-400'

  const statusLabel = isConnected
    ? 'Conectado'
    : instance.connection_status === 'connecting'
      ? 'A conectar...'
      : 'Desconectado'

  const handleStartEdit = () => {
    setEditName(instance.name)
    setEditing(true)
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setEditName('')
  }

  const handleSaveEdit = async () => {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === instance.name) {
      handleCancelEdit()
      return
    }
    setSaving(true)
    try {
      await onRename(instance.id, trimmed)
      setEditing(false)
    } catch {
      // parent handles toast
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await onDisconnect(instance.id)
    } catch {
      // parent handles toast
    } finally {
      setDisconnecting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(instance.id)
      setDeleteConfirm(false)
      onOpenChange(false)
    } catch {
      // parent handles toast
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-80 sm:w-96">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Gerir Instância
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Instance info */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Nome
              </Label>
              {editing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className="h-8 text-sm"
                    autoFocus
                    disabled={saving}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-emerald-600"
                    onClick={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{instance.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleStartEdit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Estado
              </Label>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                <span className="text-sm">{statusLabel}</span>
              </div>
              {instance.phone && (
                <p className="text-xs text-muted-foreground">{instance.phone}</p>
              )}
              {instance.profile_name && (
                <p className="text-xs text-muted-foreground">Perfil: {instance.profile_name}</p>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Acções
              </Label>

              {isConnected ? (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="mr-2 h-4 w-4" />
                  )}
                  Desconectar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    onOpenChange(false)
                    onConnect(instance.id)
                  }}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Conectar
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar instância
              </Button>
            </div>

            <Separator />

            {/* Create new */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                onOpenChange(false)
                onCreate()
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar nova instância
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar a instância &ldquo;{instance.name}&rdquo;?
              Esta acção é irreversível e irá remover todas as conversas associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
