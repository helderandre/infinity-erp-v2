'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  LineChart,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface MarketStudy {
  id: string
  negocio_id: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  notes: string | null
  sent_at: string | null
  sent_via: 'email' | 'whatsapp' | 'manual' | null
  sent_to: string | null
  created_at: string
  creator?: { id: string; commercial_name: string | null } | null
}

function useMarketStudies(negocioId: string | null | undefined) {
  const [items, setItems] = useState<MarketStudy[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!negocioId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/market-studies`)
      if (res.ok) {
        const json = await res.json()
        setItems(json.data || [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [negocioId])

  useEffect(() => { void refetch() }, [refetch])

  return { items, isLoading, refetch }
}

interface MarketStudiesCardProps {
  negocioId: string
}

export function MarketStudiesCard({ negocioId }: MarketStudiesCardProps) {
  const { items, isLoading, refetch } = useMarketStudies(negocioId)
  const [open, setOpen] = useState(false)

  const total = items.length
  const sent = items.filter((s) => !!s.sent_at).length
  const pending = total - sent

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-2xl bg-muted/40 hover:bg-muted/60 transition-colors px-4 py-3 flex items-center gap-3 group"
      >
        <div className="h-9 w-9 rounded-full bg-background border border-border/40 flex items-center justify-center shrink-0">
          <LineChart className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Estudos de mercado
          </p>
          {isLoading ? (
            <Skeleton className="h-4 w-32 mt-1" />
          ) : total === 0 ? (
            <p className="text-sm font-medium mt-0.5">Nenhum criado</p>
          ) : (
            <p className="text-sm font-medium mt-0.5">
              {total} no total
              {sent > 0 && (
                <span className="text-muted-foreground font-normal"> · {sent} enviado{sent === 1 ? '' : 's'}</span>
              )}
              {pending > 0 && (
                <span className="text-muted-foreground font-normal"> · {pending} por enviar</span>
              )}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform" />
      </button>

      <ManagerDialog
        open={open}
        onOpenChange={setOpen}
        negocioId={negocioId}
        items={items}
        onRefetch={refetch}
      />
    </>
  )
}

// ─── Manager dialog ────────────────────────────────────────────────────

function ManagerDialog({
  open,
  onOpenChange,
  negocioId,
  items,
  onRefetch,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  negocioId: string
  items: MarketStudy[]
  onRefetch: () => Promise<void>
}) {
  const [uploading, setUploading] = useState(false)
  const [markSentFor, setMarkSentFor] = useState<MarketStudy | null>(null)
  const [deleteFor, setDeleteFor] = useState<MarketStudy | null>(null)

  const handleUpload = async (file: File, notes: string | null) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (notes) fd.append('notes', notes)
      const res = await fetch(`/api/negocios/${negocioId}/market-studies`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao enviar')
      }
      toast.success('Estudo de mercado adicionado')
      await onRefetch()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao adicionar estudo')
    } finally {
      setUploading(false)
    }
  }

  const handleMarkSent = async (
    s: MarketStudy,
    via: 'email' | 'whatsapp' | 'manual',
    to: string | null,
  ) => {
    try {
      const res = await fetch(`/api/negocios/${negocioId}/market-studies/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_sent: true, sent_via: via, sent_to: to }),
      })
      if (!res.ok) throw new Error()
      toast.success('Marcado como enviado')
      await onRefetch()
    } catch {
      toast.error('Erro ao marcar como enviado')
    }
  }

  const handleUnsent = async (s: MarketStudy) => {
    try {
      const res = await fetch(`/api/negocios/${negocioId}/market-studies/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_sent: false }),
      })
      if (!res.ok) throw new Error()
      toast.success('Marcado como não enviado')
      await onRefetch()
    } catch {
      toast.error('Erro')
    }
  }

  const handleDelete = async (s: MarketStudy) => {
    try {
      const res = await fetch(`/api/negocios/${negocioId}/market-studies/${s.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast.success('Estudo eliminado')
      await onRefetch()
    } catch {
      toast.error('Erro ao eliminar')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-muted-foreground" />
              Estudos de mercado
            </DialogTitle>
            <DialogDescription>
              Carregue PDFs/imagens com a análise comparativa e marque quando enviar ao proprietário.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
            <UploadRow uploading={uploading} onUpload={handleUpload} />

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                <FileText className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Sem estudos. Carregue o primeiro acima.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((s) => (
                  <StudyRow
                    key={s.id}
                    study={s}
                    onMarkSent={() => setMarkSentFor(s)}
                    onUnsent={() => handleUnsent(s)}
                    onDelete={() => setDeleteFor(s)}
                  />
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full ml-auto"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MarkSentDialog
        study={markSentFor}
        onClose={() => setMarkSentFor(null)}
        onConfirm={async (via, to) => {
          if (markSentFor) await handleMarkSent(markSentFor, via, to)
          setMarkSentFor(null)
        }}
      />

      <AlertDialog open={!!deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar estudo</AlertDialogTitle>
            <AlertDialogDescription>Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteFor) await handleDelete(deleteFor)
                setDeleteFor(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Upload row ────────────────────────────────────────────────────────

function UploadRow({
  uploading,
  onUpload,
}: {
  uploading: boolean
  onUpload: (file: File, notes: string | null) => Promise<void>
}) {
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      void onUpload(f, null)
      e.target.value = ''
    }
  }
  return (
    <label
      className={cn(
        'flex items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors',
        uploading && 'opacity-60 cursor-wait',
      )}
    >
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={uploading}
        onChange={onPick}
      />
      {uploading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {uploading ? 'A carregar…' : 'Carregar estudo'}
        </p>
        <p className="text-[11px] text-muted-foreground">PDF ou imagem · até 30MB</p>
      </div>
    </label>
  )
}

// ─── Study row ─────────────────────────────────────────────────────────

function StudyRow({
  study,
  onMarkSent,
  onUnsent,
  onDelete,
}: {
  study: MarketStudy
  onMarkSent: () => void
  onUnsent: () => void
  onDelete: () => void
}) {
  const isSent = !!study.sent_at
  return (
    <li className="rounded-xl border border-border/50 bg-background shadow-sm px-3 py-2.5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={study.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium truncate hover:underline"
            >
              {study.file_name}
            </a>
            {isSent && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-full px-2 py-0.5">
                <CheckCircle2 className="h-3 w-3" />
                Enviado
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
            <span>{format(new Date(study.created_at), "d 'de' MMM, HH:mm", { locale: pt })}</span>
            {study.creator?.commercial_name && (
              <span>· por {study.creator.commercial_name}</span>
            )}
            {study.sent_at && (
              <span>· enviado a {format(new Date(study.sent_at), "d 'de' MMM", { locale: pt })}{study.sent_via ? ` (${study.sent_via})` : ''}{study.sent_to ? ` para ${study.sent_to}` : ''}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2.5">
        {!isSent ? (
          <Button size="sm" className="rounded-full h-7 text-xs" onClick={onMarkSent}>
            <Send className="h-3 w-3 mr-1" />
            Marcar como enviado
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="rounded-full h-7 text-xs" onClick={onUnsent}>
            Desmarcar envio
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full h-7 w-7 p-0 ml-auto text-muted-foreground/50 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  )
}

// ─── Mark sent dialog (canal + destinatário) ───────────────────────────

function MarkSentDialog({
  study,
  onClose,
  onConfirm,
}: {
  study: MarketStudy | null
  onClose: () => void
  onConfirm: (via: 'email' | 'whatsapp' | 'manual', to: string | null) => Promise<void>
}) {
  const [via, setVia] = useState<'email' | 'whatsapp' | 'manual'>('manual')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (study) {
      setVia('manual')
      setTo('')
    }
  }, [study])

  return (
    <Dialog open={!!study} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Marcar como enviado</DialogTitle>
          <DialogDescription>
            Registo do envio ao proprietário (não envia automaticamente).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Canal</Label>
            <Select value={via} onValueChange={(v) => setVia(v as any)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="manual">Outro / pessoalmente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Destinatário (opcional)</Label>
            <Textarea
              className="rounded-xl"
              placeholder="Nome ou contacto do proprietário"
              rows={2}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onConfirm(via, to.trim() || null)
              setBusy(false)
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Marcar enviado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
