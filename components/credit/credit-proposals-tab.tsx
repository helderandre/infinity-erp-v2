'use client'

import { useState } from 'react'
import { Plus, BarChart3, Pencil, Trash2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PROPOSAL_STATUS_COLORS } from '@/lib/constants'
import type { CreditProposal, CreditBank } from '@/types/credit'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CreditProposalForm } from './credit-proposal-form'
import { CreditProposalComparison } from './credit-proposal-comparison'

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return '-'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
}

const formatPercent = (value: number | null | undefined) => {
  if (value == null) return '-'
  return `${value.toFixed(2)}%`
}

interface CreditProposalsTabProps {
  creditId: string
  proposals: CreditProposal[]
  onRefresh: () => void
  banks?: CreditBank[]
  onAdd?: (data: Record<string, unknown>) => Promise<void>
  onUpdate?: (proposalId: string, data: Record<string, unknown>) => Promise<void>
  onDelete?: (proposalId: string) => Promise<void>
  onSelect?: (proposalId: string) => Promise<void>
}

export function CreditProposalsTab({
  creditId,
  proposals,
  onRefresh,
  banks = [],
  onAdd,
  onUpdate,
  onDelete,
  onSelect,
}: CreditProposalsTabProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingProposal, setEditingProposal] = useState<CreditProposal | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const approvedProposals = proposals.filter(
    (p) => p.status === 'aprovada' || p.status === 'pre_aprovada' || p.status === 'aceite'
  )
  const canCompare = approvedProposals.length >= 2

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true)
    try {
      if (editingProposal && onUpdate) {
        await onUpdate(editingProposal.id, data)
        toast.success('Proposta actualizada com sucesso')
      } else if (onAdd) {
        await onAdd(data)
        toast.success('Proposta adicionada com sucesso')
      }
      setFormOpen(false)
      setEditingProposal(null)
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar proposta')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId || !onDelete) return
    try {
      await onDelete(deleteId)
      toast.success('Proposta eliminada com sucesso')
      setDeleteId(null)
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar proposta')
    }
  }

  const handleSelect = async (proposalId: string) => {
    if (!onSelect) return
    try {
      await onSelect(proposalId)
      toast.success('Proposta seleccionada com sucesso')
      setComparisonOpen(false)
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao seleccionar proposta')
    }
  }

  const handleEdit = (proposal: CreditProposal) => {
    setEditingProposal(proposal)
    setFormOpen(true)
  }

  const handleFormClose = (open: boolean) => {
    setFormOpen(open)
    if (!open) setEditingProposal(null)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            {proposals.length} {proposals.length === 1 ? 'proposta' : 'propostas'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {canCompare && (
            <Button variant="outline" size="sm" onClick={() => setComparisonOpen(true)}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Comparar
            </Button>
          )}
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Proposta
          </Button>
        </div>
      </div>

      {/* Proposals list */}
      {proposals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma proposta registada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Adicione propostas dos bancos para comparar condições.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {proposals.map((proposal) => {
            const statusConfig = PROPOSAL_STATUS_COLORS[proposal.status]
            return (
              <Card
                key={proposal.id}
                className={cn(
                  'transition-colors',
                  proposal.is_selected && 'border-primary ring-1 ring-primary/20'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: bank info + badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-sm truncate">{proposal.banco}</h4>
                        {proposal.is_selected && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Star className="h-3 w-3 fill-current" />
                            Seleccionada
                          </span>
                        )}
                        {statusConfig && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                              statusConfig.bg,
                              statusConfig.text
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', statusConfig.dot)} />
                            {statusConfig.label}
                          </span>
                        )}
                        {proposal.tem_protocolo && (
                          <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                            Protocolo
                          </span>
                        )}
                      </div>

                      {/* Key metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Spread</p>
                          <p className="text-sm font-semibold">{formatPercent(proposal.spread)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Prestacao</p>
                          <p className="text-sm font-semibold">{formatCurrency(proposal.prestacao_mensal)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">TAEG</p>
                          <p className="text-sm font-semibold">{formatPercent(proposal.taeg)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Montante</p>
                          <p className="text-sm font-semibold">{formatCurrency(proposal.montante_aprovado)}</p>
                        </div>
                      </div>

                      {/* Additional info */}
                      {(proposal.prazo_aprovado_anos || proposal.euribor_referencia) && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {proposal.prazo_aprovado_anos && (
                            <span>{proposal.prazo_aprovado_anos} anos</span>
                          )}
                          {proposal.euribor_referencia && (
                            <span>{proposal.euribor_referencia}</span>
                          )}
                          {proposal.data_validade_aprovacao && (
                            <span>
                              Validade:{' '}
                              {new Date(proposal.data_validade_aprovacao).toLocaleDateString('pt-PT')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(proposal)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(proposal.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Proposal form dialog */}
      <CreditProposalForm
        open={formOpen}
        onOpenChange={handleFormClose}
        onSubmit={handleSubmit}
        initialData={editingProposal}
        isSubmitting={isSubmitting}
        banks={banks}
      />

      {/* Comparison sheet */}
      <Sheet open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Comparacao de Propostas</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <CreditProposalComparison
              proposals={approvedProposals}
              onSelect={handleSelect}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proposta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar esta proposta? Esta accao e irreversivel.
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
