'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Upload, Save, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DocType {
  id: string
  name: string
  description: string | null
  category: string | null
}

interface DocumentEditorTopbarProps {
  name: string
  docTypeId: string
  docTypes: DocType[]
  isSaving: boolean
  isImporting: boolean
  onNameChange: (value: string) => void
  onDocTypeChange: (value: string) => void
  onSave: () => void
  onImportDocx: () => void
}

export function DocumentEditorTopbar({
  name,
  docTypeId,
  docTypes,
  isSaving,
  isImporting,
  onNameChange,
  onDocTypeChange,
  onSave,
  onImportDocx,
}: DocumentEditorTopbarProps) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-3 border-b px-4 py-2 bg-background shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.push('/dashboard/templates-documentos')}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Nome do template..."
        className="max-w-[250px] border-none shadow-none focus-visible:ring-0 font-medium"
      />

      <div className="h-4 w-px bg-border" />

      <Select value={docTypeId} onValueChange={onDocTypeChange}>
        <SelectTrigger className="w-[200px] border-none shadow-none focus-visible:ring-0">
          <SelectValue placeholder="Tipo de documento..." />
        </SelectTrigger>
        <SelectContent>
          {docTypes.map((dt) => (
            <SelectItem key={dt.id} value={dt.id}>
              {dt.name} {dt.category ? `(${dt.category})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={onImportDocx}
          disabled={isImporting}
          className="gap-1.5"
        >
          {isImporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Importar DOCX
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button onClick={onSave} disabled={isSaving} size="sm">
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar
        </Button>
      </div>
    </div>
  )
}
