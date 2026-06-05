'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { createProductSchema } from '@/lib/validations/encomenda'
import type { Product, ProductCategory, Supplier } from '@/types/encomenda'

type FormValues = z.input<typeof createProductSchema>

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: ProductCategory[]
  suppliers: Supplier[]
  product: Product | null
  onSubmit: (data: FormValues) => Promise<void> | void
}

export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  suppliers,
  product,
  onSubmit,
}: ProductFormDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      category_id: '',
      supplier_id: null,
      name: '',
      description: null,
      sku: null,
      unit_cost: null,
      sell_price: 0,
      is_personalizable: false,
      personalization_fields: [],
      is_property_linked: false,
      requires_approval: false,
      approval_threshold: null,
      min_stock_alert: 0,
      is_returnable: false,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'personalization_fields',
  })

  const isPersonalizable = form.watch('is_personalizable')
  const requiresApproval = form.watch('requires_approval')

  useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          category_id: product.category_id,
          supplier_id: product.supplier_id,
          name: product.name,
          description: product.description,
          sku: product.sku,
          unit_cost: product.unit_cost,
          sell_price: product.sell_price,
          is_personalizable: product.is_personalizable,
          personalization_fields: product.personalization_fields ?? [],
          is_property_linked: product.is_property_linked,
          requires_approval: product.requires_approval,
          approval_threshold: product.approval_threshold,
          min_stock_alert: product.min_stock_alert,
          is_returnable: product.is_returnable,
        })
      } else {
        form.reset({
          category_id: '',
          supplier_id: null,
          name: '',
          description: null,
          sku: null,
          unit_cost: null,
          sell_price: 0,
          is_personalizable: false,
          personalization_fields: [],
          is_property_linked: false,
          requires_approval: false,
          approval_threshold: null,
          min_stock_alert: 0,
          is_returnable: false,
        })
      }
    }
  }, [open, product, form])

  const handleSubmit = async (data: FormValues) => {
    try {
      await onSubmit(data)
      onOpenChange(false)
      toast.success(product ? 'Produto actualizado' : 'Produto criado com sucesso')
    } catch {
      toast.error('Erro ao guardar produto')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do produto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v || null)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar fornecedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Descricao</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descricao do produto"
                        rows={3}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="REF-001" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo unitario</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sell_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preco de venda *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_stock_alert"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alerta stock minimo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Toggles */}
            <div className="space-y-4 border rounded-lg p-4">
              <h4 className="text-sm font-medium">Opcoes</h4>

              <FormField
                control={form.control}
                name="is_personalizable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="mb-0">Personalizavel</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_property_linked"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="mb-0">Associado a imovel</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requires_approval"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="mb-0">Requer aprovacao</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {requiresApproval && (
                <FormField
                  control={form.control}
                  name="approval_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite de aprovacao automatica (EUR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Acima deste valor requer aprovacao"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="is_returnable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="mb-0">Retornavel</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Personalization fields */}
            {isPersonalizable && (
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Campos de personalizacao</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      append({ key: '', label: '', type: 'text', required: false })
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Adicionar campo
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum campo de personalizacao definido
                  </p>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-end border-b pb-3">
                    <div className="col-span-3">
                      <Label className="text-xs">Chave</Label>
                      <Input
                        placeholder="nome_campo"
                        {...form.register(`personalization_fields.${index}.key`)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Label</Label>
                      <Input
                        placeholder="Nome do Campo"
                        {...form.register(`personalization_fields.${index}.label`)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={form.watch(`personalization_fields.${index}.type`)}
                        onValueChange={(v) =>
                          form.setValue(`personalization_fields.${index}.type`, v as any)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="textarea">Texto longo</SelectItem>
                          <SelectItem value="select">Seleccao</SelectItem>
                          <SelectItem value="image">Imagem</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Checkbox
                        checked={form.watch(`personalization_fields.${index}.required`)}
                        onCheckedChange={(v) =>
                          form.setValue(`personalization_fields.${index}.required`, !!v)
                        }
                      />
                      <Label className="text-xs">Obrig.</Label>
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'A guardar...' : product ? 'Guardar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
