'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  FileImage,
  File as FileIcon,
  Home,
  X,
} from 'lucide-react'
import { useMarketingRecursos, type MarketingResource } from '@/hooks/use-marketing-recursos'

function formatBytes(bytes: number | null): string {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImageMime(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

function isPdfMime(mime: string | null): boolean {
  return mime === 'application/pdf'
}

export function RecursosBrowser() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const folderParam = searchParams.get('folder')
  const parentId = folderParam || null

  const {
    items,
    breadcrumbs,
    isLoading,
    createFolder,
    uploadFiles,
    renameItem,
    deleteItem,
  } = useMarketingRecursos(parentId)

  const folders = items.filter((i) => i.is_folder)
  const files = items.filter((i) => !i.is_folder)

  // Dialog state
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameTarget, setRenameTarget] = useState<MarketingResource | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MarketingResource | null>(null)
  const [previewItem, setPreviewItem] = useState<MarketingResource | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Drag-drop state (root-level zone)
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
      const files = Array.from(e.dataTransfer.files || [])
      if (files.length === 0) return
      uploadFiles(files)
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
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('folder', id)
    else url.searchParams.delete('folder')
    router.push(url.pathname + url.search)
  }

  const copyUrl = async (item: MarketingResource) => {
    if (!item.file_url) return
    try {
      await navigator.clipboard.writeText(item.file_url)
      toast.success('URL copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  return (
    <div
      className="relative space-y-5"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary pointer-events-none">
          <div className="bg-background border rounded-2xl px-8 py-6 shadow-xl flex items-center gap-3">
            <Upload className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold">Largar para carregar</div>
              <div className="text-xs text-muted-foreground">
                Os ficheiros serão adicionados a esta pasta
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recursos</h1>
          <p className="text-sm text-muted-foreground">
            Biblioteca partilhada de logos, marca e materiais oficiais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => setNewFolderOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
            Nova pasta
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-full"
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
              const files = Array.from(e.target.files || [])
              if (files.length === 0) return
              uploadFiles(files)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button
          onClick={() => navigateToFolder(null)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition-colors',
            !parentId && 'font-semibold',
          )}
        >
          <Home className="h-3.5 w-3.5" />
          Raiz
        </button>
        {breadcrumbs.map((bc, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <div key={bc.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                onClick={() => navigateToFolder(bc.id)}
                className={cn(
                  'px-2 py-1 rounded-md hover:bg-muted transition-colors truncate max-w-[180px]',
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
        <div className="rounded-2xl border-2 border-dashed py-20 text-center">
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <h3 className="text-base font-semibold">Pasta vazia</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Arrasta ficheiros para aqui ou usa os botões acima.
          </p>
        </div>
      )}

      {/* Folders */}
      {folders.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Pastas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Ficheiros
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
  folder: MarketingResource
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div
      onDoubleClick={onOpen}
      className="group relative rounded-xl border bg-card hover:border-primary hover:shadow-sm transition-all p-4 flex flex-col gap-2 cursor-pointer min-h-[120px]"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Folder className="h-5 w-5 text-primary fill-primary/20" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
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
      <div className="font-medium text-sm truncate" title={folder.name}>
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
  file: MarketingResource
  onOpen: () => void
  onCopyUrl: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const isImage = isImageMime(file.mime_type)

  return (
    <div
      onDoubleClick={onOpen}
      className="group relative rounded-xl border bg-card hover:border-primary hover:shadow-sm transition-all overflow-hidden cursor-pointer flex flex-col"
      onClick={onOpen}
    >
      <div className="relative aspect-square bg-muted overflow-hidden">
        {isImage && file.file_url ? (
          <Image
            src={file.file_url}
            alt={file.name}
            fill
            className="object-contain p-2"
            unoptimized
            sizes="200px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {isPdfMime(file.mime_type) ? (
              <FileText className="h-12 w-12 text-muted-foreground/40" />
            ) : (
              <FileIcon className="h-12 w-12 text-muted-foreground/40" />
            )}
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
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
      <div className="p-2.5 border-t">
        <div className="text-xs font-medium truncate" title={file.name}>
          {file.name}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
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
  item: MarketingResource | null
  onClose: () => void
  onCopyUrl: () => void
}) {
  const open = !!item
  const isImage = isImageMime(item?.mime_type ?? null)
  const isPdf = isPdfMime(item?.mime_type ?? null)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-4xl p-0 overflow-hidden"
        showCloseButton={false}
      >
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
        <div className="bg-muted/40 min-h-[60vh] flex items-center justify-center p-4">
          {item && isImage && (
            <img
              src={item.file_url || ''}
              alt={item.name}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}
          {item && isPdf && (
            <iframe
              src={item.file_url || ''}
              className="w-full h-[70vh] rounded border"
              title={item.name}
            />
          )}
          {item && !isImage && !isPdf && (
            <div className="text-center">
              <FileImage className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Pré-visualização não disponível para este tipo de ficheiro.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
