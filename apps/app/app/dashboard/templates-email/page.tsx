'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
import { EmptyState } from '@/components/shared/empty-state'
import {
  Mail,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  User,
  Send,
  Calendar,
} from 'lucide-react'
import { useEmailTemplates, type EmailTemplate } from '@/hooks/use-email-templates'
import { formatDate } from '@/lib/constants'
import {
  TEMPLATE_CATEGORY_VALUES,
  TEMPLATE_CATEGORY_LABELS_PT,
  normalizeCategory,
} from '@/lib/constants-template-categories'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function TemplatesEmailPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { templates, isLoading, refetch } = useEmailTemplates(
    search,
    categoryFilter === 'all' ? null : categoryFilter,
  )

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/libraries/emails/${deleteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao eliminar template')
      toast.success('Template eliminado com sucesso')
      refetch()
    } catch {
      toast.error('Erro ao eliminar template')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      const detailRes = await fetch(`/api/libraries/emails/${template.id}`)
      if (!detailRes.ok) throw new Error('Erro ao carregar template')
      const detail = await detailRes.json()

      const res = await fetch('/api/libraries/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (cópia)`,
          subject: template.subject,
          description: template.description || '',
          body_html: detail.body_html,
          editor_state: detail.editor_state,
        }),
      })
      if (!res.ok) throw new Error('Erro ao duplicar template')
      toast.success('Template duplicado com sucesso')
      refetch()
    } catch {
      toast.error('Erro ao duplicar template')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates de Email</h1>
          <p className="text-muted-foreground">
            Gerir templates de email para processos
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/templates-email/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {TEMPLATE_CATEGORY_VALUES.map((c) => (
              <SelectItem key={c} value={c}>
                {TEMPLATE_CATEGORY_LABELS_PT[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isLoading && templates.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border bg-card overflow-hidden">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Nenhum template de email"
          description={
            search
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Crie o seu primeiro template de email'
          }
          action={
            !search
              ? {
                  label: 'Criar Template',
                  onClick: () => router.push('/dashboard/templates-email/novo'),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={() => router.push(`/dashboard/templates-email/${tpl.id}`)}
              onDuplicate={() => handleDuplicate(tpl)}
              onDelete={() => setDeleteId(tpl.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este template de email? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'A eliminar...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  template: EmailTemplate
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const creatorName = template.creator?.commercial_name || 'Desconhecido'

  return (
    <div
      className="group relative rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
      onClick={onEdit}
    >
      {/* Preview thumbnail */}
      <div className="relative h-44 bg-muted/30 overflow-hidden border-b">
        {template.body_html ? (
          <EmailPreviewThumbnail html={template.body_html} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Mail className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Badge variant="outline" className="text-[10px] font-normal">
                {TEMPLATE_CATEGORY_LABELS_PT[normalizeCategory(template.category)]}
              </Badge>
            </div>
            <h3 className="font-semibold text-sm truncate">{template.name}</h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {template.subject}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {template.description}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-3 pt-1 border-t text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{creatorName}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Send className="h-3 w-3" />
            {template.usage_count ?? 0}
          </span>
          <span className="flex items-center gap-1 ml-auto shrink-0">
            <Calendar className="h-3 w-3" />
            {formatDate(template.updated_at || template.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

function EmailPreviewThumbnail({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const doc = iframe.contentDocument
    if (!doc) return

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            transform-origin: top left;
            transform: scale(0.35);
            width: ${Math.round(100 / 0.35)}%;
            overflow: hidden;
            pointer-events: none;
          }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `)
    doc.close()
    setLoaded(true)
  }, [html])

  return (
    <iframe
      ref={iframeRef}
      title="Pré-visualização"
      className={`w-full h-full border-0 transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
      sandbox="allow-same-origin"
      tabIndex={-1}
    />
  )
}
