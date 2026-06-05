'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  ChevronRight,
  Folder,
  FolderPlus,
  Upload,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  File as FileIcon,
  Home,
  X,
  Image as ImageIcon,
} from 'lucide-react'
import { usePersonalDrive, type PersonalDriveItem } from '@/hooks/use-personal-drive'

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function isImageMime(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

function isPdfMime(mime: string | null): boolean {
  return mime === 'application/pdf'
}

export function PersonalDriveBrowser() {
  const [parentId, setParentId] = useState<string | null>(null)

  const {
    items,
    breadcrumbs,
    isLoading,
    usage,
    createFolder,
    uploadFiles,
    renameItem,
    deleteItem,
  } = usePersonalDrive(parentId)

  const folders = items.filter((i) => i.is_folder)
  const files = items.filter((i) => !i.is_folder)

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameTarget, setRenameTarget] = useState<PersonalDriveItem | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PersonalDriveItem | null>(null)
  const [previewItem, setPreviewItem] = useState<PersonalDriveItem | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Drag-drop
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!e.dataTransfer.types.includes('Files')) return
    dragCounter.current++
    setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }, [])
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault()
  }, [])
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setIsDragging(false)
      const dropped = Array.from(e.dataTransfer.files || [])
      if (dropped.length === 0) return
      uploadFiles(dropped)
    },
    [uploadFiles],
  )

  const handleSubmitFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    await createFolder(name)
    setNewFolderName('')
    setNewFolderOpen(false)
  }

  const handleSubmitRename = async () => {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name || name === renameTarget.name) {
      setRenameTarget(null)
      return
    }
    await renameItem(renameTarget.id, name)
    setRenameTarget(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await deleteItem(deleteTarget.id)
    setDeleteTarget(null)
  }

  const navigateToFolder = (id: string | null) => {
    setParentId(id)
  }

  const copyUrl = async (item: PersonalDriveItem) => {
    if (!item.file_url) return
    try {
      await navigator.clipboard.writeText(item.file_url)
      toast.success('URL copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const usagePct = usage ? Math.min(100, (usage.used_bytes / usage.limit_bytes) * 100) : 0
  const isOverLimit = usage ? usage.used_bytes >= usage.limit_bytes : false

  return (
    <div
      className="relative space-y-4"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm pointer-events-none">
          <div className="bg-background border rounded-2xl px-6 py-4 shadow-xl flex items-center gap-3">
            <Upload className="h-5 w-5 text-primary" />
            <div className="text-sm">
              <div className="font-semibold">Largar para carregar</div>
              <div className="text-xs text-muted-foreground">
                As imagens serão comprimidas automaticamente
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage bar */}
      <div className="rounded-xl border bg-card px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Espaço utilizado</span>
          <span className={cn('tabular-nums text-muted-foreground', isOverLimit && 'text-destructive font-semibold')}>
            {usage
              ? `${formatBytes(usage.used_bytes)} de ${formatBytes(usage.limit_bytes)}`
              : '—'}
          </span>
        </div>
        <Progress value={usagePct} className={cn('h-1.5', isOverLimit && '[&>div]:bg-destructive')} />
        {usage && (
          <p className="text-[10px] text-muted-foreground">
            {usage.file_count} ficheiro{usage.file_count === 1 ? '' : 's'}
            {usagePct >= 80 && !isOverLimit && ' · perto do limite'}
            {isOverLimit && ' · limite excedido'}
          </p>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setNewFolderOpen(true)}
        >
          <FolderPlus className="h-4 w-4" />
          Nova pasta
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Carregar
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const dropped = Array.from(e.target.files || [])
            if (dropped.length === 0) return
            uploadFiles(dropped)
            e.target.value = ''
          }}
        />
        <p className="text-[10px] text-muted-foreground ml-auto">
          Imagens convertidas para WebP · PDF comprimido sem perda
        </p>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-0.5 text-xs flex-wrap">
        <button
          onClick={() => navigateToFolder(null)}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors',
            !parentId && 'font-semibold',
          )}
        >
          <Home className="h-3 w-3" />
          Raiz
        </button>
        {breadcrumbs.map((bc, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <div key={bc.id} className="flex items-center gap-0.5">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => navigateToFolder(bc.id)}
                className={cn(
                  'px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors truncate max-w-[140px]',
                  isLast && 'font-semibold',
                )}
                title={bc.name}
              >
                {bc.name}
              </button>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed py-12 text-center">
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <h3 className="text-sm font-semibold">Drive vazio</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Arraste ficheiros para aqui ou use o botão "Carregar".
          </p>
        </div>
      )}

      {/* Folders */}
      {folders.length > 0 && (
        <section>
          <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Pastas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onOpen={() => navigateToFolder(folder.id)}
                onRename={() => {
                  setRenameTarget(folder)
                  setRenameValue(folder.name)
                }}
                onDelete={() => setDeleteTarget(folder)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Files */}
      {files.length > 0 && (
        <section>
          <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Ficheiros
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onOpen={() => setPreviewItem(file)}
                onCopyUrl={() => copyUrl(file)}
                onRename={() => {
                  setRenameTarget(file)
                  setRenameValue(file.name)
                }}
                onDelete={() => setDeleteTarget(file)}
              />
            ))}
          </div>
        </section>
      )}

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
            <DialogDescription>Cria uma pasta nesta localização.</DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nome da pasta"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitFolder()
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitFolder} disabled={!newFolderName.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear</DialogTitle>
            <DialogDescription>{renameTarget?.name}</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitRename()
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitRename} disabled={!renameValue.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar {deleteTarget?.is_folder ? 'pasta' : 'ficheiro'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.is_folder
                ? `Tem a certeza de que pretende eliminar a pasta "${deleteTarget?.name}" e todo o seu conteúdo? Esta acção é irreversível.`
                : `Tem a certeza de que pretende eliminar "${deleteTarget?.name}"? Esta acção é irreversível.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview dialog */}
      <FilePreviewDialog
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onCopyUrl={() => previewItem && copyUrl(previewItem)}
      />
    </div>
  )
}

function FolderCard({
  folder,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: PersonalDriveItem
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div
      onDoubleClick={onOpen}
      className="group relative rounded-lg border bg-card hover:border-primary hover:shadow-sm transition-all p-2.5 flex flex-col gap-1.5 cursor-pointer min-h-[88px]"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between">
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
          <Folder className="h-4 w-4 text-primary fill-primary/20" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="text-xs font-medium truncate" title={folder.name}>
        {folder.name}
      </div>
    </div>
  )
}

function FileCard({
  file,
  onOpen,
  onCopyUrl,
  onRename,
  onDelete,
}: {
  file: PersonalDriveItem
  onOpen: () => void
  onCopyUrl: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const isImage = isImageMime(file.mime_type)

  return (
    <div
      onDoubleClick={onOpen}
      className="group relative rounded-lg border bg-card hover:border-primary hover:shadow-sm transition-all overflow-hidden cursor-pointer flex flex-col"
      onClick={onOpen}
    >
      <div className="relative aspect-square bg-muted overflow-hidden flex items-center justify-center">
        {isImage && file.file_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.file_url}
            alt={file.name}
            className="max-h-full max-w-full object-contain p-1"
            style={{ objectPosition: 'center' }}
            loading="lazy"
          />
        ) : isPdfMime(file.mime_type) ? (
          <FileText className="h-8 w-8 text-muted-foreground/40" />
        ) : (
          <FileIcon className="h-8 w-8 text-muted-foreground/40" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onCopyUrl}>
              <Copy className="h-3.5 w-3.5 mr-2" />
              Copiar URL
            </DropdownMenuItem>
            {file.file_url && (
              <DropdownMenuItem asChild>
                <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Abrir em separador
                </a>
              </DropdownMenuItem>
            )}
            {file.file_url && (
              <DropdownMenuItem asChild>
                <a href={file.file_url} download={file.name}>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Descarregar
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="p-1.5 border-t">
        <div className="text-[11px] font-medium truncate" title={file.name}>
          {file.name}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {formatBytes(file.file_size)}
        </div>
      </div>
    </div>
  )
}

function FilePreviewDialog({
  item,
  onClose,
  onCopyUrl,
}: {
  item: PersonalDriveItem | null
  onClose: () => void
  onCopyUrl: () => void
}) {
  const open = !!item
  const isImage = isImageMime(item?.mime_type ?? null)
  const isPdf = isPdfMime(item?.mime_type ?? null)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base truncate">{item?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              {item ? formatBytes(item.file_size) : ''} · {item?.mime_type || ''}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onCopyUrl}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar URL
            </Button>
            {item?.file_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={item.file_url} download={item.name}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Descarregar
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="bg-muted/40 h-[70vh] flex items-center justify-center p-4">
          {item && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.file_url || ''}
              alt={item.name}
              className="max-h-full max-w-full object-contain"
              style={{ objectPosition: 'center' }}
            />
          )}
          {item && isPdf && (
            <iframe
              src={item.file_url || ''}
              className="w-full h-full rounded border"
              title={item.name}
            />
          )}
          {item && !isImage && !isPdf && (
            <div className="text-center">
              <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                Pré-visualização não disponível para este tipo de ficheiro.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
