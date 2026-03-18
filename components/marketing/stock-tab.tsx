'use client'

import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEncomendaStock } from '@/hooks/use-encomenda-stock'
import { useEncomendaProducts } from '@/hooks/use-encomenda-products'
import { formatCurrency } from '@/lib/constants'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Package, Plus, Loader2, Search, Trash2, Pencil, AlertTriangle
} from 'lucide-react'
import type { Product } from '@/types/encomenda'
import { cn } from '@/lib/utils'

const EMPTY_FORM = {
  name: '',
  category_id: '',
  sell_price: '',
  unit_cost: '',
  sku: '',
  description: '',
  min_stock_alert: '0',
  is_personalizable: false,
  is_returnable: false,
}

export function StockShopTab() {
  const { stock, loading: stockLoading, refetch: refetchStock } =
    useEncomendaStock()
  const { products, categories, loading: productsLoading, createProduct, updateProduct, deleteProduct } =
    useEncomendaProducts()

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Detail sheet
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null)

  // Search
  const [search, setSearch] = useState('')

  const loading = productsLoading || stockLoading

  const filteredProducts = products.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
  })

  const openCreate = () => {
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      name: product.name,
      category_id: product.category_id || '',
      sell_price: String(product.sell_price),
      unit_cost: product.unit_cost != null ? String(product.unit_cost) : '',
      sku: product.sku || '',
      description: product.description || '',
      min_stock_alert: String(product.min_stock_alert || 0),
      is_personalizable: product.is_personalizable,
      is_returnable: product.is_returnable,
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        category_id: form.category_id,
        sell_price: Number(form.sell_price),
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        sku: form.sku || null,
        description: form.description || null,
        min_stock_alert: Number(form.min_stock_alert) || 0,
        is_personalizable: form.is_personalizable,
        is_returnable: form.is_returnable,
      }
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload as any)
        toast.success('Produto actualizado com sucesso')
      } else {
        await createProduct(payload as any)
        toast.success('Produto criado com sucesso')
      }
      setFormOpen(false)
      setForm(EMPTY_FORM)
      setEditingProduct(null)
      refetchStock()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar produto')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProduct(deleteTarget.id)
      toast.success('Produto eliminado com sucesso')
      if (sheetProduct?.id === deleteTarget.id) setSheetProduct(null)
      setDeleteTarget(null)
      refetchStock()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao eliminar produto')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-full bg-muted/50 border-0 text-sm"
          />
        </div>
        <Button size="sm" className="rounded-full ml-auto" onClick={openCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Novo Produto
        </Button>
      </div>

      {/* ─── Products Table ─── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto encontrado"
          description={search ? 'Tente ajustar a pesquisa.' : 'Adicione o primeiro produto ao stock.'}
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Produto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Categoria</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">SKU</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Preço</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Custo</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Stock</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const totalStock = (product.stock || []).reduce((s, r) => s + r.quantity_available, 0)
                const minAlert = product.min_stock_alert || 0
                const isLow = minAlert > 0 && totalStock <= minAlert

                return (
                  <TableRow
                    key={product.id}
                    className="transition-colors duration-200 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSheetProduct(product)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.thumbnail_url ? (
                          <img src={product.thumbnail_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-sm font-medium truncate max-w-[200px]">{product.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5 bg-muted/50">
                        {product.category?.name || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{product.sku || '—'}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatCurrency(product.sell_price)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {product.unit_cost != null ? formatCurrency(product.unit_cost) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <span className={cn('text-sm font-bold', isLow ? 'text-red-500' : 'text-foreground')}>
                          {totalStock}
                        </span>
                        {isLow && <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.is_active ? (
                        <Badge className="rounded-full text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5 text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(product)}
                          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(product)}
                          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── Detail Sheet ─── */}
      <Sheet open={!!sheetProduct} onOpenChange={(open) => !open && setSheetProduct(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {sheetProduct && (() => {
            const totalStock = (sheetProduct.stock || []).reduce((s, r) => s + r.quantity_available, 0)
            const reserved = (sheetProduct.stock || []).reduce((s, r) => s + (r.quantity_reserved || 0), 0)
            const onOrder = (sheetProduct.stock || []).reduce((s, r) => s + (r.quantity_on_order || 0), 0)
            const minAlert = sheetProduct.min_stock_alert || 0
            const isLow = minAlert > 0 && totalStock <= minAlert

            return (
              <>
                <SheetHeader className="space-y-3">
                  {sheetProduct.thumbnail_url && (
                    <div className="relative aspect-video rounded-xl overflow-hidden -mx-2">
                      <img src={sheetProduct.thumbnail_url} alt={sheetProduct.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <SheetTitle className="text-lg">{sheetProduct.name}</SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-5">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="rounded-full text-[11px]">
                      {sheetProduct.category?.name || 'Sem categoria'}
                    </Badge>
                    {sheetProduct.sku && (
                      <Badge variant="outline" className="rounded-full text-[11px]">SKU: {sheetProduct.sku}</Badge>
                    )}
                    {sheetProduct.is_personalizable && (
                      <Badge variant="secondary" className="rounded-full text-[11px]">Personalizável</Badge>
                    )}
                    {sheetProduct.is_returnable && (
                      <Badge variant="secondary" className="rounded-full text-[11px]">Retornável</Badge>
                    )}
                    {!sheetProduct.is_active && (
                      <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">Inactivo</Badge>
                    )}
                  </div>

                  {/* Description */}
                  {sheetProduct.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{sheetProduct.description}</p>
                  )}

                  <Separator />

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Preço Venda</p>
                      <p className="text-lg font-bold">{formatCurrency(sheetProduct.sell_price)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Custo</p>
                      <p className="text-lg font-bold text-muted-foreground">
                        {sheetProduct.unit_cost != null ? formatCurrency(sheetProduct.unit_cost) : '—'}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Stock info */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Stock</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border bg-muted/20 p-3 text-center">
                        <p className={cn('text-xl font-bold', isLow ? 'text-red-500' : 'text-foreground')}>{totalStock}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Disponível</p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3 text-center">
                        <p className="text-xl font-bold text-amber-500">{reserved}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Reservado</p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3 text-center">
                        <p className="text-xl font-bold text-blue-500">{onOrder}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Em encomenda</p>
                      </div>
                    </div>
                    {minAlert > 0 && (
                      <div className={cn(
                        'mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg',
                        isLow ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400' : 'bg-muted/30 text-muted-foreground'
                      )}>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Alerta quando stock ≤ {minAlert}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full"
                      onClick={() => { openEdit(sheetProduct); setSheetProduct(null) }}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => { setDeleteTarget(sheetProduct); setSheetProduct(null) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* ─── Create / Edit Product Dialog ─── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                {editingProduct ? <Pencil className="h-5 w-5 text-white" /> : <Package className="h-5 w-5 text-white" />}
              </div>
              <div>
                <DialogTitle className="text-white">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                <p className="text-neutral-400 text-xs mt-0.5">
                  {editingProduct ? 'Actualizar dados do produto' : 'Adicionar produto ao stock'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input className="rounded-xl" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do produto" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Categoria *</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.is_active).map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Preço Venda (EUR) *</Label>
                <Input type="number" step="0.01" min="0" className="rounded-xl" value={form.sell_price} onChange={(e) => setForm(f => ({ ...f, sell_price: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Custo Unitário (EUR)</Label>
                <Input type="number" step="0.01" min="0" className="rounded-xl" value={form.unit_cost} onChange={(e) => setForm(f => ({ ...f, unit_cost: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">SKU</Label>
                <Input className="rounded-xl" value={form.sku} onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="ABC-001" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Alerta Stock Min.</Label>
                <Input type="number" min="0" className="rounded-xl" value={form.min_stock_alert} onChange={(e) => setForm(f => ({ ...f, min_stock_alert: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea className="rounded-xl" rows={2} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição do produto..." />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_personalizable} onChange={(e) => setForm(f => ({ ...f, is_personalizable: e.target.checked }))} className="rounded border-gray-300 h-3.5 w-3.5" />
                <span className="text-xs">Personalizável</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_returnable} onChange={(e) => setForm(f => ({ ...f, is_returnable: e.target.checked }))} className="rounded border-gray-300 h-3.5 w-3.5" />
                <span className="text-xs">Retornável</span>
              </label>
            </div>
          </div>

          <DialogFooter className="shrink-0 px-6 pb-6 pt-3 border-t gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button className="rounded-full" onClick={handleSave} disabled={saving || !form.name || !form.category_id || !form.sell_price}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? 'Guardar' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar <strong>{deleteTarget?.name}</strong>? Esta acção irá desactivar o produto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
