'use client'

import { useState } from 'react'
import {
  Unplug,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Settings,
  Plus,
  QrCode,
  Phone,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="sm:max-w-[420px] rounded-2xl p-0 flex flex-col overflow-hidden">
          {/* ── Dark header ── */}
          <div className="bg-neutral-900 px-5 py-4 shrink-0 relative">
            <DialogClose className="absolute top-3 right-3 rounded-sm p-1 text-neutral-400 hover:text-white transition-colors focus:outline-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-white">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                  <Settings className="h-4 w-4" />
                </div>
                Gerir Instância
              </DialogTitle>
              <DialogDescription className="text-neutral-400 mt-1">
                Gerir a configuração da sua instância WhatsApp.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* ── Body ── */}
          <div className="px-5 py-5 space-y-5">
            {/* Instance Name */}
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Nome
              </span>
              {editing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className="h-9 text-sm rounded-lg"
                    autoFocus
                    disabled={saving}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-emerald-600 hover:text-emerald-700"
                    onClick={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
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

            {/* Status card */}
            <div className="rounded-xl bg-muted/50 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                <span className="text-sm font-medium">{statusLabel}</span>
              </div>
              {instance.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{instance.phone}</span>
                </div>
              )}
              {instance.profile_name && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{instance.profile_name}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Acções
              </span>

              <div className="space-y-1.5">
                {isConnected ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start rounded-lg"
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
                    className="w-full justify-start rounded-lg"
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
                  className="w-full justify-start rounded-lg"
                  onClick={() => {
                    onOpenChange(false)
                    onCreate()
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar nova instância
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar instância
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
