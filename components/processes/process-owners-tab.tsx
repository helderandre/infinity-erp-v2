'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentsSection } from '@/components/documents/DocumentsSection'
import { User, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ProcessDocument } from '@/types/process'
import type { DocType } from '@/types/document'

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
  onDocumentUploaded?: () => void
}

export function ProcessOwnersTab({ owners, documents, onDocumentUploaded }: ProcessOwnersTabProps) {
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [docTypesLoading, setDocTypesLoading] = useState(true)

  // Fetch owner doc_types on mount
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

  if (!owners || owners.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum proprietário associado</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {owners.map((owner: any) => {
        const isSingular = owner.person_type === 'singular'
        const byCategory = isSingular ? singularByCategory : coletivaByCategory

        // Map uploaded docs for this owner
        const uploadedForOwner = ownerDocs.map((d) => ({
          doc_type_id: d.doc_type?.id || '',
          file_url: d.file_url,
          file_name: d.file_name,
        }))

        return (
          <Card key={owner.id || owner.name}>
            {/* Card Header with owner name + badges */}
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
              {owner.is_main_contact && (
                <Badge variant="default" className="h-5 px-2 text-[10px] shrink-0">Principal</Badge>
              )}
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
    </div>
  )
}
