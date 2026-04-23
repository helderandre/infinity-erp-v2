'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import type { HydratedAcessosCustomSite } from '@/types/acessos'

interface CustomSiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: HydratedAcessosCustomSite | null
  defaultScope?: 'global' | 'personal'
  canManageGlobal: boolean
  onSaved: () => void
}

export function CustomSiteDialog({
  open, onOpenChange, initialData, defaultScope = 'personal',
  canManageGlobal, onSaved,
}: CustomSiteDialogProps) {
  const isEdit = !!initialData
  const isMobile = useIsMobile()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [scope, setScope] = useState<'global' | 'personal'>(defaultScope)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initialData) {
      setTitle(initialData.title)
      setUrl(initialData.url)
      setScope(initialData.scope as 'global' | 'personal')
    } else {
      setTitle('')
      setUrl('')
      setScope(defaultScope)
    }
  }, [open, initialData, defaultScope])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedUrl = url.trim()
    if (!trimmedTitle || !trimmedUrl) {
      toast.error('Título e URL são obrigatórios')
      return
    }
    setSubmitting(true)
    try {
      const endpoint = isEdit
        ? `/api/acessos/custom-sites/${initialData!.id}`
        : '/api/acessos/custom-sites'
      const method = isEdit ? 'PUT' : 'POST'
      const payload: Record<string, unknown> = {
        title: trimmedTitle,
        url: trimmedUrl,
      }
      if (!isEdit) payload.scope = scope

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao guardar')
      }
      toast.success(isEdit ? 'Site actualizado' : 'Site adicionado')
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao guardar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[468px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-0">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
              {isEdit ? 'Editar site' : 'Adicionar site'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {isEdit ? 'Edita os detalhes do site.' : 'Adiciona um novo site.'}
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-1 pb-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="site-title" className="text-xs font-medium text-muted-foreground">Título</Label>
              <Input
                id="site-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Notion"
                maxLength={80}
                autoFocus
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site-url" className="text-xs font-medium text-muted-foreground">URL</Label>
              <Input
                id="site-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="notion.so"
                autoComplete="off"
                className="rounded-xl"
              />
            </div>

            {canManageGlobal && !isEdit && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Visibilidade</Label>
                <ToggleGroup
                  type="single"
                  value={scope}
                  onValueChange={(v) => v && setScope(v as 'global' | 'personal')}
                  className="justify-start"
                >
                  <ToggleGroupItem value="personal" className="px-4 rounded-full">Pessoal</ToggleGroupItem>
                  <ToggleGroupItem value="global" className="px-4 rounded-full">Global</ToggleGroupItem>
                </ToggleGroup>
                <p className="text-[11px] text-muted-foreground/70">
                  {scope === 'personal'
                    ? 'Só tu vês este site.'
                    : 'Visível para toda a equipa.'}
                </p>
              </div>
            )}
          </div>

          <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full flex-1"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="rounded-full flex-1" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar' : 'Adicionar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
