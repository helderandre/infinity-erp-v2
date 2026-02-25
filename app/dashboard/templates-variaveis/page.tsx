'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenuSeparator,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Braces,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Shield,
  Loader2,
  Building2,
  User,
  Users,
  Cog,
  Globe,
  EyeOff,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'

// --- Constants ---

const SOURCE_ENTITIES = [
  { value: 'property', label: 'Imóvel', icon: Building2 },
  { value: 'owner', label: 'Proprietário', icon: User },
  { value: 'consultant', label: 'Consultor', icon: Users },
  { value: 'process', label: 'Processo', icon: Cog },
  { value: 'system', label: 'Sistema', icon: Globe },
] as const

const CATEGORIES = [
  { value: 'proprietario', label: 'Proprietário' },
  { value: 'imovel', label: 'Imóvel' },
  { value: 'consultor', label: 'Consultor' },
  { value: 'processo', label: 'Processo' },
  { value: 'sistema', label: 'Sistema' },
] as const

const FORMAT_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'currency', label: 'Moeda (EUR)' },
  { value: 'date', label: 'Data' },
  { value: 'concat', label: 'Concatenação' },
] as const

const SOURCE_TABLES: Record<string, { value: string; label: string; columns: string[] }[]> = {
  property: [
    { value: 'dev_properties', label: 'dev_properties', columns: ['title', 'external_ref', 'description', 'listing_price', 'property_type', 'business_type', 'status', 'energy_certificate', 'city', 'zone', 'address_street', 'postal_code', 'latitude', 'longitude', 'property_condition', 'business_status', 'contract_regime', 'address_parish', 'slug'] },
    { value: 'dev_property_specifications', label: 'dev_property_specifications', columns: ['typology', 'bedrooms', 'bathrooms', 'area_gross', 'area_util', 'construction_year', 'parking_spaces', 'garage_spaces', 'has_elevator', 'fronts_count'] },
    { value: 'dev_property_internal', label: 'dev_property_internal', columns: ['exact_address', 'postal_code', 'internal_notes', 'commission_agreed', 'commission_type', 'contract_regime', 'contract_term', 'contract_expiry', 'imi_value', 'condominium_fee', 'cpcv_percentage', 'reference_internal'] },
  ],
  owner: [
    { value: 'owners', label: 'owners', columns: ['name', 'email', 'phone', 'nif', 'nationality', 'naturality', 'marital_status', 'address', 'person_type', 'legal_representative_name', 'legal_representative_nif'] },
  ],
  consultant: [
    { value: 'dev_users', label: 'dev_users', columns: ['commercial_name', 'professional_email', 'is_active'] },
    { value: 'dev_consultant_profiles', label: 'dev_consultant_profiles', columns: ['bio', 'phone_commercial', 'instagram_handle', 'linkedin_url'] },
    { value: 'dev_consultant_private_data', label: 'dev_consultant_private_data', columns: ['full_name', 'nif', 'iban', 'address_private', 'monthly_salary', 'commission_rate', 'hiring_date'] },
  ],
  process: [
    { value: 'proc_instances', label: 'proc_instances', columns: ['external_ref', 'current_status', 'percent_complete'] },
  ],
  system: [],
}

// --- Types ---

interface TemplateVariable {
  id: string
  key: string
  label: string
  category: string
  source_entity: string
  source_table: string | null
  source_column: string | null
  format_type: string
  format_config: Record<string, unknown> | null
  static_value: string | null
  is_system: boolean
  is_active: boolean
  order_index: number
  created_at: string | null
  updated_at: string | null
}

interface VariableFormData {
  key: string
  label: string
  category: string
  source_entity: string
  source_table: string
  source_column: string
  format_type: string
  static_value: string
  concat_columns: string
  concat_separator: string
  is_active: boolean
  order_index: number
}

const defaultFormData: VariableFormData = {
  key: '',
  label: '',
  category: '',
  source_entity: '',
  source_table: '',
  source_column: '',
  format_type: 'text',
  static_value: '',
  concat_columns: '',
  concat_separator: ', ',
  is_active: true,
  order_index: 100,
}

// --- Main Page ---

export default function TemplatesVariaveisPage() {
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const debouncedSearch = useDebounce(search, 300)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVariable, setEditingVariable] = useState<TemplateVariable | null>(null)
  const [formData, setFormData] = useState<VariableFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<TemplateVariable | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchVariables = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ active_only: 'false' })
      const res = await fetch(`/api/libraries/variables?${params}`)
      if (res.ok) {
        const data = await res.json()
        setVariables(data)
      }
    } catch {
      toast.error('Erro ao carregar variáveis')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVariables()
  }, [fetchVariables])

  // Filtered list
  const filtered = variables.filter((v) => {
    const matchesSearch =
      !debouncedSearch ||
      v.key.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      v.label.toLowerCase().includes(debouncedSearch.toLowerCase())
    const matchesCategory =
      filterCategory === 'all' || v.category === filterCategory
    return matchesSearch && matchesCategory
  })

  // Open create dialog
  const handleCreate = () => {
    setEditingVariable(null)
    setFormData(defaultFormData)
    setDialogOpen(true)
  }

  // Open edit dialog
  const handleEdit = (variable: TemplateVariable) => {
    setEditingVariable(variable)

    const concatConfig = variable.format_config as { columns?: string[]; separator?: string } | null

    setFormData({
      key: variable.key,
      label: variable.label,
      category: variable.category,
      source_entity: variable.source_entity,
      source_table: variable.source_table || '',
      source_column: variable.source_column || '',
      format_type: variable.format_type,
      static_value: variable.static_value || '',
      concat_columns: concatConfig?.columns?.join(', ') || '',
      concat_separator: concatConfig?.separator || ', ',
      is_active: variable.is_active,
      order_index: variable.order_index,
    })
    setDialogOpen(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!formData.key || !formData.label || !formData.category || !formData.source_entity) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setSaving(true)
    try {
      // Build format_config
      let format_config: Record<string, unknown> | null = null
      if (formData.format_type === 'concat') {
        format_config = {
          columns: formData.concat_columns.split(',').map((c) => c.trim()).filter(Boolean),
          separator: formData.concat_separator,
        }
      } else if (formData.format_type === 'currency') {
        format_config = { currency: 'EUR', locale: 'pt-PT' }
      } else if (formData.format_type === 'date') {
        format_config = { locale: 'pt-PT', format: 'dd/MM/yyyy' }
      }

      const payload = {
        key: formData.key,
        label: formData.label,
        category: formData.category,
        source_entity: formData.source_entity,
        source_table: formData.source_table || null,
        source_column: formData.format_type === 'concat' ? null : (formData.source_column || null),
        format_type: formData.format_type,
        format_config,
        static_value: formData.source_entity === 'system' ? (formData.static_value || null) : null,
        is_active: formData.is_active,
        order_index: formData.order_index,
      }

      const isEditing = !!editingVariable
      const url = isEditing
        ? `/api/libraries/variables/${editingVariable.id}`
        : '/api/libraries/variables'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erro ao guardar')
        return
      }

      toast.success(isEditing ? 'Variável actualizada' : 'Variável criada')
      setDialogOpen(false)
      fetchVariables()
    } catch {
      toast.error('Erro ao guardar variável')
    } finally {
      setSaving(false)
    }
  }

  // Toggle active
  const handleToggleActive = async (variable: TemplateVariable) => {
    try {
      const res = await fetch(`/api/libraries/variables/${variable.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !variable.is_active }),
      })
      if (res.ok) {
        toast.success(variable.is_active ? 'Variável desactivada' : 'Variável activada')
        fetchVariables()
      }
    } catch {
      toast.error('Erro ao alterar estado')
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/libraries/variables/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erro ao eliminar')
        return
      }
      toast.success('Variável eliminada')
      setDeleteTarget(null)
      fetchVariables()
    } catch {
      toast.error('Erro ao eliminar variável')
    } finally {
      setDeleting(false)
    }
  }

  // Available tables/columns for current source_entity
  const availableTables = SOURCE_TABLES[formData.source_entity] || []
  const selectedTableDef = availableTables.find((t) => t.value === formData.source_table)
  const availableColumns = selectedTableDef?.columns || []

  const entityLabel = (entity: string) =>
    SOURCE_ENTITIES.find((e) => e.value === entity)?.label || entity

  const categoryLabel = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label || cat

  const formatLabel = (fmt: string) =>
    FORMAT_TYPES.find((f) => f.value === fmt)?.label || fmt

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Variáveis de Template</h1>
        <p className="text-muted-foreground">
          Gerir variáveis disponíveis nos templates de email e documentos
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar variáveis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Variável
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Braces}
          title="Nenhuma variável encontrada"
          description={
            search || filterCategory !== 'all'
              ? 'Ajuste os filtros ou a pesquisa.'
              : 'Crie a primeira variável de template.'
          }
          action={
            !search && filterCategory === 'all'
              ? { label: 'Criar Variável', onClick: handleCreate }
              : undefined
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Variável</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden md:table-cell">Entidade</TableHead>
                <TableHead className="hidden lg:table-cell">Tabela.Coluna</TableHead>
                <TableHead className="hidden md:table-cell">Formato</TableHead>
                <TableHead className="w-[80px]">Estado</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id} className={!v.is_active ? 'opacity-50' : ''}>
                  <TableCell className="text-xs text-muted-foreground">
                    {v.order_index}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                      {`{{${v.key}}}`}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{v.label}</span>
                      {v.is_system && (
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {categoryLabel(v.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {entityLabel(v.source_entity)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {v.source_table ? (
                      <code className="text-xs text-muted-foreground">
                        {v.source_table}
                        {v.source_column ? `.${v.source_column}` : ''}
                      </code>
                    ) : v.static_value ? (
                      <span className="text-xs text-muted-foreground italic">
                        &ldquo;{v.static_value}&rdquo;
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      {formatLabel(v.format_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {v.is_active ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 text-xs">
                        Activa
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Inactiva
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(v)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(v)}>
                          {v.is_active ? (
                            <>
                              <EyeOff className="mr-2 h-4 w-4" />
                              Desactivar
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Activar
                            </>
                          )}
                        </DropdownMenuItem>
                        {!v.is_system && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(v)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVariable ? 'Editar Variável' : 'Nova Variável'}
            </DialogTitle>
            <DialogDescription>
              {editingVariable
                ? 'Altere os dados da variável de template.'
                : 'Defina uma nova variável e aponte para a tabela/coluna de origem.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Key & Label */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Chave <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="proprietario_nif"
                  value={formData.key}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))
                  }
                  disabled={!!editingVariable?.is_system}
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  snake_case — usada como {`{{${formData.key || 'chave'}}}`}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Label <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="NIF do Proprietário"
                  value={formData.label}
                  onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                />
              </div>
            </div>

            {/* Category & Source Entity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Categoria <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Entidade de Origem <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.source_entity}
                  onValueChange={(v) =>
                    setFormData((p) => ({
                      ...p,
                      source_entity: v,
                      source_table: '',
                      source_column: '',
                      static_value: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_ENTITIES.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Format Type */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Formato</Label>
              <Select
                value={formData.format_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, format_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_TYPES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Table & Column — for non-system entities */}
            {formData.source_entity && formData.source_entity !== 'system' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tabela de Origem</Label>
                    <Select
                      value={formData.source_table}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, source_table: v, source_column: '' }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tabela..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTables.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.format_type !== 'concat' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Coluna</Label>
                      <Select
                        value={formData.source_column}
                        onValueChange={(v) =>
                          setFormData((p) => ({ ...p, source_column: v }))
                        }
                        disabled={!formData.source_table}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar coluna..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableColumns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Concat config */}
                {formData.format_type === 'concat' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Colunas (separadas por vírgula)</Label>
                      <Input
                        placeholder="address_street, city"
                        value={formData.concat_columns}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, concat_columns: e.target.value }))
                        }
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Separador</Label>
                      <Input
                        placeholder=", "
                        value={formData.concat_separator}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, concat_separator: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Static value — for system entities */}
            {formData.source_entity === 'system' && formData.format_type === 'text' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Valor Estático</Label>
                <Input
                  placeholder="Infinity Group"
                  value={formData.static_value}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, static_value: e.target.value }))
                  }
                />
                <p className="text-[10px] text-muted-foreground">
                  Valor fixo que será usado sempre (ex: nome da empresa)
                </p>
              </div>
            )}

            {/* Order & Active */}
            <div className="flex items-center gap-6 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Ordem</Label>
                <Input
                  type="number"
                  className="w-20"
                  value={formData.order_index}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, order_index: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData((p) => ({ ...p, is_active: v }))}
                />
                <Label className="text-xs">Activa</Label>
              </div>
            </div>

            {/* Preview */}
            {formData.key && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Pré-visualização</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-background px-2 py-0.5 rounded border">
                    {`{{${formData.key}}}`}
                  </code>
                  <span className="text-xs text-muted-foreground">&rarr;</span>
                  <span className="text-sm">
                    {formData.source_entity === 'system' && formData.static_value
                      ? formData.static_value
                      : formData.source_table && formData.source_column
                        ? `${formData.source_table}.${formData.source_column}`
                        : formData.format_type === 'concat' && formData.concat_columns
                          ? `concat(${formData.concat_columns})`
                          : '...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingVariable ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar variável</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar a variável{' '}
              <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">
                {`{{${deleteTarget?.key}}}`}
              </code>
              ? Templates que usem esta variável deixarão de a resolver automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
