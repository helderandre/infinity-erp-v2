'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar site' : 'Adicionar site'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="site-title">Título</Label>
            <Input
              id="site-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Notion"
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-url">URL</Label>
            <Input
              id="site-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="notion.so"
              autoComplete="off"
            />
          </div>

          {canManageGlobal && !isEdit && (
            <div className="space-y-1.5">
              <Label>Visibilidade</Label>
              <ToggleGroup
                type="single"
                value={scope}
                onValueChange={(v) => v && setScope(v as 'global' | 'personal')}
                className="justify-start"
              >
                <ToggleGroupItem value="personal" className="px-4">Pessoal</ToggleGroupItem>
                <ToggleGroupItem value="global" className="px-4">Global</ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {scope === 'personal'
                  ? 'Só tu vês este site.'
                  : 'Visível para toda a equipa.'}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
