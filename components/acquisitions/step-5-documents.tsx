'use client'

import { useState, useEffect, useCallback } from 'react'
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
  'Proprietário',
  'Proprietário Empresa',
]

interface StepDocumentsProps {
  form: UseFormReturn<any>
}

export function StepDocuments({ form }: StepDocumentsProps) {
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
      const currentDocs = form.getValues('documents') || []
      form.setValue('documents', [
        ...currentDocs,
        {
          doc_type_id: docTypeId,
          file: file,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          metadata: {},
        },
      ])
      toast.success(`Ficheiro "${file.name}" seleccionado`)
    },
    [form]
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
