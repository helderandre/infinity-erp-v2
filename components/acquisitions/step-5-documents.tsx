'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentsSection } from '@/components/documents/DocumentsSection'
import { toast } from 'sonner'
import type { DocType } from '@/types/document'

// Categorias de tipos de documento relevantes para angariacao
const ACQUISITION_DOC_CATEGORIES = [
  'Contratual',
  'Imóvel',
  'Jurídico',
  'Jurídico Especial',
]

// Categorias cujos documentos devem ter owner_id
const OWNER_DOC_CATEGORIES = ['Proprietário', 'Proprietário Empresa']

interface StepDocumentsProps {
  form: UseFormReturn<any>
}

export function StepDocuments({ form }: StepDocumentsProps) {
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Owners do Step 3 (disponíveis no form state)
  const ownersRaw = form.watch('owners')
  const owners = useMemo(
    () => (Array.isArray(ownersRaw) ? ownersRaw : []) as Array<{ is_main_contact?: boolean }>,
    [ownersRaw]
  )

  // Mapa de docTypeId → category para lookup rápido
  const docTypeCategoryMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const dt of docTypes) {
      map[dt.id] = dt.category
    }
    return map
  }, [docTypes])

  // 1. Carregar doc_types
  useEffect(() => {
    fetch('/api/libraries/doc-types')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDocTypes(
            data.filter((dt: DocType) =>
              ACQUISITION_DOC_CATEGORIES.includes(dt.category)
            )
          )
        }
      })
      .catch((err) => console.error('Erro ao carregar tipos de documento:', err))
      .finally(() => setIsLoading(false))
  }, [])

  // 2. Handler de ficheiro seleccionado (modo deferred)
  const handleFileSelected = useCallback(
    (file: File, docTypeId: string) => {
      const category = docTypeCategoryMap[docTypeId] || ''
      const isOwnerDoc = OWNER_DOC_CATEGORIES.some((c) => category.startsWith(c))

      // Resolver owner_index: se é doc de proprietário, associar ao owner
      let ownerIndex: number | undefined
      if (isOwnerDoc && owners.length > 0) {
        // Se só há 1 proprietário, usar automaticamente
        // Se há múltiplos, usar o primeiro marcado como main_contact ou index 0
        if (owners.length === 1) {
          ownerIndex = 0
        } else {
          const mainIdx = owners.findIndex((o) => o.is_main_contact)
          ownerIndex = mainIdx >= 0 ? mainIdx : 0
        }
      }

      const currentDocs = form.getValues('documents') || []
      form.setValue('documents', [
        ...currentDocs,
        {
          doc_type_id: docTypeId,
          doc_type_category: category,
          file: file,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          owner_index: ownerIndex,
          metadata: {},
        },
      ])
      toast.success(`Ficheiro "${file.name}" seleccionado`)
    },
    [form, docTypeCategoryMap, owners]
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  // Agrupar doc_types por categoria
  const byCategory = docTypes.reduce<Record<string, DocType[]>>((acc, dt) => {
    const cat = dt.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  const uploadedDocs = form.watch('documents') || []

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Documentos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O upload de documentos é opcional nesta fase. Documentos carregados aqui
          serão automaticamente associados ao processo.
        </p>
      </div>

      <DocumentsSection
        byCategory={byCategory}
        uploadedDocs={uploadedDocs}
        deferred={true}
        onFileSelected={handleFileSelected}
      />
    </div>
  )
}
