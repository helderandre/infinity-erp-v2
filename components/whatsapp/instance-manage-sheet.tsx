'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
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
  Briefcase,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  is_business?: boolean
  created_at?: string
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

  const initials = instance.profile_name
    ? instance.profile_name.slice(0, 2).toUpperCase()
    : instance.name.slice(0, 2).toUpperCase()

  const createdAgo = instance.created_at
    ? formatDistanceToNow(new Date(instance.created_at), { addSuffix: true, locale: pt })
    : null

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
            {/* Avatar + Name + Status */}
            <div className="flex items-start gap-3">
              <Avatar className="h-14 w-14 shrink-0">
                {instance.profile_pic_url && (
                  <AvatarImage src={instance.profile_pic_url} alt={instance.name} />
                )}
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-base font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-1">
                {editing ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="h-7 text-sm font-semibold px-1.5 rounded-md"
                      autoFocus
                      disabled={saving}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-emerald-600"
                      onClick={handleSaveEdit}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold truncate">{instance.name}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={handleStartEdit}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[10px] border-transparent ${
                      isConnected
                        ? 'bg-emerald-100 text-emerald-800'
                        : instance.connection_status === 'connecting'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${statusColor}`} />
                    {statusLabel}
                  </Badge>
                  {instance.is_business && (
                    <Badge variant="outline" className="text-[10px] gap-0.5">
                      <Briefcase className="h-2.5 w-2.5" />
                      Business
                    </Badge>
                  )}
                </div>

                {instance.profile_name && (
                  <p className="text-xs text-muted-foreground truncate">{instance.profile_name}</p>
                )}
              </div>
            </div>

            {/* Info grid */}
            <div className="rounded-xl bg-muted/50 p-3.5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{instance.phone || 'Sem número'}</span>
                </div>
                {createdAgo && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="truncate">Criado {createdAgo}</span>
                  </div>
                )}
              </div>
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
