'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

import { useCompanyCategories } from './company-categories-provider'
import type { CompanyDocumentCategory } from '@/hooks/use-company-document-categories'

interface CompanyCategoryDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: CompanyDocumentCategory | null
  onDeleted?: () => void
}

export function CompanyCategoryDeleteDialog({
  open,
  onOpenChange,
  category,
  onDeleted,
}: CompanyCategoryDeleteDialogProps) {
  const { activeCategories, remove } = useCompanyCategories()
  const [needsReassign, setNeedsReassign] = useState(false)
  const [documentCount, setDocumentCount] = useState<number | null>(null)
  const [reassignTo, setReassignTo] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const resetState = useCallback(() => {
    setNeedsReassign(false)
    setDocumentCount(null)
    setReassignTo('')
    setBusy(false)
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (busy) return
      if (!next) resetState()
      onOpenChange(next)
    },
    [busy, onOpenChange, resetState]
  )

  const targetOptions = useMemo(
    () =>
      activeCategories.filter(
        (c) => c.is_active && c.id !== category?.id && c.slug !== category?.slug
      ),
    [activeCategories, category]
  )

  const handleConfirm = async () => {
    if (!category) return
    setBusy(true)
    try {
      const opts = needsReassign && reassignTo ? { reassignTo } : undefined
      await remove(category.id, opts)
      toast.success(
        opts
          ? `Documentos transferidos para "${targetOptions.find((c) => c.slug === opts.reassignTo)?.label ?? opts.reassignTo}" e categoria desactivada.`
          : 'Categoria eliminada'
      )
      onDeleted?.()
      resetState()
      onOpenChange(false)
    } catch (err) {
      const e = err as Error & { status?: number; documentCount?: number }
      if (e.status === 409 && typeof e.documentCount === 'number') {
        setDocumentCount(e.documentCount)
        setNeedsReassign(true)
        setBusy(false)
        return
      }
      toast.error(e.message || 'Erro ao eliminar categoria')
      setBusy(false)
    }
  }

  const confirmDisabled =
    busy || !category || (needsReassign && !reassignTo)

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {needsReassign ? 'Transferir documentos' : 'Eliminar categoria'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {needsReassign ? (
              <>
                A categoria <strong>{category?.label}</strong> contém{' '}
                <strong>
                  {documentCount} documento{documentCount === 1 ? '' : 's'}
                </strong>
                . Escolha uma categoria de destino para transferir antes de desactivar.
              </>
            ) : (
              <>
                Tem a certeza de que pretende eliminar a categoria{' '}
                <strong>{category?.label}</strong>? Esta acção pode ser revertida
                reactivando a categoria a partir da base de dados.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {needsReassign && (
          <div className="space-y-2 pt-2">
            <Label>Re-categorizar para</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger className="rounded-full">
                <SelectValue placeholder="Escolher categoria…" />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full" disabled={busy}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={confirmDisabled}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                A processar…
              </>
            ) : needsReassign ? (
              'Transferir e desactivar'
            ) : (
              'Eliminar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
