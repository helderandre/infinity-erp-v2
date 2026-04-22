'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileUp,
  Info,
  Loader2,
  Pencil,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

import {
  computeCmiReadiness,
  type ComputedRequirement,
  type DocRef,
  type OwnerReadiness,
} from '@/lib/acquisitions/cmi-requirements'
import type { PropertyDetail } from '@/types/property'
import type { Database } from '@/types/database'
import type { OwnerRoleType } from '@/types/owner'
import { CmiFieldEditDialog, type CmiFieldEditTarget } from './cmi-field-edit-dialog'
import { SubtaskPdfSheet } from '@/components/processes/subtask-pdf-sheet'
import { AddOwnerDialog } from '@/components/processes/add-owner-dialog'

type OwnerRow = Database['public']['Tables']['owners']['Row']

const CMI_TEMPLATE_ID = '9223bdfc-31a0-4918-b5ee-580760ba8b32'

interface PropertyCmiReadinessProps {
  propertyId: string
  /** When provided, AddOwnerDialog offers to populate tasks for the new owner. */
  processId?: string
}

// Category → target resolution strategy used by bulk upload.
type UploadTarget =
  | { kind: 'property' }
  | { kind: 'owner'; ownerId: string; personType: 'singular' | 'coletiva' }
  | { kind: 'skip'; reason: string }

// Doc types that carry extractable structured fields for the owner.
const OWNER_EXTRACTABLE_DOC_TYPES = new Set<string>([
  '16706cb5-1a27-413d-ad75-ec6aee1c3674', // Cartão de Cidadão
  'b038f839-d40e-47f7-8a1d-15a4c97614cc', // Comprovante de Morada
  'e433c9f1-b323-43ac-9607-05b31f72bbb9', // Certidão Permanente da Empresa
])

export function PropertyCmiReadiness({ propertyId, processId }: PropertyCmiReadinessProps) {
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [docs, setDocs] = useState<DocRef[]>([])
  const [roleTypes, setRoleTypes] = useState<OwnerRoleType[]>([])
  const [loading, setLoading] = useState(true)
  const [bulkUploading, setBulkUploading] = useState(false)
  const bulkInputRef = useRef<HTMLInputElement>(null)
  const [editTarget, setEditTarget] = useState<CmiFieldEditTarget | null>(null)
  const [cmiSheetOpen, setCmiSheetOpen] = useState(false)
  const [addOwnerOpen, setAddOwnerOpen] = useState(false)
  const [reExtracting, setReExtracting] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        fetch(`/api/properties/${propertyId}`),
        fetch(`/api/properties/${propertyId}/documents`),
      ])
      if (pRes.ok) setProperty(await pRes.json())
      if (dRes.ok) {
        const d = await dRes.json()
        setDocs([
          ...(d.property_documents || []),
          ...(d.owner_documents || []),
        ])
      }
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    fetch('/api/owner-role-types')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setRoleTypes(data)
      })
      .catch(() => {
        /* non-fatal — Add Owner dialog will still open with empty role list */
      })
  }, [])

  const readiness = useMemo(
    () => (property ? computeCmiReadiness(property, docs) : null),
    [property, docs]
  )

  // Resolve a classified file to an upload target. Simple heuristic: the
  // doc_type category tells us whether it belongs to the property or to an
  // owner, and we auto-pick the owner only when there is exactly one match.
  const resolveTarget = useCallback(
    (category: string | null | undefined): UploadTarget => {
      const cat = (category || '').toLowerCase()
      const owners = readiness?.owners || []
      const singulars = owners.filter((o) => o.personType === 'singular')
      const coletivas = owners.filter((o) => o.personType === 'coletiva')

      if (cat.startsWith('proprietário empresa') || cat.startsWith('proprietario empresa')) {
        if (coletivas.length === 1) {
          return { kind: 'owner', ownerId: coletivas[0].ownerId, personType: 'coletiva' }
        }
        return { kind: 'skip', reason: 'sem proprietário colectivo único' }
      }

      if (cat.startsWith('proprietário') || cat.startsWith('proprietario')) {
        // Singular-first; fall back to the sole coletiva (CC do rep legal).
        if (singulars.length === 1) {
          return { kind: 'owner', ownerId: singulars[0].ownerId, personType: 'singular' }
        }
        if (singulars.length === 0 && coletivas.length === 1) {
          return { kind: 'owner', ownerId: coletivas[0].ownerId, personType: 'coletiva' }
        }
        return { kind: 'skip', reason: 'sem proprietário singular único' }
      }

      // Everything else (Imóvel, Jurídico, Jurídico Especial, Contratual) → property.
      return { kind: 'property' }
    },
    [readiness]
  )

  const mainOwnerId = useMemo(() => {
    if (!property) return undefined
    const main = property.property_owners?.find((po) => po.is_main_contact)
      ?? property.property_owners?.[0]
    return main?.owners?.id
  }, [property])

  const existingOwnerIds = useMemo(() => {
    if (!property) return [] as string[]
    return property.property_owners
      ?.map((po) => po.owners?.id)
      .filter((id): id is string => !!id) ?? []
  }, [property])

  const handleReExtract = useCallback(async () => {
    setReExtracting(true)
    const tId = toast.loading('A extrair campos dos documentos existentes com IA...')
    try {
      const res = await fetch(`/api/properties/${propertyId}/cmi-re-extract`, {
        method: 'POST',
      })
      toast.dismiss(tId)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Falha na extracção')
      }
      const j = await res.json()
      const total = (j.owners_fields_patched || 0) + (j.property_fields_patched || 0)
      if (total > 0) {
        toast.success(`${total} campo(s) preenchido(s) a partir de ${j.owner_docs_processed + j.property_docs_processed} documento(s)`)
      } else {
        toast.info('Nenhum campo novo encontrado nos documentos existentes')
      }
      await fetchAll()
    } catch (e: any) {
      toast.dismiss(tId)
      toast.error(e?.message || 'Erro na extracção')
    } finally {
      setReExtracting(false)
    }
  }, [propertyId, fetchAll])

  const handleBulkUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setBulkUploading(true)
      const classifyToast = toast.loading(`A classificar ${files.length} ficheiro(s)...`)

      try {
        const classifyForm = new FormData()
        Array.from(files).forEach((f) => classifyForm.append('files', f))
        const cRes = await fetch('/api/documents/classify', {
          method: 'POST',
          body: classifyForm,
        })
        if (!cRes.ok) throw new Error('Falha na classificação')
        const { data: classified } = await cRes.json()

        toast.dismiss(classifyToast)
        const uploadToast = toast.loading('A carregar documentos...')

        let uploaded = 0
        let skipped = 0
        const extractJobs: { ownerId: string; docTypeId: string; fileUrl: string; fileName: string }[] = []
        const propertyExtractJobs: { file: File; docTypeName: string; docTypeCategory: string; docId: string }[] = []

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const match = classified?.find((c: any) => c.index === i)
          if (!match?.doc_type_id) {
            skipped++
            continue
          }

          const target = resolveTarget(match.doc_type_category)
          if (target.kind === 'skip') {
            skipped++
            continue
          }

          const fd = new FormData()
          fd.append('file', file)
          fd.append('doc_type_id', match.doc_type_id)
          fd.append('property_id', propertyId)
          if (target.kind === 'owner') fd.append('owner_id', target.ownerId)

          const uRes = await fetch('/api/documents/upload', {
            method: 'POST',
            body: fd,
          })
          if (!uRes.ok) {
            skipped++
            continue
          }
          uploaded++

          const uData = await uRes.json()
          const fileUrl = uData?.url || uData?.file_url
          if (
            target.kind === 'owner' &&
            fileUrl &&
            OWNER_EXTRACTABLE_DOC_TYPES.has(match.doc_type_id)
          ) {
            extractJobs.push({
              ownerId: target.ownerId,
              docTypeId: match.doc_type_id,
              fileUrl,
              fileName: file.name,
            })
          }
          // Property-scope docs cujo conteúdo alimenta campos estruturados:
          // Caderneta/CRP → dev_property_legal_data; Licença → dev_property_internal.
          if (target.kind === 'property' && uData?.id) {
            const cat = (match.doc_type_category || '').toLowerCase()
            const name = (match.doc_type_name || '').toLowerCase()
            if (
              name.includes('caderneta') ||
              name.includes('certidão') || name.includes('certidao') ||
              name.includes('licença') || name.includes('licenca') ||
              cat.startsWith('jurídico') || cat.startsWith('juridico') ||
              cat.startsWith('imóvel') || cat.startsWith('imovel')
            ) {
              propertyExtractJobs.push({
                file,
                docTypeName: match.doc_type_name || '',
                docTypeCategory: match.doc_type_category || '',
                docId: uData.id,
              })
            }
          }
        }

        toast.dismiss(uploadToast)

        if (uploaded === 0) {
          toast.error(`Nenhum documento carregado${skipped > 0 ? ` (${skipped} ignorado[s])` : ''}`)
          return
        }

        toast.success(
          `${uploaded} documento(s) carregado(s)${skipped > 0 ? ` · ${skipped} ignorado(s)` : ''}`
        )

        // Background: extract structured fields from property docs
        // (Caderneta, CRP, Licença) — uses the existing multi-doc extractor
        // that writes to dev_property_legal_data + dev_property_internal.
        if (propertyExtractJobs.length > 0) {
          const pToast = toast.loading(`A extrair dados de ${propertyExtractJobs.length} documento(s) do imóvel...`)
          try {
            const fd = new FormData()
            const typesArr: { name: string; category: string }[] = []
            const idsArr: string[] = []
            for (const job of propertyExtractJobs) {
              fd.append('files', job.file)
              typesArr.push({ name: job.docTypeName, category: job.docTypeCategory })
              idsArr.push(job.docId)
            }
            fd.append('doc_types', JSON.stringify(typesArr))
            fd.append('property_id', propertyId)
            fd.append('doc_registry_ids', JSON.stringify(idsArr))
            const exRes = await fetch('/api/documents/extract', { method: 'POST', body: fd })
            toast.dismiss(pToast)
            if (exRes.ok) {
              const j = await exRes.json()
              const legal = j.legal_data_fields_set || 0
              const license = j.license_fields_set || 0
              if (legal + license > 0) {
                toast.success(`${legal + license} campo(s) do imóvel extraído(s) automaticamente`)
              }
            }
          } catch {
            toast.dismiss(pToast)
          }
        }

        // Background: extract structured fields from owner docs.
        if (extractJobs.length > 0) {
          const exToast = toast.loading(`A extrair dados de ${extractJobs.length} documento(s)...`)
          let patchedTotal = 0
          await Promise.all(
            extractJobs.map(async (job) => {
              try {
                const exRes = await fetch(`/api/owners/${job.ownerId}/extract-fields`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    file_url: job.fileUrl,
                    file_name: job.fileName,
                    doc_type_id: job.docTypeId,
                  }),
                })
                if (exRes.ok) {
                  const j = await exRes.json()
                  patchedTotal += (j?.patched?.length as number) || 0
                }
              } catch {
                // swallow — extraction is best-effort
              }
            })
          )
          toast.dismiss(exToast)
          if (patchedTotal > 0) {
            toast.success(`${patchedTotal} campo(s) preenchido(s) automaticamente`)
          }
        }

        await fetchAll()
      } catch (e: any) {
        toast.dismiss(classifyToast)
        toast.error(e?.message || 'Erro ao carregar documentos')
      } finally {
        setBulkUploading(false)
        if (bulkInputRef.current) bulkInputRef.current.value = ''
      }
    },
    [propertyId, resolveTarget, fetchAll]
  )

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  if (!property || !readiness) {
    return (
      <div className="flex flex-col items-center py-12 text-center gap-2">
        <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os requisitos do CMI.
        </p>
      </div>
    )
  }

  const percent =
    readiness.totalRequired === 0
      ? 100
      : Math.round((readiness.totalSatisfied / readiness.totalRequired) * 100)

  return (
    <div className="space-y-4">
      <input
        ref={bulkInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={(e) => handleBulkUpload(e.target.files)}
      />

      {/* Overall header */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
              percent === 100
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
            )}
          >
            {percent === 100 ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold truncate">
                {percent === 100
                  ? 'Pronto para assinar o CMI'
                  : `${readiness.totalRequired - readiness.totalSatisfied} requisito(s) em falta`}
              </p>
              <p className="text-lg font-bold tabular-nums shrink-0">{percent}%</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {readiness.totalSatisfied} de {readiness.totalRequired} requisitos satisfeitos
            </p>
          </div>
        </div>
        <Progress value={percent} className="mt-3 h-1.5" />

        {/* Actions row */}
        <div className="mt-4 pt-3 border-t space-y-3">
          <p className="text-[11px] text-muted-foreground leading-tight">
            Carrega vários documentos e a IA classifica cada um e extrai
            automaticamente os campos do proprietário.
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5 flex-1 sm:flex-initial"
              onClick={() => setAddOwnerOpen(true)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Adicionar proprietário
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5 flex-1 sm:flex-initial"
              onClick={handleReExtract}
              disabled={reExtracting}
              title="Re-correr IA sobre os documentos já carregados"
            >
              {reExtracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Extrair com IA
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5 flex-1 sm:flex-initial"
              onClick={() => setCmiSheetOpen(true)}
              title={percent < 100 ? 'Pré-visualizar CMI (campos em falta aparecem vazios)' : 'Pré-visualizar CMI'}
            >
              <Eye className="h-3.5 w-3.5" />
              Pré-visualizar CMI
            </Button>
            <Button
              size="sm"
              className="rounded-full gap-1.5 flex-1 sm:flex-initial"
              disabled={bulkUploading}
              onClick={() => bulkInputRef.current?.click()}
            >
              {bulkUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Carregar em massa
            </Button>
          </div>
        </div>
      </div>

      {/* Property section */}
      <SectionCard
        icon={<Building2 className="h-4 w-4" />}
        title="Imóvel"
        satisfied={readiness.propertySatisfiedCount}
        required={readiness.propertyRequiredCount}
        items={readiness.property}
        renderAction={(item) => (
          <PropertyItemAction
            propertyId={propertyId}
            property={property}
            item={item}
            onRefresh={fetchAll}
            onEditField={(fieldKey) =>
              setEditTarget({
                kind: 'property',
                propertyId,
                fieldKey,
                property,
              })
            }
          />
        )}
      />

      {/* Owners */}
      {readiness.owners.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Sem proprietários associados.
          </p>
          <Button
            size="sm"
            className="rounded-full gap-1.5"
            onClick={() => setAddOwnerOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Adicionar proprietário
          </Button>
        </div>
      ) : (
        <>
          {readiness.owners.map((owner) => {
            const rawOwner = property.property_owners.find(
              (po) => po.owners?.id === owner.ownerId
            )?.owners
            return (
              <OwnerSection
                key={owner.ownerId}
                propertyId={propertyId}
                owner={owner}
                rawOwner={rawOwner || null}
                onRefresh={fetchAll}
                onEditField={(ownerId, fieldKey, ownerRow) =>
                  setEditTarget({
                    kind: 'owner',
                    ownerId,
                    fieldKey,
                    owner: ownerRow,
                  })
                }
              />
            )
          })}
        </>
      )}

      <CmiFieldEditDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={fetchAll}
      />

      <SubtaskPdfSheet
        open={cmiSheetOpen}
        onOpenChange={setCmiSheetOpen}
        docLibraryId={CMI_TEMPLATE_ID}
        propertyId={propertyId}
        ownerId={mainOwnerId}
        previewTitle="Pré-visualização do CMI"
      />

      <AddOwnerDialog
        open={addOwnerOpen}
        onOpenChange={setAddOwnerOpen}
        propertyId={propertyId}
        processId={processId}
        roleTypes={roleTypes}
        existingOwnerIds={existingOwnerIds}
        onAdded={() => {
          fetchAll()
        }}
      />
    </div>
  )
}

// ─── Section Card ────────────────────────────────────────────────────

interface SectionCardProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  satisfied: number
  required: number
  items: ComputedRequirement[]
  renderAction: (item: ComputedRequirement) => React.ReactNode
}

function SectionCard({
  icon,
  title,
  subtitle,
  satisfied,
  required,
  items,
  renderAction,
}: SectionCardProps) {
  const [open, setOpen] = useState(true)
  const percent = required === 0 ? 100 : Math.round((satisfied / required) * 100)
  const complete = satisfied === required && required > 0
  const visibleItems = items.filter((i) => i.status !== 'na')

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
          >
            <div
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                complete
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {complete ? <CheckCircle2 className="h-4 w-4" /> : icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{title}</p>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px] font-normal',
                    complete && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                  )}
                >
                  {satisfied}/{required}
                </Badge>
              </div>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {percent}%
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  open && 'rotate-180'
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t divide-y">
            {visibleItems.map((item) => (
              <RequirementRow
                key={item.key}
                item={item}
                action={renderAction(item)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ─── Requirement Row ─────────────────────────────────────────────────

function RequirementRow({
  item,
  action,
}: {
  item: ComputedRequirement
  action: React.ReactNode
}) {
  const satisfied = item.status === 'satisfied'
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors',
        !satisfied && 'bg-amber-50/30 dark:bg-amber-950/10'
      )}
    >
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
          satisfied
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
        )}
      >
        {satisfied ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{item.label}</p>
          <Badge
            variant="outline"
            className="text-[9px] font-normal rounded-full px-1.5 py-0"
          >
            {item.kind === 'document' ? 'Documento' : 'Campo'}
          </Badge>
        </div>
        {item.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.description}</span>
          </p>
        )}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

// ─── Owner section ───────────────────────────────────────────────────

function OwnerSection({
  propertyId,
  owner,
  rawOwner,
  onRefresh,
  onEditField,
}: {
  propertyId: string
  owner: OwnerReadiness
  rawOwner: OwnerRow | null
  onRefresh: () => Promise<void>
  onEditField: (ownerId: string, fieldKey: string, ownerRow: OwnerRow) => void
}) {
  return (
    <SectionCard
      icon={
        owner.personType === 'coletiva' ? (
          <Building2 className="h-4 w-4" />
        ) : (
          <User className="h-4 w-4" />
        )
      }
      title={owner.ownerName}
      subtitle={
        owner.personType === 'coletiva' ? 'Pessoa colectiva' : 'Pessoa singular'
      }
      satisfied={owner.satisfiedCount}
      required={owner.requiredCount}
      items={owner.items}
      renderAction={(item) => (
        <OwnerItemAction
          propertyId={propertyId}
          ownerId={owner.ownerId}
          item={item}
          onRefresh={onRefresh}
          onEditField={() => {
            if (rawOwner) onEditField(owner.ownerId, item.key, rawOwner)
          }}
        />
      )}
    />
  )
}

// ─── Actions: Property / Owner item ──────────────────────────────────

function PropertyItemAction({
  propertyId,
  property,
  item,
  onRefresh,
  onEditField,
}: {
  propertyId: string
  property: PropertyDetail
  item: ComputedRequirement
  onRefresh: () => Promise<void>
  onEditField: (fieldKey: string) => void
}) {
  if (item.status === 'satisfied') return null
  if (item.kind === 'field') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full gap-1.5 h-8"
        onClick={() => onEditField(item.key)}
      >
        <Pencil className="h-3 w-3" />
        Editar
      </Button>
    )
  }
  return (
    <UploadDocButton
      docTypeId={item.docTypeId!}
      propertyId={propertyId}
      onUploaded={onRefresh}
    />
  )
}

function OwnerItemAction({
  propertyId,
  ownerId,
  item,
  onRefresh,
  onEditField,
}: {
  propertyId: string
  ownerId: string
  item: ComputedRequirement
  onRefresh: () => Promise<void>
  onEditField: () => void
}) {
  if (item.status === 'satisfied') return null
  if (item.kind === 'field') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full gap-1.5 h-8"
        onClick={onEditField}
      >
        <Pencil className="h-3 w-3" />
        Editar
      </Button>
    )
  }
  return (
    <UploadDocButton
      docTypeId={item.docTypeId!}
      propertyId={propertyId}
      ownerId={ownerId}
      onUploaded={onRefresh}
    />
  )
}

// ─── Upload button ───────────────────────────────────────────────────

function UploadDocButton({
  docTypeId,
  propertyId,
  ownerId,
  onUploaded,
}: {
  docTypeId: string
  propertyId: string
  ownerId?: string
  onUploaded: () => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true)
      const tId = toast.loading('A carregar documento...')
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('doc_type_id', docTypeId)
        // Documentos de proprietário carregados aqui ficam associados ao
        // imóvel (visíveis na lista) mas também ao owner (usados na cascata).
        if (propertyId) fd.append('property_id', propertyId)
        if (ownerId) fd.append('owner_id', ownerId)
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: fd,
        })
        toast.dismiss(tId)
        if (!res.ok) throw new Error('Erro no upload')
        toast.success('Documento carregado')
        await onUploaded()
      } catch (e: any) {
        toast.dismiss(tId)
        toast.error(e?.message || 'Erro ao carregar documento')
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [docTypeId, propertyId, ownerId, onUploaded]
  )

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
      <Button
        size="sm"
        className="rounded-full gap-1.5 h-8"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FileUp className="h-3 w-3" />
        )}
        Carregar
      </Button>
    </>
  )
}
