'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { DocumentsSection } from '@/components/documents/DocumentsSection'
import { OwnerEditSheet } from '@/components/processes/owner-edit-sheet'
import { SpouseRegistrationDialog } from '@/components/processes/spouse-registration-dialog'
import { AddOwnerDialog } from '@/components/processes/add-owner-dialog'
import { OwnershipSummaryBar } from '@/components/processes/ownership-summary-bar'
import { OwnerTasksDropdown } from '@/components/processes/owner-tasks-dropdown'
import { User, Building2, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { OWNER_ROLE_COLORS, MARRIED_STATUSES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ProcessDocument } from '@/types/process'
import type { DocType } from '@/types/document'
import type { OwnerRoleType } from '@/types/owner'

/* ─── Display Field ─── */
function DisplayField({
  label,
  value,
  fullWidth,
}: {
  label: string
  value?: string | number | null
  fullWidth?: boolean
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${fullWidth ? 'col-span-full' : ''}`}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">{value != null && value !== '' ? String(value) : '—'}</p>
    </div>
  )
}

/* ─── Section Header ─── */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pt-2">
      {children}
    </p>
  )
}

interface ProcessOwnersTabProps {
  owners: any[]
  documents: ProcessDocument[]
  propertyId: string
  processId?: string
  /** Map de owner_id → boolean indicando se tem tarefas no processo */
  ownerHasTasksMap?: Record<string, boolean>
  /** Map de owner_id → Set<tpl_subtask_id> já criados */
  ownerExistingSubtaskIds?: Record<string, Set<string>>
  /** Total real de proprietários (para saber se pode remover na vista individual) */
  totalOwners?: number
  /** Esconder a barra de resumo e o botão de adicionar (vista individual) */
  hideHeader?: boolean
  onDocumentUploaded?: () => void
  onOwnersChanged?: () => void
}

export function ProcessOwnersTab({
  owners,
  documents,
  propertyId,
  processId,
  ownerHasTasksMap = {},
  ownerExistingSubtaskIds = {},
  totalOwners,
  hideHeader = false,
  onDocumentUploaded,
  onOwnersChanged,
}: ProcessOwnersTabProps) {
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [docTypesLoading, setDocTypesLoading] = useState(true)
  const [roleTypes, setRoleTypes] = useState<OwnerRoleType[]>([])

  // Sheet state
  const [editingOwner, setEditingOwner] = useState<any>(null)

  // Spouse dialog state
  const [spouseDialogOpen, setSpouseDialogOpen] = useState(false)
  const [spouseOwnerName, setSpouseOwnerName] = useState('')

  // Delete confirmation state
  const [deletingOwner, setDeletingOwner] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  // Add owner dialog state
  const [addOwnerOpen, setAddOwnerOpen] = useState(false)


  // Fetch doc_types and role_types on mount
  useEffect(() => {
    fetch('/api/libraries/doc-types')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDocTypes(
            data.filter((dt: DocType) =>
              dt.category === 'Proprietário' || dt.category === 'Proprietário Empresa'
            )
          )
        }
      })
      .catch((err) => console.error('Erro ao carregar tipos de documento:', err))
      .finally(() => setDocTypesLoading(false))

    fetch('/api/owner-role-types')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setRoleTypes(data)
      })
      .catch((err) => console.error('Erro ao carregar role types:', err))
  }, [])

  // Group doc_types by person type
  const singularByCategory = useMemo((): Record<string, DocType[]> => {
    const filtered = docTypes.filter((dt) => dt.category === 'Proprietário')
    return filtered.length > 0 ? { Proprietário: filtered } : {}
  }, [docTypes])

  const coletivaByCategory = useMemo((): Record<string, DocType[]> => {
    const filtered = docTypes.filter((dt) => dt.category === 'Proprietário Empresa')
    return filtered.length > 0 ? { 'Proprietário Empresa': filtered } : {}
  }, [docTypes])

  // Owner documents from doc_registry
  const ownerDocCategories = ['Proprietário', 'Proprietário Empresa']
  const ownerDocs = useMemo(
    () => documents.filter((d) => ownerDocCategories.some((c) => d.doc_type?.category?.startsWith(c))),
    [documents]
  )

  const handleDocUploaded = useCallback((_result: any, _docTypeId: string) => {
    toast.success('Documento carregado com sucesso')
    onDocumentUploaded?.()
  }, [onDocumentUploaded])

  const handleSpousePrompt = useCallback((owner: any) => {
    // Check if there's already a conjuge for this property
    const hasConjuge = owners.some(
      (o) => o.id !== owner.id && o.owner_role?.name === 'conjuge'
    )
    if (!hasConjuge) {
      setSpouseOwnerName(owner.name)
      setSpouseDialogOpen(true)
    }
  }, [owners])

  const handleDeleteOwner = useCallback(async () => {
    if (!deletingOwner) return

    setDeleting(true)
    try {
      // 1. Se tem processo, remover subtarefas/tarefas do fluxo primeiro
      if (processId && ownerHasTasksMap[deletingOwner.id]) {
        const procRes = await fetch(
          `/api/processes/${processId}/owners/${deletingOwner.id}`,
          { method: 'DELETE' }
        )
        if (!procRes.ok) {
          const err = await procRes.json()
          throw new Error(err.error || 'Erro ao remover tarefas do proprietário')
        }
        const procData = await procRes.json()
        if (procData.total_removed > 0) {
          toast.success(`${procData.total_removed} tarefa(s) removida(s) do fluxo`)
        }
      }

      // 2. Remover associação ao imóvel
      const res = await fetch(
        `/api/properties/${propertyId}/owners/${deletingOwner.id}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao remover proprietário')
      }

      toast.success('Proprietário removido com sucesso')
      onOwnersChanged?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao remover'
      )
    } finally {
      setDeleting(false)
      setDeletingOwner(null)
    }
  }, [deletingOwner, propertyId, processId, ownerHasTasksMap, onOwnersChanged])

  const existingOwnerIds = useMemo(() => owners.map((o: any) => o.id), [owners])

  if (!owners || owners.length === 0) {
    return (
      <div className="space-y-4">
        {!hideHeader && <OwnershipSummaryBar owners={[]} onAddOwner={() => setAddOwnerOpen(true)} />}
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum proprietário associado</p>
          </CardContent>
        </Card>
        {!hideHeader && (
          <AddOwnerDialog
            open={addOwnerOpen}
            onOpenChange={setAddOwnerOpen}
            propertyId={propertyId}
            processId={processId}
            roleTypes={roleTypes}
            existingOwnerIds={[]}
            onAdded={onOwnersChanged}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {!hideHeader && <OwnershipSummaryBar owners={owners} onAddOwner={() => setAddOwnerOpen(true)} />}

      {/* Owner cards */}
      {owners.map((owner: any) => {
        const isSingular = owner.person_type === 'singular'
        const byCategory = isSingular ? singularByCategory : coletivaByCategory
        const roleName = owner.owner_role?.name || 'proprietario'
        const roleLabel = owner.owner_role?.label || 'Proprietário'
        const roleColors = OWNER_ROLE_COLORS[roleName] || OWNER_ROLE_COLORS.proprietario

        // Map uploaded docs for this specific owner
        const uploadedForOwner = ownerDocs
          .filter((d) => d.owner_id === owner.id)
          .map((d) => ({
            doc_type_id: d.doc_type?.id || '',
            file_url: d.file_url,
            file_name: d.file_name,
          }))

        return (
          <Card key={owner.id || owner.name}>
            {/* Card Header with owner name + badges + actions */}
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                {isSingular ? (
                  <User className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{owner.name}</p>
                <p className="text-xs text-muted-foreground">
                  {isSingular ? 'Pessoa Singular' : 'Pessoa Colectiva'}
                  {owner.ownership_percentage ? ` · ${owner.ownership_percentage}%` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Role badge */}
                <Badge
                  variant="outline"
                  className={cn('h-5 px-2 text-[10px] border-0', roleColors.bg, roleColors.text)}
                >
                  {roleLabel}
                </Badge>
                {owner.is_main_contact && (
                  <Badge variant="default" className="h-5 px-2 text-[10px] shrink-0">
                    Principal
                  </Badge>
                )}
                {/* Edit button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditingOwner(owner)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {/* Delete button */}
                {(totalOwners ?? owners.length) > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeletingOwner(owner)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {/* Tasks dropdown */}
                {processId && (
                  <OwnerTasksDropdown
                    processId={processId}
                    ownerId={owner.id}
                    ownerName={owner.name}
                    existingSubtaskIds={ownerExistingSubtaskIds[owner.id] || new Set()}
                    allPopulated={false}
                    onTasksPopulated={onOwnersChanged}
                  />
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Info fields */}
              <div className="grid grid-cols-2 gap-3">
                <SectionHeader>Dados Gerais</SectionHeader>
                <DisplayField label="NIF" value={owner.nif} />
                <DisplayField label="Email" value={owner.email} />
                <DisplayField label="Telefone" value={owner.phone} />
                <DisplayField label="Morada" value={owner.address} />

                {isSingular && (
                  <>
                    <SectionHeader>Dados Pessoais</SectionHeader>
                    <DisplayField label="Nacionalidade" value={owner.nationality} />
                    <DisplayField label="Naturalidade" value={owner.naturality} />
                    <DisplayField label="Estado Civil" value={owner.marital_status} />
                    {MARRIED_STATUSES.includes(owner.marital_status) && (
                      <DisplayField label="Regime Matrimonial" value={owner.marital_regime} />
                    )}
                  </>
                )}

                {!isSingular && (
                  <>
                    <SectionHeader>Dados da Empresa</SectionHeader>
                    <DisplayField label="Representante Legal" value={owner.legal_representative_name} />
                    <DisplayField label="NIF do Representante" value={owner.legal_representative_nif} />
                  </>
                )}

                {owner.observations && (
                  <DisplayField label="Observações" value={owner.observations} fullWidth />
                )}
              </div>

              {/* Documents section */}
              <div>
                <SectionHeader>Documentos</SectionHeader>
                <div className="pt-2">
                  {docTypesLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : Object.keys(byCategory).length > 0 ? (
                    <DocumentsSection
                      byCategory={byCategory}
                      uploadedDocs={uploadedForOwner}
                      ownerId={owner.id}
                      onUploaded={handleDocUploaded}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem tipos de documento configurados</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Edit Sheet */}
      {editingOwner && (
        <OwnerEditSheet
          open={!!editingOwner}
          onOpenChange={(open) => !open && setEditingOwner(null)}
          owner={editingOwner}
          propertyId={propertyId}
          roleTypes={roleTypes}
          onSaved={() => {
            setEditingOwner(null)
            onOwnersChanged?.()
          }}
          onSpousePrompt={handleSpousePrompt}
        />
      )}

      {/* Spouse Registration Dialog */}
      <SpouseRegistrationDialog
        open={spouseDialogOpen}
        onOpenChange={setSpouseDialogOpen}
        ownerName={spouseOwnerName}
        propertyId={propertyId}
        roleTypes={roleTypes}
        onRegistered={onOwnersChanged}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingOwner} onOpenChange={(open) => !open && setDeletingOwner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Proprietário</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Tem a certeza de que pretende remover <strong>{deletingOwner?.name}</strong> deste imóvel?
                O registo do proprietário não será eliminado, apenas a associação.
                {processId && ownerHasTasksMap[deletingOwner?.id] && (
                  <span className="block mt-2 text-destructive font-medium">
                    As subtarefas deste proprietário no fluxo do processo também serão removidas.
                  </span>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOwner}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'A remover...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Owner Dialog */}
      {!hideHeader && (
        <AddOwnerDialog
          open={addOwnerOpen}
          onOpenChange={setAddOwnerOpen}
          propertyId={propertyId}
          processId={processId}
          roleTypes={roleTypes}
          existingOwnerIds={existingOwnerIds}
          onAdded={onOwnersChanged}
        />
      )}
    </div>
  )
}
