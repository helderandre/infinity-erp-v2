// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Plus, Package, Zap, MoreHorizontal, Pencil, Trash2, Search,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { CatalogFormDialog } from '@/components/marketing/catalog-form-dialog'
import { ProductFormDialog } from '@/components/encomendas/product-form-dialog'

type Tab = 'services' | 'products'

const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

export default function CatalogoManagementPage() {
  const [tab, setTab] = useState<Tab>('services')
  const [search, setSearch] = useState('')

  // Data
  const [services, setServices] = useState<any[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  // Dialogs
  const [serviceFormOpen, setServiceFormOpen] = useState(false)
  const [editingService, setEditingService] = useState<any>(null)
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'service' | 'product' | 'addon'; id: string; parentId?: string; name: string } | null>(null)

  // Fetchers
  const fetchServices = useCallback(async () => {
    setServicesLoading(true)
    try {
      const res = await fetch('/api/marketing/catalog')
      const data = await res.json()
      setServices(Array.isArray(data) ? data : data.data || [])
    } catch { /* */ }
    finally { setServicesLoading(false) }
  }, [])

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const res = await fetch('/api/encomendas/products')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : data.data || [])
    } catch { /* */ }
    finally { setProductsLoading(false) }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/encomendas/suppliers?active=true')
      const data = await res.json()
      setSuppliers(Array.isArray(data) ? data : data.data || [])
    } catch { /* */ }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/encomendas/categories')
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : data.data || [])
    } catch { /* */ }
  }, [])

  useEffect(() => { fetchServices(); fetchProducts(); fetchSuppliers(); fetchCategories() }, [fetchServices, fetchProducts, fetchSuppliers, fetchCategories])

  // Service CRUD
  const handleServiceSubmit = async (data: any) => {
    const isEdit = !!editingService
    const url = isEdit ? `/api/marketing/catalog/${editingService.id}` : '/api/marketing/catalog'
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro') }
    toast.success(isEdit ? 'Serviço actualizado' : 'Serviço criado')
    setServiceFormOpen(false)
    setEditingService(null)
    fetchServices()
  }

  // Product CRUD
  const handleProductSubmit = async (data: any) => {
    const isEdit = !!editingProduct
    const url = isEdit ? `/api/encomendas/products/${editingProduct.id}` : '/api/encomendas/products'
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro') }
    toast.success(isEdit ? 'Material actualizado' : 'Material criado')
    setProductFormOpen(false)
    setEditingProduct(null)
    fetchProducts()
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      let url = ''
      if (deleteConfirm.type === 'service') url = `/api/marketing/catalog/${deleteConfirm.id}`
      else if (deleteConfirm.type === 'addon') url = `/api/marketing/catalog/${deleteConfirm.parentId}/addons/${deleteConfirm.id}`
      else url = `/api/encomendas/products/${deleteConfirm.id}`

      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Eliminado com sucesso')
      fetchServices()
      fetchProducts()
    } catch { toast.error('Erro ao eliminar') }
    finally { setDeleteConfirm(null) }
  }

  // Filtered data
  const filteredServices = services.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()))
  const filteredProducts = products.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()))

  const loading = tab === 'products' ? productsLoading : servicesLoading

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Gestão de Catálogo</h1>
              <p className="text-neutral-400 mt-1 text-sm">Serviços, add-ons e materiais da Infinity Store</p>
            </div>
            <Button
              size="sm"
              className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25 gap-1.5 text-xs"
              onClick={() => {
                if (tab === 'products') { setEditingProduct(null); setProductFormOpen(true) }
                else { setEditingService(null); setServiceFormOpen(true) }
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {tab === 'products' ? 'Novo Material' : 'Novo Serviço'}
            </Button>
          </div>

          <div className="mt-5 inline-flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
            {([
              ['services', 'Serviços', Zap],
              ['products', 'Materiais', Package],
            ] as [Tab, string, any][]).map(([key, label, Icon]) => (
              <button key={key} onClick={() => { setTab(key); setSearch('') }}
                className={cn('inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300',
                  tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="h-3.5 w-3.5" />{label}
                <span className="text-[10px] opacity-60 ml-1">
                  {key === 'services' ? services.length : products.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={`Pesquisar...`} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
      </div>

      {/* ═══ Services ═══ */}
      {tab === 'services' && (
        loading ? <TableSkeleton /> : filteredServices.length === 0 ? (
          <EmptyState icon={Zap} title="Sem serviços" description="Adicione o primeiro serviço ao catálogo."
            action={{ label: 'Novo Serviço', onClick: () => { setEditingService(null); setServiceFormOpen(true) } }} />
        ) : (
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/20">
                <TableHead className="w-14">Img</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-center">Add-ons</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow></TableHeader>
              <TableBody>
                {filteredServices.map((svc: any) => (
                  <TableRow key={svc.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setEditingService(svc); setServiceFormOpen(true) }}>
                    <TableCell>
                      {svc.thumbnail_url
                        ? <img src={svc.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        : <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Zap className="h-4 w-4 text-muted-foreground" /></div>}
                    </TableCell>
                    <TableCell className="font-medium">{svc.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{svc.category || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{fmtCurrency(svc.base_price || svc.price || 0)}</TableCell>
                    <TableCell className="text-center"><Badge variant="secondary" className="rounded-full text-[10px]">{svc.addons?.length || 0}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={svc.is_active ? 'default' : 'secondary'} className="text-[10px] rounded-full">{svc.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem className="text-xs gap-2" onClick={() => { setEditingService(svc); setServiceFormOpen(true) }}>
                            <Pencil className="h-3 w-3" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-xs gap-2 text-destructive" onClick={() => setDeleteConfirm({ type: 'service', id: svc.id, name: svc.name })}>
                            <Trash2 className="h-3 w-3" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* ═══ Products ═══ */}
      {tab === 'products' && (
        loading ? <TableSkeleton /> : filteredProducts.length === 0 ? (
          <EmptyState icon={Package} title="Sem materiais" description="Adicione o primeiro material ao catálogo."
            action={{ label: 'Novo Material', onClick: () => { setEditingProduct(null); setProductFormOpen(true) } }} />
        ) : (
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/20">
                <TableHead className="w-14">Img</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-center">Variantes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow></TableHeader>
              <TableBody>
                {filteredProducts.map((prod: any) => (
                  <TableRow key={prod.id} className="hover:bg-muted/30">
                    <TableCell>
                      {prod.thumbnail_url
                        ? <img src={prod.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        : <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                    </TableCell>
                    <TableCell className="font-medium">{prod.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{prod.category?.name || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{fmtCurrency(prod.base_price || 0)}</TableCell>
                    <TableCell className="text-center"><Badge variant="secondary" className="rounded-full text-[10px]">{prod.variants?.length || 0}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={prod.is_active ? 'default' : 'secondary'} className="text-[10px] rounded-full">{prod.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem className="text-xs gap-2" onClick={() => { setEditingProduct(prod); setProductFormOpen(true) }}>
                            <Pencil className="h-3 w-3" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-xs gap-2 text-destructive" onClick={() => setDeleteConfirm({ type: 'product', id: prod.id, name: prod.name })}>
                            <Trash2 className="h-3 w-3" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* Service Form Dialog */}
      <CatalogFormDialog
        open={serviceFormOpen}
        onOpenChange={(open) => { setServiceFormOpen(open); if (!open) setEditingService(null) }}
        item={editingService}
        onSubmit={handleServiceSubmit}
      />

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={productFormOpen}
        onOpenChange={(open) => { setProductFormOpen(open); if (!open) setEditingProduct(null) }}
        product={editingProduct}
        categories={categories}
        suppliers={suppliers}
        onSubmit={handleProductSubmit}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {deleteConfirm?.type === 'service' ? 'serviço' : deleteConfirm?.type === 'addon' ? 'add-on' : 'material'}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar "{deleteConfirm?.name}"? Esta acção pode ser irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="rounded-2xl border p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
    </div>
  )
}
