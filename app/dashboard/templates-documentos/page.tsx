'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  FileCode2,
  FileType,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Shield,
  Loader2,
  Check,
  ChevronsUpDown,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/constants'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'

// --- Constants ---

const DOC_TYPE_CATEGORIES = [
  'Contratual',
  'Imóvel',
  'Jurídico',
  'Jurídico Especial',
  'Proprietário',
  'Proprietário Empresa',
  'Fiscal',
  'Financeiro',
  'Outro',
]

const ALL_EXTENSIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'jpg', label: 'JPG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'doc', label: 'DOC' },
  { value: 'docx', label: 'DOCX' },
  { value: 'xls', label: 'XLS' },
  { value: 'xlsx', label: 'XLSX' },
  { value: 'csv', label: 'CSV' },
  { value: 'txt', label: 'TXT' },
]

// --- Types ---

interface DocType {
  id: string
  name: string
  description: string | null
  category: string | null
  allowed_extensions: string[] | null
  default_validity_months: number | null
  is_system: boolean | null
  created_at: string | null
}

interface DocTemplate {
  id: string
  name: string
  description: string | null
  content_html: string
  doc_type_id: string | null
  doc_types: { id: string; name: string; category: string | null } | null
  created_at: string | null
  updated_at: string | null
}

// --- Doc Templates Tab ---

function DocTemplatesTab() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editTemplate, setEditTemplate] = useState<DocTemplate | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/libraries/docs?${params}`)
      if (!res.ok) throw new Error()
      setTemplates(await res.json())
    } catch {
      toast.error('Erro ao carregar templates de documentos')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/libraries/docs/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Template eliminado com sucesso')
      fetchTemplates()
    } catch {
      toast.error('Erro ao eliminar template')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { setEditTemplate(null); setIsCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileCode2}
          title="Nenhum template de documento"
          description={search ? 'Tente ajustar os critérios de pesquisa' : 'Crie o seu primeiro template de documento'}
          action={!search ? { label: 'Criar Template', onClick: () => { setEditTemplate(null); setIsCreateOpen(true) } } : undefined}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Tipo de Documento</TableHead>
                <TableHead className="hidden lg:table-cell">Descrição</TableHead>
                <TableHead className="hidden sm:table-cell">Data</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {tpl.doc_types ? (
                      <Badge variant="secondary">{tpl.doc_types.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate">
                    {tpl.description || '—'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {formatDateTime(tpl.updated_at || tpl.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditTemplate(tpl); setIsCreateOpen(true) }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(tpl.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DocTemplateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        template={editTemplate}
        onSaved={fetchTemplates}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este template de documento? Esta acção é irreversível.
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

// --- Doc Template Create/Edit Dialog ---

function DocTemplateDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: DocTemplate | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [docTypeId, setDocTypeId] = useState<string>('')
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(template?.name || '')
      setDescription(template?.description || '')
      setContentHtml(template?.content_html || '')
      setDocTypeId(template?.doc_type_id || '')
      fetch('/api/libraries/doc-types')
        .then((r) => r.json())
        .then(setDocTypes)
        .catch(() => {})
    }
  }, [open, template])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('O nome é obrigatório')
      return
    }
    if (!contentHtml.trim()) {
      toast.error('O conteúdo é obrigatório')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        content_html: contentHtml,
        doc_type_id: docTypeId || null,
      }

      const res = template
        ? await fetch(`/api/libraries/docs/${template.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/libraries/docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!res.ok) throw new Error()
      toast.success(template ? 'Template actualizado com sucesso' : 'Template criado com sucesso')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Erro ao guardar template')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar Template' : 'Novo Template de Documento'}</DialogTitle>
          <DialogDescription>
            {template ? 'Actualize os dados do template de documento.' : 'Crie um novo template de documento com variáveis.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="tpl-name">Nome *</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Contrato de Arrendamento" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-desc">Descrição</Label>
            <Input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição breve do template" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-doctype">Tipo de Documento</Label>
            <Select value={docTypeId} onValueChange={setDocTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {docTypes.map((dt) => (
                  <SelectItem key={dt.id} value={dt.id}>
                    {dt.name} {dt.category ? `(${dt.category})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-content">Conteúdo HTML *</Label>
            <Textarea
              id="tpl-content"
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              placeholder="<h1>{{proprietario_nome}}</h1>..."
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use variáveis como {'{{proprietario_nome}}'}, {'{{imovel_ref}}'}, etc.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {template ? 'Guardar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Doc Types Tab ---

function DocTypesTab() {
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editDocType, setEditDocType] = useState<DocType | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const fetchDocTypes = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/libraries/doc-types')
      if (!res.ok) throw new Error()
      setDocTypes(await res.json())
    } catch {
      toast.error('Erro ao carregar tipos de documento')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocTypes()
  }, [fetchDocTypes])

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/libraries/doc-types/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao eliminar')
      }
      toast.success('Tipo de documento eliminado com sucesso')
      fetchDocTypes()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar tipo de documento')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const grouped = docTypes.reduce<Record<string, DocType[]>>((acc, dt) => {
    const cat = dt.category || 'Sem Categoria'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => { setEditDocType(null); setIsCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tipo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : docTypes.length === 0 ? (
        <EmptyState
          icon={FileType}
          title="Nenhum tipo de documento"
          description="Crie o primeiro tipo de documento do sistema"
          action={{ label: 'Criar Tipo', onClick: () => { setEditDocType(null); setIsCreateOpen(true) } }}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, types]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden md:table-cell">Extensões</TableHead>
                      <TableHead className="hidden lg:table-cell">Validade</TableHead>
                      <TableHead className="hidden sm:table-cell">Sistema</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {types.map((dt) => (
                      <TableRow key={dt.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{dt.name}</span>
                            {dt.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[250px]">{dt.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(dt.allowed_extensions || []).map((ext) => (
                              <Badge key={ext} variant="outline" className="text-xs">
                                .{ext}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                          {dt.default_validity_months ? `${dt.default_validity_months} meses` : '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {dt.is_system && (
                            <Badge variant="secondary" className="gap-1">
                              <Shield className="h-3 w-3" />
                              Sistema
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditDocType(dt); setIsCreateOpen(true) }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              {!dt.is_system && (
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(dt.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
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
            </div>
          ))}
        </div>
      )}

      <DocTypeDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        docType={editDocType}
        onSaved={fetchDocTypes}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tipo de documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este tipo de documento? Se estiver em uso, não será possível eliminar.
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

// --- Doc Type Create/Edit Dialog ---

function DocTypeDialog({
  open,
  onOpenChange,
  docType,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  docType: DocType | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([])
  const [validityMonths, setValidityMonths] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(docType?.name || '')
      setDescription(docType?.description || '')
      setCategory(docType?.category || '')
      setSelectedExtensions(docType?.allowed_extensions || ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'])
      setValidityMonths(docType?.default_validity_months?.toString() || '')
    }
  }, [open, docType])

  const toggleExtension = (ext: string) => {
    setSelectedExtensions((prev) =>
      prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('O nome é obrigatório')
      return
    }
    if (!category) {
      toast.error('A categoria é obrigatória')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        allowed_extensions: selectedExtensions,
        default_validity_months: validityMonths ? parseInt(validityMonths, 10) : null,
      }

      const res = docType
        ? await fetch(`/api/libraries/doc-types/${docType.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/libraries/doc-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao guardar')
      }
      toast.success(docType ? 'Tipo de documento actualizado' : 'Tipo de documento criado com sucesso')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar tipo de documento')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{docType ? 'Editar Tipo de Documento' : 'Novo Tipo de Documento'}</DialogTitle>
          <DialogDescription>
            {docType ? 'Actualize as propriedades do tipo de documento.' : 'Defina um novo tipo de documento para o sistema.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="dt-name">Nome *</Label>
            <Input id="dt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Caderneta Predial" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dt-desc">Descrição</Label>
            <Input id="dt-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição breve" />
          </div>
          <div className="grid gap-2">
            <Label>Categoria *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoria" />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Extensões Permitidas</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 justify-between font-normal">
                  {selectedExtensions.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {selectedExtensions.length > 3 ? (
                        <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                          {selectedExtensions.length} seleccionadas
                        </Badge>
                      ) : (
                        selectedExtensions.map((ext) => (
                          <Badge key={ext} variant="secondary" className="rounded-sm px-1 font-normal">
                            .{ext}
                          </Badge>
                        ))
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Seleccionar extensões</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Extensão" />
                  <CommandList>
                    <CommandEmpty>Sem resultados.</CommandEmpty>
                    <CommandGroup>
                      {ALL_EXTENSIONS.map((ext) => {
                        const isSelected = selectedExtensions.includes(ext.value)
                        return (
                          <CommandItem
                            key={ext.value}
                            onSelect={() => toggleExtension(ext.value)}
                          >
                            <div
                              className={cn(
                                'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'opacity-50 [&_svg]:invisible'
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            <span>.{ext.value}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{ext.label}</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                    {selectedExtensions.length > 0 && (
                      <>
                        <CommandSeparator />
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => setSelectedExtensions([])}
                            className="justify-center text-center"
                          >
                            Limpar filtros
                          </CommandItem>
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dt-validity">Validade Padrão (meses)</Label>
            <Input
              id="dt-validity"
              type="number"
              min="1"
              value={validityMonths}
              onChange={(e) => setValidityMonths(e.target.value)}
              placeholder="Ex: 12"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {docType ? 'Guardar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Page ---

export default function TemplatesDocumentosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Templates de Documentos</h1>
        <p className="text-muted-foreground">
          Gerir templates de documentos e tipos de documento do sistema
        </p>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="gap-2">
            <FileCode2 className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="tipos" className="gap-2">
            <FileType className="h-4 w-4" />
            Tipos de Documento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <DocTemplatesTab />
        </TabsContent>

        <TabsContent value="tipos">
          <DocTypesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
