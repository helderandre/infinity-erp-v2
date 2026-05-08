'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Sparkles, Loader2, Check, X, AlertTriangle, Trash2, Info, AlertCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
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
      if (p.area_gross_private != null) { newSpecs.area_gross_private = p.area_gross_private; filled.add('specifications.area_gross_private'); fieldsSet++; specsChanged = true }
      if (p.area_util != null) { newSpecs.area_util = p.area_util; filled.add('specifications.area_util'); fieldsSet++; specsChanged = true }
      if (p.area_total_lot != null) { newSpecs.area_total_lot = p.area_total_lot; filled.add('specifications.area_total_lot'); fieldsSet++; specsChanged = true }
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

    // Legal data (dev_property_legal_data) — só fica em form state, gravado no submit (POST /api/acquisitions)
    if (data.legal_data && typeof data.legal_data === 'object') {
      const currentLegal = (form.getValues('legal_data') || {}) as Record<string, any>
      const merged: Record<string, any> = { ...currentLegal }
      let legalChanged = false
      for (const [k, v] of Object.entries(data.legal_data)) {
        if (v == null || v === '') continue
        if (typeof v === 'string' && v.trim() === '') continue
        if (currentLegal[k]) continue // não sobrescrever campos já preenchidos
        merged[k] = v
        legalChanged = true
        fieldsSet++
      }
      if (legalChanged) {
        form.setValue('legal_data', merged as any, { shouldValidate: false })
        filled.add('legal_data')
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
      {/* Header centrado — só título + CTA. A lista detalhada de tipos de
          documento foi escondida; a IA classifica e extrai automaticamente
          o que carregares. O botão "i" abre um popover com os documentos
          tipicamente esperados nesta fase. */}
      <div className="flex flex-col items-center text-center gap-3 pt-2">
        <h3 className="text-2xl font-semibold tracking-tight">Documentos</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Carrega os documentos que já tenhas
          <br />
          <span className="text-muted-foreground/80">a IA trata do resto.</span>
        </p>

        <input
          ref={bulkInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          className="hidden"
          onChange={(e) => handleBulkUpload(e.target.files)}
        />
        <div className="flex items-center gap-2">
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

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Que documentos preciso?"
                className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 rounded-2xl p-4 text-sm"
            >
              <p className="font-semibold mb-2">Documentos típicos da angariação</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Caderneta Predial Urbana (CPU)</li>
                <li>• Certidão Permanente do Registo Predial (CRP)</li>
                <li>• Certificado Energético (CE/SCE)</li>
                <li>• Licença de Utilização (Câmara Municipal)</li>
                <li>• Ficha Técnica de Habitação (FTH) — se posterior a 2004</li>
                <li>• Plantas do imóvel</li>
                <li>• Cartão de Cidadão / NIF dos proprietários</li>
                <li>• Comprovativo de morada dos proprietários</li>
                <li>• Distrate da hipoteca (se aplicável)</li>
                <li>• CMI assinado</li>
              </ul>
              <p className="text-[11px] text-muted-foreground/80 mt-3">
                Não precisas de carregar tudo agora — podes adicionar depois na ficha do imóvel.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        {/* Lembrete vermelho — as plantas são frequentemente esquecidas e
            essenciais para o anúncio nos portais. */}
        <div className="w-full max-w-md mt-2 rounded-xl border border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/30 px-4 py-3 flex items-start gap-2.5 text-left">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-300 shrink-0 mt-0.5" />
          <div className="text-[13px] leading-snug">
            <p className="font-semibold text-red-700 dark:text-red-300">
              Não te esqueças das plantas caso já as tenhas…
            </p>
            <p className="text-red-600/80 dark:text-red-400/80 text-xs mt-0.5">
              São essenciais para o anúncio nos portais.
            </p>
          </div>
        </div>
      </div>

      {/* AI Classification Results — mobile-first: header empilha, cada linha
          tem o nome em cima e o selector full-width em baixo. */}
      {classifiedFiles.length > 0 && (
        <div className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3 sm:p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm font-semibold truncate">Classificação IA</p>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {classifiedFiles.filter(f => f.accepted).length}/{classifiedFiles.length} aceites
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 ml-auto sm:ml-0 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-8 rounded-full px-2 sm:px-3"
                onClick={() => setClassifiedFiles([])}
              >
                <X className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Cancelar</span>
              </Button>
              <Button
                type="button"
                size="sm"
                className="text-xs h-8 rounded-full px-3"
                onClick={handleAcceptAll}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    <span className="hidden xs:inline">A extrair…</span>
                    <span className="xs:hidden">…</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Confirmar e Extrair</span>
                    <span className="sm:hidden">Confirmar</span>
                  </>
                )}
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
                  'rounded-xl border px-3 py-2.5 transition-all',
                  // Mobile: empilhamento vertical; sm+: linha horizontal
                  'flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2',
                  cf.accepted ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' : 'bg-muted/30 border-border/50 opacity-60',
                  (isDuplicate || alreadyUploaded) && cf.accepted && 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700'
                )}
              >
                {/* Linha 1 (mobile) / esquerda (desktop): toggle + nome + meta */}
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleFileAccepted(cf.index)}
                    className={cn(
                      'h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors mt-0.5',
                      cf.accepted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/30'
                    )}
                  >
                    {cf.accepted && <Check className="h-3 w-3" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate min-w-0">{cf.file.name}</p>
                      {cf.doc_type_id && (
                        <span className="shrink-0">
                          {confidenceBadge(cf.confidence)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                      {cf.doc_type_name ? (
                        <span className="text-[11px] text-muted-foreground truncate max-w-full">
                          {cf.doc_type_category} → {cf.doc_type_name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-red-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Não classificado
                        </span>
                      )}
                      {isDuplicate && (
                        <span className="text-[11px] text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Duplicado
                        </span>
                      )}
                      {alreadyUploaded && !isDuplicate && (
                        <span className="text-[11px] text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Já existe um deste tipo
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selector — full-width em mobile, fixo em desktop */}
                <select
                  className="text-xs bg-background/80 border rounded-lg px-2 py-1.5 w-full sm:w-auto sm:max-w-[200px] sm:shrink-0"
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
