// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, CalendarDays, List } from 'lucide-react'
import { useVisits } from '@/hooks/use-visits'
import { useUser } from '@/hooks/use-user'
import type { VisitFilters } from '@/types/visit'
import type { CreateVisitInput } from '@/lib/validations/visit'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

import { VisitForm } from '@/components/visits/visit-form'
import { VisitFeedback } from '@/components/visits/visit-feedback'
import { VisitFiltersBar } from '@/components/visits/visit-filters'
import { VisitCard } from '@/components/visits/visit-card'

export default function VisitasPage() {
  const { user } = useUser()
  const [filters, setFilters] = useState<VisitFilters>({})
  const [page, setPage] = useState(1)
  const [consultants, setConsultants] = useState<Array<{ id: string; commercial_name: string | null }>>([])

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [feedbackVisitId, setFeedbackVisitId] = useState<string | null>(null)
  const [cancelVisitId, setCancelVisitId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [deleteVisitId, setDeleteVisitId] = useState<string | null>(null)

  // Tab view
  const [activeTab, setActiveTab] = useState<'upcoming' | 'all'>('upcoming')

  const {
    visits,
    isLoading,
    total,
    totalPages,
    refetch,
    createVisit,
    updateVisit,
    cancelVisit,
    submitFeedback,
    deleteVisit,
  } = useVisits({
    filters,
    page,
    limit: 20,
    upcoming: activeTab === 'upcoming',
  })

  // Fetch consultants for filters
  useEffect(() => {
    const fetchConsultants = async () => {
      try {
        const res = await fetch('/api/users?role=consultant&limit=100')
        if (res.ok) {
          const json = await res.json()
          setConsultants(
            (json.data || json || []).map((c: any) => ({
              id: c.id,
              commercial_name: c.commercial_name,
            }))
          )
        }
      } catch {}
    }
    fetchConsultants()
  }, [])

  // Handlers
  const handleCreate = async (data: CreateVisitInput) => {
    const result = await createVisit(data)
    if (result) {
      setShowCreateDialog(false)
    }
    return result
  }

  const handleConfirm = async (id: string) => {
    await updateVisit(id, {
      status: 'confirmed',
      confirmed_by: 'agent',
      confirmation_method: 'phone',
    })
  }

  const handleNoShow = async (id: string) => {
    await updateVisit(id, { status: 'no_show' })
  }

  const handleCancelConfirm = async () => {
    if (!cancelVisitId || !cancelReason.trim()) return
    await cancelVisit(cancelVisitId, cancelReason)
    setCancelVisitId(null)
    setCancelReason('')
  }

  const handleDeleteConfirm = async () => {
    if (!deleteVisitId) return
    await deleteVisit(deleteVisitId)
    setDeleteVisitId(null)
  }

  const handleFeedbackSubmit = async (id: string, feedback: any) => {
    const success = await submitFeedback(id, feedback)
    if (success) {
      setFeedbackVisitId(null)
    }
    return success
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visitas</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de visitas a imóveis com clientes
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Visita
        </Button>
      </div>

      {/* Tabs: Próximas vs Todas */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as 'upcoming' | 'all')
          setPage(1)
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="upcoming" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Próximas
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <List className="h-4 w-4" />
              Todas
            </TabsTrigger>
          </TabsList>
          <span className="text-sm text-muted-foreground">
            {total} visita{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filters (only on "all" tab) */}
        <TabsContent value="all" className="mt-4 space-y-4">
          <VisitFiltersBar
            filters={filters}
            onFiltersChange={(f) => {
              setFilters(f)
              setPage(1)
            }}
            consultants={consultants}
          />
        </TabsContent>

        <TabsContent value="upcoming" className="mt-0" />
      </Tabs>

      {/* Visit list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium">
            {activeTab === 'upcoming'
              ? 'Sem visitas agendadas'
              : 'Nenhuma visita encontrada'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === 'upcoming'
              ? 'Agende uma nova visita para começar.'
              : 'Tente ajustar os filtros de pesquisa.'}
          </p>
          {activeTab === 'upcoming' && (
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agendar Visita
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              onConfirm={handleConfirm}
              onFeedback={setFeedbackVisitId}
              onCancel={setCancelVisitId}
              onNoShow={handleNoShow}
              onDelete={setDeleteVisitId}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Seguinte
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agendar Nova Visita</DialogTitle>
            <DialogDescription>
              Preencha os dados para agendar uma visita a um imóvel.
            </DialogDescription>
          </DialogHeader>
          <VisitForm
            defaultConsultantId={user?.id}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog
        open={!!feedbackVisitId}
        onOpenChange={(open) => !open && setFeedbackVisitId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Feedback da Visita</DialogTitle>
            <DialogDescription>
              Registe a sua avaliação e próximos passos após a visita.
            </DialogDescription>
          </DialogHeader>
          {feedbackVisitId && (
            <VisitFeedback
              visitId={feedbackVisitId}
              onSubmit={handleFeedbackSubmit}
              onCancel={() => setFeedbackVisitId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <AlertDialog
        open={!!cancelVisitId}
        onOpenChange={(open) => {
          if (!open) {
            setCancelVisitId(null)
            setCancelReason('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Visita</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende cancelar esta visita? Indique o motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">Motivo *</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Motivo do cancelamento..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!cancelReason.trim()}
              onClick={handleCancelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar Visita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteVisitId}
        onOpenChange={(open) => !open && setDeleteVisitId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Visita</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar esta visita? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
