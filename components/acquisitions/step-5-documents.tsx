'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DocumentsSection } from '@/components/documents/DocumentsSection'
import { toast } from 'sonner'
import { Upload, Sparkles, Loader2, Check, X, AlertTriangle, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
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

// Categorias cujos documentos devem ter owner_id
const OWNER_DOC_CATEGORIES = ['Proprietário', 'Proprietário Empresa']

interface ClassifiedFile {
  file: File
  index: number
  doc_type_id: string | null
  doc_type_name: string | null
  doc_type_category: string | null
  confidence: 'high' | 'medium' | 'low'
  accepted: boolean
}

interface StepDocumentsProps {
  form: UseFormReturn<any>
}

export function StepDocuments({ form }: StepDocumentsProps) {
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClassifying, setIsClassifying] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFile[]>([])
  const [extractionResult, setExtractionResult] = useState<any>(null)
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const bulkInputRef = useRef<HTMLInputElement>(null)

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

      let ownerIndex: number | undefined
      if (isOwnerDoc && owners.length > 0) {
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

  // 3. Bulk upload with AI classification
  const handleBulkUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsClassifying(true)
    const formData = new FormData()
    const fileArray = Array.from(files)
    fileArray.forEach(f => formData.append('files', f))

    try {
      const res = await fetch('/api/documents/classify', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Erro na classificação')

      const { data } = await res.json()

      const classified: ClassifiedFile[] = fileArray.map((file, idx) => {
        const match = data?.find((d: any) => d.index === idx)
        return {
          file,
          index: idx,
          doc_type_id: match?.doc_type_id || null,
          doc_type_name: match?.doc_type_name || null,
          doc_type_category: match?.doc_type_category || null,
          confidence: match?.confidence || 'low',
          accepted: match?.confidence !== 'low' && !!match?.doc_type_id,
        }
      })

      setClassifiedFiles(classified)
      toast.success(`${fileArray.length} ficheiro${fileArray.length > 1 ? 's' : ''} analisado${fileArray.length > 1 ? 's' : ''}`)
    } catch {
      toast.error('Erro ao classificar documentos')
    } finally {
      setIsClassifying(false)
      if (bulkInputRef.current) bulkInputRef.current.value = ''
    }
  }, [])

  // 4. Apply extracted data to form fields
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set())

  const applyExtractedData = useCallback((data: any) => {
    if (!data) return 0
    let fieldsSet = 0
    const filled = new Set<string>()

    const setField = (field: string, value: any) => {
      if (value == null || value === '') return
      form.setValue(field, value, { shouldValidate: false })
      filled.add(field)
      fieldsSet++
    }

    // Property fields (Step 1)
    if (data.property) {
      const p = data.property
      setField('title', p.title)
      setField('property_type', p.property_type)
      setField('business_type', p.business_type)
      setField('listing_price', typeof p.listing_price === 'number' ? p.listing_price : null)
      setField('energy_certificate', p.energy_certificate)
      // Specifications
      const currentSpecs = form.getValues('specifications') || {}
      const newSpecs = { ...currentSpecs }
      let specsChanged = false
      if (p.typology) { newSpecs.typology = p.typology; filled.add('specifications.typology'); fieldsSet++; specsChanged = true }
      if (p.bedrooms != null) { newSpecs.bedrooms = p.bedrooms; filled.add('specifications.bedrooms'); fieldsSet++; specsChanged = true }
      if (p.bathrooms != null) { newSpecs.bathrooms = p.bathrooms; filled.add('specifications.bathrooms'); fieldsSet++; specsChanged = true }
      if (p.area_gross != null) { newSpecs.area_gross = p.area_gross; filled.add('specifications.area_gross'); fieldsSet++; specsChanged = true }
      if (p.area_util != null) { newSpecs.area_util = p.area_util; filled.add('specifications.area_util'); fieldsSet++; specsChanged = true }
      if (p.construction_year != null) { newSpecs.construction_year = p.construction_year; filled.add('specifications.construction_year'); fieldsSet++; specsChanged = true }
      if (p.parking_spaces != null) { newSpecs.parking_spaces = p.parking_spaces; filled.add('specifications.parking_spaces'); fieldsSet++; specsChanged = true }
      if (specsChanged) form.setValue('specifications', newSpecs)
    }

    // Location fields (Step 2)
    if (data.location) {
      const l = data.location
      setField('address_street', l.address_street)
      setField('city', l.city)
      setField('address_parish', l.address_parish)
      setField('postal_code', l.postal_code)
      if (typeof l.latitude === 'number') setField('latitude', l.latitude)
      if (typeof l.longitude === 'number') setField('longitude', l.longitude)
    }

    // Owners (Step 3)
    if (data.owners && Array.isArray(data.owners) && data.owners.length > 0) {
      const currentOwners = form.getValues('owners') || []
      const hasRealOwners = currentOwners.some((o: any) => o.name && o.name.trim().length > 0)

      if (!hasRealOwners) {
        const newOwners = data.owners.filter((o: any) => o.name).map((o: any, idx: number) => ({
          person_type: o.person_type || 'singular',
          name: o.name || '',
          email: '',
          phone: '',
          nif: o.nif || '',
          nationality: o.nationality || '',
          naturality: o.naturality || '',
          birth_date: o.birth_date || '',
          marital_status: o.marital_status || '',
          marital_regime: o.marital_regime || '',
          address: o.address || '',
          id_doc_type: o.id_doc_type || '',
          id_doc_number: o.id_doc_number || '',
          id_doc_expiry: o.id_doc_expiry || '',
          id_doc_issued_by: o.id_doc_issued_by || '',
          legal_representative_name: o.legal_representative_name || '',
          legal_representative_nif: o.legal_representative_nif || '',
          company_object: o.company_object || '',
          legal_nature: o.legal_nature || '',
          cae_code: o.cae_code || '',
          postal_code: o.postal_code || '',
          city: o.city || '',
          ownership_percentage: Math.round(100 / data.owners.filter((o2: any) => o2.name).length),
          is_main_contact: idx === 0,
          is_pep: false,
          funds_origin: [],
          is_portugal_resident: true,
          beneficiaries: [],
          observations: '',
        }))
        if (newOwners.length > 0) {
          form.setValue('owners', newOwners)
          filled.add('owners')
          fieldsSet += newOwners.length * 5
        }
      } else {
        const updated = currentOwners.map((existing: any) => {
          const match = data.owners.find((o: any) =>
            (o.nif && o.nif === existing.nif) ||
            (o.name && existing.name && o.name.toLowerCase().includes(existing.name.toLowerCase().split(' ')[0]))
          )
          if (!match) return existing
          let changed = false
          const enriched = { ...existing }
          const ownerFields = ['nationality', 'naturality', 'birth_date', 'marital_status', 'marital_regime', 'address', 'id_doc_type', 'id_doc_number', 'id_doc_expiry', 'id_doc_issued_by', 'postal_code', 'city']
          for (const f of ownerFields) {
            if (!existing[f] && match[f]) { enriched[f] = match[f]; changed = true }
          }
          if (changed) filled.add('owners')
          return enriched
        })
        form.setValue('owners', updated)
        fieldsSet += 3
      }
    }

    // Contract fields (Step 4)
    if (data.contract) {
      const c = data.contract
      setField('contract_regime', c.contract_regime)
      setField('commission_agreed', typeof c.commission_agreed === 'number' ? c.commission_agreed : null)
      setField('commission_type', c.commission_type)
      setField('contract_term', c.contract_term)
      setField('contract_expiry', c.contract_expiry)
    }

    setAiFilledFields(prev => new Set([...prev, ...filled]))
    // Store in form so other steps can access it
    form.setValue('_aiFilledFields', Array.from(new Set([...(form.getValues('_aiFilledFields') || []), ...filled])) as any)
    return fieldsSet
  }, [form])

  // 5. Accept all classified files + extract data
  const handleAcceptAll = useCallback(async () => {
    const accepted = classifiedFiles.filter(cf => cf.doc_type_id && cf.accepted)
    if (accepted.length === 0) {
      toast.error('Nenhum documento aceite')
      return
    }

    // Check for duplicates among accepted files
    const docTypeIds = accepted.map(cf => cf.doc_type_id)
    const hasDuplicates = docTypeIds.length !== new Set(docTypeIds).size
    if (hasDuplicates) {
      toast.error('Existem documentos duplicados. Altere o tipo de um deles antes de confirmar.')
      return
    }

    // Add docs to form
    const currentDocs = form.getValues('documents') || []
    const newDocs = accepted.map(cf => {
      const category = cf.doc_type_category || ''
      const isOwnerDoc = OWNER_DOC_CATEGORIES.some(c => category.startsWith(c))
      let ownerIndex: number | undefined
      if (isOwnerDoc && owners.length > 0) {
        ownerIndex = owners.length === 1 ? 0 : Math.max(owners.findIndex(o => o.is_main_contact), 0)
      }

      return {
        doc_type_id: cf.doc_type_id!,
        doc_type_category: category,
        file: cf.file,
        file_name: cf.file.name,
        file_size: cf.file.size,
        file_type: cf.file.type,
        owner_index: ownerIndex,
        metadata: {},
      }
    })

    form.setValue('documents', [...currentDocs, ...newDocs])
    toast.success(`${accepted.length} documento${accepted.length > 1 ? 's' : ''} adicionado${accepted.length > 1 ? 's' : ''}`)

    // Now extract data from PDFs
    const pdfFiles = accepted.filter(cf => cf.file.type === 'application/pdf')
    if (pdfFiles.length > 0) {
      setIsExtracting(true)
      const extractId = toast.loading('A extrair dados dos documentos...')

      try {
        const extractFormData = new FormData()
        const docTypesArray: { name: string; category: string }[] = []

        pdfFiles.forEach(cf => {
          extractFormData.append('files', cf.file)
          docTypesArray.push({
            name: cf.doc_type_name || '',
            category: cf.doc_type_category || '',
          })
        })
        extractFormData.append('doc_types', JSON.stringify(docTypesArray))

        const res = await fetch('/api/documents/extract', {
          method: 'POST',
          body: extractFormData,
        })

        if (res.ok) {
          const json = await res.json()
          const data = json.data
          setExtractionResult(data)
          const fieldsSet = applyExtractedData(data) || 0
          toast.dismiss(extractId)
          if (fieldsSet > 0) {
            toast.success(`${fieldsSet} campos preenchidos automaticamente. Verifique os dados nas outras tabs.`)
          } else {
            toast.info('Não foram encontrados dados adicionais para extrair.')
          }
        } else {
          const err = await res.json()
          toast.dismiss(extractId)
          toast.error(err.error || 'Erro ao extrair dados')
        }
      } catch {
        toast.dismiss(extractId)
        toast.error('Erro ao extrair dados dos documentos')
      } finally {
        setIsExtracting(false)
      }
    }

    setClassifiedFiles([])
  }, [classifiedFiles, form, owners, applyExtractedData])

  // 5. Toggle individual file acceptance
  const toggleFileAccepted = useCallback((index: number) => {
    setClassifiedFiles(prev => prev.map(cf =>
      cf.index === index ? { ...cf, accepted: !cf.accepted } : cf
    ))
  }, [])

  // 6. Change doc type for a classified file
  const changeFileDocType = useCallback((index: number, docTypeId: string) => {
    const dt = docTypes.find(d => d.id === docTypeId)
    setClassifiedFiles(prev => prev.map(cf =>
      cf.index === index ? {
        ...cf,
        doc_type_id: docTypeId,
        doc_type_name: dt?.name || null,
        doc_type_category: dt?.category || null,
        accepted: true,
      } : cf
    ))
  }, [docTypes])

  // 7. Toggle doc for deletion
  const toggleDeleteSelection = useCallback((docTypeId: string) => {
    setSelectedForDeletion(prev => {
      const next = new Set(prev)
      if (next.has(docTypeId)) next.delete(docTypeId)
      else next.add(docTypeId)
      return next
    })
  }, [])

  // 8. Delete a single doc
  const handleDeleteSingle = useCallback((docTypeId: string) => {
    setSelectedForDeletion(new Set([docTypeId]))
    setShowDeleteConfirm(true)
  }, [])

  // 9. Confirm deletion of selected docs
  const handleConfirmDelete = useCallback(() => {
    const currentDocs = form.getValues('documents') || []
    const filtered = currentDocs.filter((d: any) => !selectedForDeletion.has(d.doc_type_id))
    form.setValue('documents', filtered)
    toast.success(`${selectedForDeletion.size} documento${selectedForDeletion.size > 1 ? 's' : ''} removido${selectedForDeletion.size > 1 ? 's' : ''}`)
    setSelectedForDeletion(new Set())
    setShowDeleteConfirm(false)
  }, [form, selectedForDeletion])

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

  const confidenceBadge = (confidence: string) => {
    if (confidence === 'high') return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Alta</Badge>
    if (confidence === 'medium') return <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Média</Badge>
    return <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Baixa</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Documentos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Carregue todos os documentos de uma vez — a IA classifica e extrai os dados automaticamente.
          </p>
        </div>

        <div className="shrink-0">
          <input
            ref={bulkInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            className="hidden"
            onChange={(e) => handleBulkUpload(e.target.files)}
          />
          <Button
            type="button"
            size="lg"
            className="rounded-full gap-2 shadow-md bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white h-11 px-5 font-semibold"
            disabled={isClassifying}
            onClick={() => bulkInputRef.current?.click()}
          >
            {isClassifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A classificar...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Carregar com IA
              </>
            )}
          </Button>
        </div>
      </div>

      {/* AI Classification Results */}
      {classifiedFiles.length > 0 && (
        <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Classificação IA</p>
              <Badge variant="secondary" className="text-[10px]">
                {classifiedFiles.filter(f => f.accepted).length}/{classifiedFiles.length} aceites
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setClassifiedFiles([])}>
                <X className="h-3 w-3 mr-1" />Cancelar
              </Button>
              <Button type="button" size="sm" className="text-xs h-7 rounded-full" onClick={handleAcceptAll} disabled={isExtracting}>
                {isExtracting ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />A extrair...</> : <><Check className="h-3 w-3 mr-1" />Confirmar e Extrair</>}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {classifiedFiles.map((cf) => {
              // Detect duplicates: another accepted file has same doc_type_id
              const isDuplicate = cf.doc_type_id && cf.accepted && classifiedFiles.some(
                other => other.index !== cf.index && other.accepted && other.doc_type_id === cf.doc_type_id
              )
              // Also check if this doc_type is already uploaded in the form
              const alreadyUploaded = cf.doc_type_id && uploadedDocs.some(
                (d: any) => d.doc_type_id === cf.doc_type_id
              )

              return (
              <div
                key={cf.index}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all',
                  cf.accepted ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' : 'bg-muted/30 border-border/50 opacity-60',
                  (isDuplicate || alreadyUploaded) && cf.accepted && 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700'
                )}
              >
                {/* Accept toggle */}
                <button
                  type="button"
                  onClick={() => toggleFileAccepted(cf.index)}
                  className={cn(
                    'h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                    cf.accepted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/30'
                  )}
                >
                  {cf.accepted && <Check className="h-3 w-3" />}
                </button>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cf.file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cf.doc_type_name ? (
                      <span className="text-xs text-muted-foreground">
                        {cf.doc_type_category} &rarr; {cf.doc_type_name}
                      </span>
                    ) : (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Não classificado
                      </span>
                    )}
                    {isDuplicate && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Duplicado — altere o tipo de um deles
                      </span>
                    )}
                    {alreadyUploaded && !isDuplicate && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Já existe um ficheiro deste tipo
                      </span>
                    )}
                  </div>
                </div>

                {/* Confidence */}
                {cf.doc_type_id && confidenceBadge(cf.confidence)}

                {/* Change doc type */}
                <select
                  className="text-xs bg-transparent border rounded-md px-2 py-1 max-w-[180px]"
                  value={cf.doc_type_id || ''}
                  onChange={(e) => changeFileDocType(cf.index, e.target.value)}
                >
                  <option value="">Seleccionar tipo...</option>
                  {Object.entries(byCategory).map(([cat, types]) => (
                    <optgroup key={cat} label={cat}>
                      {types.map(dt => (
                        <option key={dt.id} value={dt.id}>{dt.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Extraction in progress */}
      {isExtracting && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 p-4 flex items-center gap-3 animate-in fade-in duration-300">
          <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">A extrair dados dos documentos...</p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">Os campos do formulário serão preenchidos automaticamente.</p>
          </div>
        </div>
      )}

      {/* Extraction complete banner */}
      {extractionResult && !isExtracting && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800 p-4 flex items-center justify-between animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Dados extraídos com sucesso</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Verifique os campos preenchidos nas tabs anteriores.</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setExtractionResult(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Delete mode toolbar */}
      {selectedForDeletion.size > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 flex items-center justify-between animate-in fade-in duration-200">
          <p className="text-sm text-red-700 dark:text-red-300">
            <span className="font-semibold">{selectedForDeletion.size}</span> documento{selectedForDeletion.size > 1 ? 's' : ''} seleccionado{selectedForDeletion.size > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedForDeletion(new Set())}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" size="sm" className="text-xs h-7 rounded-full" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-3 w-3 mr-1" />Eliminar
            </Button>
          </div>
        </div>
      )}

      <DocumentsSection
        byCategory={byCategory}
        uploadedDocs={uploadedDocs}
        deferred={true}
        onFileSelected={handleFileSelected}
        onDeleteSingle={handleDeleteSingle}
        selectedForDeletion={selectedForDeletion}
        onToggleDeleteSelection={toggleDeleteSelection}
        isInDeleteMode={selectedForDeletion.size > 0}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar documento{selectedForDeletion.size > 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Tem a certeza de que pretende remover {selectedForDeletion.size} documento{selectedForDeletion.size > 1 ? 's' : ''}? Esta acção é irreversível.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete}>
              <Trash2 className="h-4 w-4 mr-2" />Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
