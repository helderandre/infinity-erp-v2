'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Building2,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Undo2,
  X,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  useNegocioProposals,
  type NegocioProposal,
  type ProposalStatus,
} from '@/hooks/use-negocio-proposals'
import { DealDialog } from '@/components/deals/deal-dialog'

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const STATUS_META: Record<ProposalStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pendente', bg: 'bg-amber-500/15', text: 'text-amber-600' },
  accepted: { label: 'Aceite', bg: 'bg-emerald-500/15', text: 'text-emerald-600' },
  rejected: { label: 'Rejeitada', bg: 'bg-red-500/15', text: 'text-red-600' },
  withdrawn: { label: 'Retirada', bg: 'bg-slate-500/15', text: 'text-slate-600' },
}

interface DossierItem {
  id: string // negocio_property_id
  property_id: string | null
  title: string
  external_ref: string | null
  listing_price: number | null
}

interface NegocioProposalsTabProps {
  negocioId: string
}

export function NegocioProposalsTab({ negocioId }: NegocioProposalsTabProps) {
  const { proposals, isLoading, create, update, remove, refetch } = useNegocioProposals(negocioId)

  const [dossier, setDossier] = useState<DossierItem[]>([])
  const [acceptingProposal, setAcceptingProposal] = useState<NegocioProposal | null>(null)
  const [negocioLead, setNegocioLead] = useState<{
    name: string | null
    email: string | null
    phone: string | null
  } | null>(null)

  // Quando o utilizador clica "Aceitar", carrega o lead do negócio para
  // pré-preencher clients[0] do DealForm.
  useEffect(() => {
    if (!acceptingProposal) {
      setNegocioLead(null)
      return
    }
    let cancelled = false
    async function loadLead() {
      try {
        const res = await fetch(`/api/negocios/${negocioId}`)
        if (!res.ok) return
        const json = await res.json()
        const lead = json?.lead
        if (!cancelled && lead) {
          setNegocioLead({
            name: lead.nome || lead.full_name || null,
            email: lead.email || null,
            phone: lead.telemovel || lead.telefone || null,
          })
        }
      } catch {
        /* silent */
      }
    }
    loadLead()
    return () => {
      cancelled = true
    }
  }, [acceptingProposal, negocioId])

  // Carrega o dossier para o picker do diálogo de criação.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/negocios/${negocioId}/properties`)
        if (!res.ok) return
        const json = await res.json()
        const items: DossierItem[] = (json.data || [])
          .filter((ap: any) => ap.property_id && ap.property)
          .map((ap: any) => ({
            id: ap.id,
            property_id: ap.property_id,
            title: ap.property?.title || 'Imóvel',
            external_ref: ap.property?.external_ref || null,
            listing_price: ap.property?.listing_price ?? null,
          }))
        if (!cancelled) setDossier(items)
      } catch {
        /* silent */
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [negocioId])

  const [createOpen, setCreateOpen] = useState(false)
  const [rejectFor, setRejectFor] = useState<NegocioProposal | null>(null)
  const [deleteFor, setDeleteFor] = useState<NegocioProposal | null>(null)

  const sorted = useMemo(() => {
    // Pendentes primeiro, depois aceites, depois rejeitadas/retiradas
    const order: Record<ProposalStatus, number> = { pending: 0, accepted: 1, rejected: 2, withdrawn: 3 }
    return [...proposals].sort((a, b) => {
      const oa = order[a.status]
      const ob = order[b.status]
      if (oa !== ob) return oa - ob
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [proposals])

  if (isLoading && proposals.length === 0) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {proposals.length === 0
            ? 'Sem propostas registadas'
            : `${proposals.length} ${proposals.length === 1 ? 'proposta' : 'propostas'}`}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full h-8 text-xs"
          onClick={() => setCreateOpen(true)}
          disabled={dossier.length === 0}
          title={dossier.length === 0 ? 'Adicione imóveis ao dossier primeiro' : undefined}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nova proposta
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-8 flex flex-col items-center text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">Sem propostas</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
            Quando fizeres uma proposta para um imóvel do dossier, fica registada aqui com o estado actual.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((p) => (
            <ProposalRow
              key={p.id}
              proposal={p}
              onAccept={() => setAcceptingProposal(p)}
              onReject={() => setRejectFor(p)}
              onWithdraw={async () => {
                await update(p.id, { status: 'withdrawn' })
              }}
              onReopen={async () => {
                await update(p.id, { status: 'pending' })
              }}
              onDelete={() => setDeleteFor(p)}
            />
          ))}
        </ul>
      )}

      <CreateProposalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        dossier={dossier}
        onCreate={async (input) => {
          const created = await create(input)
          if (created) setCreateOpen(false)
        }}
      />

      <RejectProposalDialog
        proposal={rejectFor}
        onOpenChange={(o) => !o && setRejectFor(null)}
        onConfirm={async (reason) => {
          if (!rejectFor) return
          await update(rejectFor.id, { status: 'rejected', rejected_reason: reason })
          setRejectFor(null)
        }}
      />

      <AlertDialog open={!!deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proposta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteFor) await remove(deleteFor.id)
                setDeleteFor(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Accept flow — abre o DealForm com propertyContext da proposta.
          Após criar o deal, marca a proposta como 'accepted' e regista o deal_id. */}
      <DealDialog
        open={!!acceptingProposal}
        onOpenChange={(o) => !o && setAcceptingProposal(null)}
        propertyContext={
          acceptingProposal && acceptingProposal.property
            ? {
                id: acceptingProposal.property.id,
                title: acceptingProposal.property.title || 'Imóvel',
                external_ref: acceptingProposal.property.external_ref ?? null,
                listing_price:
                  acceptingProposal.amount ??
                  acceptingProposal.property.listing_price ??
                  null,
                city: acceptingProposal.property.city ?? null,
              }
            : undefined
        }
        negocioContext={
          acceptingProposal
            ? {
                id: acceptingProposal.negocio_id,
                leadName: negocioLead?.name ?? null,
                leadEmail: negocioLead?.email ?? null,
                leadPhone: negocioLead?.phone ?? null,
              }
            : undefined
        }
        onComplete={async (dealId) => {
          if (acceptingProposal) {
            await update(acceptingProposal.id, {
              status: 'accepted',
              deal_id: dealId,
            })
            await refetch()
          }
          setAcceptingProposal(null)
        }}
      />
    </div>
  )
}

// ─── Row ───────────────────────────────────────────────────────────────

function ProposalRow({
  proposal,
  onAccept,
  onReject,
  onWithdraw,
  onReopen,
  onDelete,
}: {
  proposal: NegocioProposal
  onAccept?: (proposal: NegocioProposal) => void
  onReject: () => void
  onWithdraw: () => void
  onReopen: () => void
  onDelete: () => void
}) {
  const status = STATUS_META[proposal.status]
  const propTitle = proposal.property?.title || 'Imóvel'
  const propMeta = [proposal.property?.external_ref, proposal.property?.city]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{propTitle}</p>
            <span
              className={cn(
                'inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full',
                status.bg,
                status.text,
              )}
            >
              {status.label}
            </span>
            {proposal.amount != null && (
              <span className="ml-auto text-sm font-semibold tabular-nums">
                {eur.format(proposal.amount)}
              </span>
            )}
          </div>
          {propMeta && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{propMeta}</p>
          )}
          {proposal.notes && (
            <p className="text-xs text-muted-foreground/90 mt-1 leading-relaxed">
              {proposal.notes}
            </p>
          )}
          {proposal.status === 'rejected' && proposal.rejected_reason && (
            <p className="text-[11px] text-red-600/90 mt-1">
              <span className="font-medium">Motivo:</span> {proposal.rejected_reason}
            </p>
          )}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2 flex-wrap">
            <span>
              {format(new Date(proposal.created_at), "d 'de' MMM, HH:mm", { locale: pt })}
            </span>
            {proposal.creator?.commercial_name && (
              <span>· por {proposal.creator.commercial_name}</span>
            )}
            {proposal.deal_id && (
              <a
                href={`/dashboard/financeiro/deals/${proposal.deal_id}`}
                className="ml-auto text-primary hover:underline inline-flex items-center gap-1"
              >
                Ver deal <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-0">
        {proposal.status === 'pending' && (
          <>
            <Button
              size="sm"
              className="rounded-full h-7 text-xs"
              onClick={() => onAccept?.(proposal)}
              disabled={!onAccept}
              title={onAccept ? 'Aceitar e abrir formulário de fecho' : 'Aceitar (em construção)'}
            >
              <Check className="h-3 w-3 mr-1" />
              Aceitar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-7 text-xs"
              onClick={onReject}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Rejeitar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full h-7 text-xs"
              onClick={onWithdraw}
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Retirar
            </Button>
          </>
        )}
        {(proposal.status === 'rejected' || proposal.status === 'withdrawn') && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full h-7 text-xs"
            onClick={onReopen}
          >
            <Undo2 className="h-3 w-3 mr-1" />
            Reabrir
          </Button>
        )}
        {proposal.status === 'accepted' && proposal.deal_id && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Convertida em deal
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full h-7 w-7 p-0 ml-auto text-muted-foreground/50 hover:text-destructive"
          onClick={onDelete}
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  )
}

// ─── Create dialog ─────────────────────────────────────────────────────

function CreateProposalDialog({
  open,
  onOpenChange,
  dossier,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  dossier: DossierItem[]
  onCreate: (input: { negocio_property_id: string; amount: number | null; notes: string | null }) => Promise<void>
}) {
  const [npId, setNpId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setNpId(dossier[0]?.id || '')
      setAmount('')
      setNotes('')
    }
  }, [open, dossier])

  // Auto-preencher amount com listing_price ao escolher imóvel.
  useEffect(() => {
    const selected = dossier.find((d) => d.id === npId)
    if (selected?.listing_price && !amount) {
      setAmount(String(selected.listing_price))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Nova proposta</DialogTitle>
          <DialogDescription>
            Registar uma proposta feita para um imóvel do dossier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Imóvel *</Label>
            <Select value={npId} onValueChange={setNpId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {dossier.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.external_ref ? `${d.external_ref} — ` : ''}{d.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Valor (€)</Label>
            <Input
              type="number"
              className="rounded-xl"
              placeholder="Ex.: 350000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Pré-preenchido com o preço de listagem; ajusta para o valor da proposta.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Notas</Label>
            <Textarea
              className="rounded-xl"
              placeholder="Condições, prazos, comentários..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={busy || !npId}
            onClick={async () => {
              if (!npId) return
              setBusy(true)
              await onCreate({
                negocio_property_id: npId,
                amount: amount ? Number(amount) : null,
                notes: notes.trim() || null,
              })
              setBusy(false)
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Reject dialog ─────────────────────────────────────────────────────

function RejectProposalDialog({
  proposal,
  onOpenChange,
  onConfirm,
}: {
  proposal: NegocioProposal | null
  onOpenChange: (o: boolean) => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (proposal) setReason('')
  }, [proposal])

  return (
    <Dialog open={!!proposal} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Rejeitar proposta</DialogTitle>
          <DialogDescription>
            Indica o motivo. Fica registado para o histórico do negócio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-xs font-medium">Motivo</Label>
          <Textarea
            className="rounded-xl"
            placeholder="Ex.: contraproposta acima do orçamento"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onConfirm(reason.trim())
              setBusy(false)
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Rejeitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
