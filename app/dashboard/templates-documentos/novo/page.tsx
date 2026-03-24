'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentTemplateEditor } from '@/components/documents/document-template-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/kibo-ui/spinner'
import { FileCode2, FileType, Upload, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function NovoTemplateDocumentoPage() {
  const router = useRouter()
  const [templateType, setTemplateType] = useState<'html' | 'pdf' | null>(null)

  if (templateType === null) {
    return <TemplateTypeSelector onSelect={setTemplateType} />
  }

  if (templateType === 'html') {
    return <DocumentTemplateEditor templateId={null} initialTemplate={null} />
  }

  return (
    <PdfTemplateUploadForm
      onBack={() => setTemplateType(null)}
      onCreated={(id) => router.push(`/dashboard/templates-documentos/${id}`)}
    />
  )
}

function TemplateTypeSelector({
  onSelect,
}: {
  onSelect: (type: 'html' | 'pdf') => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Novo Template de Documento</h1>
        <p className="text-muted-foreground mt-1">
          Escolha o tipo de template que pretende criar
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
        <button
          onClick={() => onSelect('html')}
          className="group flex flex-col items-center gap-4 rounded-xl border-2 border-border p-8 hover:border-primary hover:bg-accent/50 transition-all cursor-pointer"
        >
          <div className="rounded-full bg-slate-100 p-4 group-hover:bg-primary/10">
            <FileCode2 className="h-8 w-8 text-slate-600 group-hover:text-primary" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">HTML</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Editor de texto rico com variáveis dinâmicas
            </p>
          </div>
        </button>

        <button
          onClick={() => onSelect('pdf')}
          className="group flex flex-col items-center gap-4 rounded-xl border-2 border-border p-8 hover:border-red-500 hover:bg-red-50/50 transition-all cursor-pointer"
        >
          <div className="rounded-full bg-red-50 p-4 group-hover:bg-red-100">
            <FileType className="h-8 w-8 text-red-600" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">PDF (AcroForm)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload de PDF com campos preenchíveis e mapeamento de variáveis
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}

function PdfTemplateUploadForm({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [docTypeId, setDocTypeId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [docTypes, setDocTypes] = useState<{ id: string; name: string; category: string | null }[]>([])

  const fetchDocTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/libraries/doc-types')
      if (res.ok) setDocTypes(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchDocTypes()
  }, [fetchDocTypes])

  const handleSubmit = async () => {
    if (!name.trim() || !file) {
      toast.error('Nome e ficheiro PDF são obrigatórios')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name.trim())
      formData.append('template_type', 'pdf')
      if (description) formData.append('description', description)
      if (docTypeId) formData.append('doc_type_id', docTypeId)

      const res = await fetch('/api/libraries/docs', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar template')
      }

      const template = await res.json()
      toast.success(`Template criado com ${template.total_fields || 0} campos detectados`)
      onCreated(template.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar template')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">Novo Template PDF</h1>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Nome do Template *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Contrato de Mediação Imobiliária"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional..."
            />
          </div>

          <div>
            <Label>Tipo de Documento</Label>
            <Select
              value={docTypeId || '__none__'}
              onValueChange={(v) => setDocTypeId(v === '__none__' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(Nenhum)</SelectItem>
                {docTypes.map((dt) => (
                  <SelectItem key={dt.id} value={dt.id}>
                    {dt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Ficheiro PDF *</Label>
            <div className="mt-1">
              {file ? (
                <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
                  <FileType className="h-5 w-5 text-red-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                    Remover
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary hover:bg-accent/30 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Clique para seleccionar um PDF com campos AcroForm
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) setFile(f)
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={isSubmitting || !name.trim() || !file}
        >
          {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
          Criar Template
        </Button>
      </div>
    </div>
  )
}
