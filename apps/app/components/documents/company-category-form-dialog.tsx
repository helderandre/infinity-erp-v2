'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { FormSheet } from '@/components/shared/form-sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { CATEGORY_ICON_PRESETS } from './company-category-icons'
import { useCompanyCategories } from './company-categories-provider'
import type { CompanyDocumentCategory } from '@/hooks/use-company-document-categories'

interface CompanyCategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: CompanyDocumentCategory | null
  onSaved?: (slug: string) => void
}

export function CompanyCategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: CompanyCategoryFormDialogProps) {
  const { create, update } = useCompanyCategories()
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState<string>('Folder')
  const [color, setColor] = useState('')
  const [saving, setSaving] = useState(false)

  const mode = category ? 'edit' : 'create'

  useEffect(() => {
    if (!open) return
    setLabel(category?.label ?? '')
    setIcon(category?.icon ?? 'Folder')
    setColor(category?.color ?? '')
  }, [open, category])

  const canSubmit = !saving && label.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const payload = {
        label: label.trim(),
        icon: icon || null,
        color: color.trim() || null,
      }
      let result: CompanyDocumentCategory
      if (mode === 'edit' && category) {
        result = await update(category.id, payload)
        toast.success('Categoria actualizada')
      } else {
        result = await create(payload)
        toast.success('Categoria criada')
      }
      onSaved?.(result.slug)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar categoria')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      title={mode === 'edit' ? 'Editar categoria' : 'Nova categoria'}
      description={
        mode === 'edit'
          ? 'O identificador interno (slug) é imutável. Apenas o nome e metadados podem ser alterados.'
          : 'Organize os documentos da empresa por categoria.'
      }
      footer={
        <>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                A guardar…
              </>
            ) : mode === 'edit' ? (
              'Guardar'
            ) : (
              'Criar'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Jurídico"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_ICON_PRESETS.map(({ name, Icon, label: iconLabel }) => {
                const selected = icon === name
                return (
                  <button
                    key={name}
                    type="button"
                    title={iconLabel}
                    onClick={() => setIcon(name)}
                    className={cn(
                      'aspect-square rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all',
                      'hover:bg-muted/60',
                      selected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : 'border-border bg-transparent'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5',
                        selected ? 'text-primary' : 'text-muted-foreground'
                      )}
                      style={
                        selected && color
                          ? { color }
                          : !selected && color
                          ? { color }
                          : undefined
                      }
                    />
                    <span className="text-[9px] text-muted-foreground leading-none">
                      {iconLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                title="Cor do ícone"
                aria-label="Cor do ícone"
                value={color || '#64748b'}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 rounded-md border cursor-pointer bg-transparent"
              />
              {color && (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:underline"
                  onClick={() => setColor('')}
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
      </div>
    </FormSheet>
  )
}
