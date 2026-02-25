'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DocumentEditor } from '@/components/document-editor/document-editor'
import { DocumentVariablesSidebar } from '@/components/document-editor/document-variables-sidebar'
import { DocumentSettingsSidebar } from '@/components/document-editor/document-settings-sidebar'
import { DocumentEditorTopbar } from '@/components/document-editor/document-editor-topbar'
import type { DocumentEditorRef } from '@/components/document-editor/types'
import { convertDocxToHtml } from '@/components/document-editor/utils/docx-to-html'
import { decorateVariablesInHtml } from '@/components/document-editor/utils/variable-html'
import { useTemplateVariables } from '@/hooks/use-template-variables'

interface DocType {
  id: string
  name: string
  description: string | null
  category: string | null
}

export interface DocumentTemplatePayload {
  id?: string
  name: string
  description: string | null
  content_html: string
  doc_type_id: string | null
  letterhead_url?: string | null
  letterhead_file_name?: string | null
  letterhead_file_type?: string | null
}

interface DocumentTemplateEditorProps {
  templateId: string | null
  initialTemplate?: DocumentTemplatePayload | null
}

export function DocumentTemplateEditor({ templateId, initialTemplate }: DocumentTemplateEditorProps) {
  const router = useRouter()
  const editorRef = useRef<DocumentEditorRef>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const docxInputRef = useRef<HTMLInputElement>(null)

  const { variables, isLoading: isLoadingVariables } = useTemplateVariables()
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const [name, setName] = useState(initialTemplate?.name || '')
  const [description, setDescription] = useState(initialTemplate?.description || '')
  const [docTypeId, setDocTypeId] = useState(initialTemplate?.doc_type_id || '')
  const [letterheadUrl, setLetterheadUrl] = useState(initialTemplate?.letterhead_url || '')
  const [letterheadFileName, setLetterheadFileName] = useState(initialTemplate?.letterhead_file_name || '')
  const [letterheadFileType, setLetterheadFileType] = useState(initialTemplate?.letterhead_file_type || '')

  useEffect(() => {
    if (!initialTemplate) return
    setName(initialTemplate.name || '')
    setDescription(initialTemplate.description || '')
    setDocTypeId(initialTemplate.doc_type_id || '')
    setLetterheadUrl(initialTemplate.letterhead_url || '')
    setLetterheadFileName(initialTemplate.letterhead_file_name || '')
    setLetterheadFileType(initialTemplate.letterhead_file_type || '')
  }, [initialTemplate])

  useEffect(() => {
    let isMounted = true
    fetch('/api/libraries/doc-types')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) setDocTypes(data)
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  const getIsSystem = useCallback(
    (key: string) => variables.some((v) => v.key === key && v.is_system),
    [variables]
  )

  const getSlashCommandVariables = useCallback(() => variables, [variables])

  const systemKeys = useMemo(() => variables.filter((v) => v.is_system).map((v) => v.key), [variables])

  useEffect(() => {
    if (!initialTemplate?.content_html) return
    if (isLoadingVariables) return
    const decorated = decorateVariablesInHtml(initialTemplate.content_html, systemKeys)
    editorRef.current?.editor?.commands.setContent(decorated)
  }, [initialTemplate?.content_html, isLoadingVariables, systemKeys])

  const handleSave = async () => {
    const html = editorRef.current?.getHTML() || ''
    if (!name.trim()) {
      toast.error('O nome do template é obrigatório')
      return
    }
    if (!html.trim()) {
      toast.error('O conteúdo é obrigatório')
      return
    }

    setIsSaving(true)
    try {
      const payload: DocumentTemplatePayload = {
        name: name.trim(),
        description: description.trim() || null,
        content_html: html,
        doc_type_id: docTypeId || null,
        letterhead_url: letterheadUrl || null,
        letterhead_file_name: letterheadFileName || null,
        letterhead_file_type: letterheadFileType || null,
      }

      const res = templateId
        ? await fetch(`/api/libraries/docs/${templateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/libraries/docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!res.ok) throw new Error('Erro ao guardar template')
      const data = await res.json()
      toast.success('Template guardado com sucesso')
      if (!templateId) {
        router.push(`/dashboard/templates-documentos/${data.id}`)
      }
    } catch (error) {
      console.error('Erro ao guardar template:', error)
      toast.error('Erro ao guardar template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleInsertImage = () => {
    imageInputRef.current?.click()
  }

  const handleImageFile = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/libraries/docs/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Erro ao fazer upload da imagem')
      const data = await res.json()
      editorRef.current?.editor?.chain().focus().setImage({ src: data.url }).run()
    } catch (error) {
      console.error('Erro ao inserir imagem:', error)
      toast.error('Erro ao inserir imagem')
    }
  }

  const handleDocxImport = async (file: File) => {
    setIsImporting(true)
    try {
      const result = await convertDocxToHtml(file)
      const decorated = decorateVariablesInHtml(result.html, systemKeys)
      editorRef.current?.editor?.commands.setContent(decorated)

      if (result.messages.length > 0) {
        toast('Importação concluída com avisos', {
          description: result.messages.slice(0, 3).join(' | '),
        })
      } else {
        toast.success('Documento importado com sucesso')
      }
    } catch (error) {
      console.error('Erro ao importar DOCX:', error)
      toast.error('Erro ao importar DOCX')
    } finally {
      setIsImporting(false)
    }
  }

  const handleLetterheadUpload = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/libraries/docs/upload-letterhead', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Erro ao enviar timbrado')
      const data = await res.json()
      setLetterheadUrl(data.url)
      setLetterheadFileName(data.fileName)
      setLetterheadFileType(data.fileType)
      toast.success('Timbrado carregado com sucesso')
    } catch (error) {
      console.error('Erro ao carregar timbrado:', error)
      toast.error('Erro ao carregar timbrado')
    }
  }

  const clearLetterhead = () => {
    setLetterheadUrl('')
    setLetterheadFileName('')
    setLetterheadFileType('')
  }

  return (
    <div className="flex flex-col -m-4 md:-m-6 h-[calc(100vh-56px)] min-h-[calc(100vh-56px)] overflow-hidden">
      {/* Topbar compacta */}
      <DocumentEditorTopbar
        name={name}
        docTypeId={docTypeId}
        docTypes={docTypes}
        isSaving={isSaving}
        isImporting={isImporting}
        onNameChange={setName}
        onDocTypeChange={setDocTypeId}
        onSave={handleSave}
        onImportDocx={() => docxInputRef.current?.click()}
      />

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar com Configurações */}
        <DocumentSettingsSidebar
          description={description}
          letterheadUrl={letterheadUrl}
          letterheadFileName={letterheadFileName}
          onDescriptionChange={setDescription}
          onLetterheadUpload={handleLetterheadUpload}
          onLetterheadClear={clearLetterhead}
          isLoadingLetterhead={isImporting}
        />

        {/* Editor */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <DocumentEditor
            ref={editorRef}
            mode="template"
            content={initialTemplate?.content_html || ''}
            getIsSystem={getIsSystem}
            getSlashCommandVariables={getSlashCommandVariables}
            onInsertImage={handleInsertImage}
          />
        </div>

        {/* Right Sidebar com Variáveis */}
        <DocumentVariablesSidebar
          allVariables={variables}
          onVariableClick={(key) => editorRef.current?.insertVariable(key, getIsSystem(key))}
        />
      </div>

      {/* Dialog de Configurações */}

      {/* Hidden inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageFile(file)
          e.currentTarget.value = ''
        }}
      />

      <input
        ref={docxInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleDocxImport(file)
          e.currentTarget.value = ''
        }}
      />
    </div>
  )
}
