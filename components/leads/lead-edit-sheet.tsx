'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Loader2, Trash2, AlertTriangle, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import type { LeadWithAgent } from '@/types/lead'

interface LeadEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadWithAgent
  onSaved?: (next: Record<string, unknown>) => void
  /** Triggered when the user wants to refer this contact to another consultant.
   *  Closes the sheet first, then the parent opens the ReferenciarDialog. */
  onReferenciar?: () => void
}

/**
 * Quick-edit sheet for the basic identity fields of a contact (lead).
 * Fuller editing lives in the Dados sheet — this is the lightweight one
 * for fixing typos / updating phone / email on the fly.
 *
 * Also exposes a permanent delete action that cascades to all related
 * data (negocios, observações, anexos, etc. — see the SQL FK rules).
 */
export function LeadEditSheet({ open, onOpenChange, lead, onSaved, onReferenciar }: LeadEditSheetProps) {
  const isMobile = useIsMobile()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    telemovel: '',
  })

  useEffect(() => {
    if (open) {
      setForm({
        nome: (lead.nome as string) ?? '',
        email: (lead.email as string) ?? '',
        telemovel: (lead.telemovel as string) ?? '',
      })
    }
  }, [open, lead])

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        nome: form.nome.trim(),
        email: form.email.trim() || null,
        telemovel: form.telemovel.trim() || null,
      }
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao guardar')
      }
      toast.success('Contacto actualizado')
      onSaved?.(body)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao eliminar')
      }
      toast.success('Contacto eliminado')
      setDeleteOpen(false)
      onOpenChange(false)
      router.push('/dashboard/leads')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <SheetTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-5 w-5" />
            Edição rápida
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Edite a informação básica. Para mais detalhes use o botão Dados.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lead-edit-nome">Nome *</Label>
              <Input
                id="lead-edit-nome"
                value={form.nome}
                onChange={(e) => update('nome', e.target.value)}
                placeholder="Nome completo"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-edit-email">Email</Label>
              <Input
                id="lead-edit-email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="exemplo@dominio.pt"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-edit-telemovel">Telemóvel</Label>
              <Input
                id="lead-edit-telemovel"
                type="tel"
                value={form.telemovel}
                onChange={(e) => update('telemovel', e.target.value)}
                placeholder="+351 9XX XXX XXX"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Referenciar — secondary action, glass card matching the rest */}
          {onReferenciar && (
            <button
              type="button"
              onClick={onReferenciar}
              disabled={submitting || deleting}
              className="group w-full inline-flex items-center gap-3 rounded-2xl bg-card border border-border/50 shadow-sm p-3 transition-all hover:bg-card/80 hover:shadow-md disabled:opacity-50"
            >
              <span className="h-9 w-9 shrink-0 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center transition-colors group-hover:bg-cyan-500/15">
                <Send className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-sm font-medium text-foreground">Referenciar a outro consultor</span>
                <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Transfere o contacto e mantém a tua percentagem de comissão
                </span>
              </span>
            </button>
          )}

          {/* Danger zone — permanent delete */}
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Eliminar contacto</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Acção <span className="font-semibold">irreversível</span>. Apaga também todas as oportunidades, observações, anexos, automatismos e referências associadas a este contacto.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              disabled={submitting || deleting}
              className="w-full rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive h-8 text-xs"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Eliminar definitivamente
            </Button>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting} className="min-w-[120px]">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Eliminar {lead.nome ?? 'contacto'}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">Esta acção é <span className="font-semibold text-foreground">irreversível</span> e elimina permanentemente:</span>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              <li>Todas as oportunidades / negócios</li>
              <li>Observações, notas e perfil IA</li>
              <li>Anexos e documentos</li>
              <li>Automatismos agendados</li>
              <li>Referências a este contacto</li>
            </ul>
            <span className="block text-xs">As visitas e propostas associadas ficarão sem ligação a este contacto (não serão apagadas).</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full" disabled={deleting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A eliminar…
              </>
            ) : (
              'Eliminar definitivamente'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
