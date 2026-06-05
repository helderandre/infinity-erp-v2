'use client'

import { useState, useEffect, useRef } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, FileText, X, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import type { DocType } from '@/types/document'

interface OwnerDocumentsInlineProps {
  form: UseFormReturn<any>
  ownerIndex: number
  personType: 'singular' | 'coletiva'
}

export function OwnerDocumentsInline({ form, ownerIndex, personType }: OwnerDocumentsInlineProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Buscar doc_types conforme personType
  useEffect(() => {
    const category = personType === 'singular' ? 'Proprietário' : 'Proprietário Empresa'
    setIsLoading(true)
    fetch(`/api/libraries/doc-types?category=${encodeURIComponent(category)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDocTypes(data)
        }
      })
      .catch((err) => console.error('Erro ao carregar tipos de documento:', err))
      .finally(() => setIsLoading(false))
  }, [personType])

  // Documentos já seleccionados para este owner
  const allDocs: any[] = form.watch('documents') || []
  const ownerDocs = allDocs.filter((d: any) => d.owner_index === ownerIndex)

  const getDocForType = (docTypeId: string) => {
    return ownerDocs.find((d: any) => d.doc_type_id === docTypeId)
  }

  const handleFileSelect = (file: File, docType: DocType) => {
    const currentDocs = form.getValues('documents') || []
    // Remover doc existente para este tipo + owner (substituir)
    const filtered = currentDocs.filter(
      (d: any) => !(d.doc_type_id === docType.id && d.owner_index === ownerIndex)
    )
    form.setValue('documents', [
      ...filtered,
      {
        doc_type_id: docType.id,
        doc_type_category: docType.category,
        file: file,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        owner_index: ownerIndex,
        metadata: {},
      },
    ])
    toast.success(`Ficheiro "${file.name}" seleccionado`)
  }

  const handleRemove = (docTypeId: string) => {
    const currentDocs = form.getValues('documents') || []
    form.setValue(
      'documents',
      currentDocs.filter(
        (d: any) => !(d.doc_type_id === docTypeId && d.owner_index === ownerIndex)
      )
    )
    // Limpar o input file
    const input = fileInputRefs.current[docTypeId]
    if (input) input.value = ''
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between" type="button">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos — {personType === 'singular' ? 'Pessoa Singular' : 'Pessoa Colectiva'}
            {ownerDocs.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {ownerDocs.length}
              </Badge>
            )}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : docTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum tipo de documento configurado para esta categoria.
          </p>
        ) : (
          docTypes.map((dt) => {
            const existingDoc = getDocForType(dt.id)
            return (
              <div
                key={dt.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{dt.name}</p>
                  {dt.description && (
                    <p className="text-xs text-muted-foreground truncate">{dt.description}</p>
                  )}
                </div>

                {existingDoc ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs gap-1 max-w-[200px]">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{existingDoc.file_name}</span>
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleRemove(dt.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="shrink-0">
                    <input
                      ref={(el) => { fileInputRefs.current[dt.id] = el }}
                      type="file"
                      accept={dt.allowed_extensions?.map((ext) => `.${ext}`).join(',') || undefined}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileSelect(file, dt)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRefs.current[dt.id]?.click()}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Seleccionar
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
