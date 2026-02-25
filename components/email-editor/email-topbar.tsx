'use client'

import { useEditor } from '@craftjs/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ArrowLeft, Undo2, Redo2, Save, Loader2, Pencil, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'

export type EditorMode = 'edit' | 'preview'

interface EmailTopbarProps {
  name: string
  subject: string
  mode: EditorMode
  onNameChange: (value: string) => void
  onSubjectChange: (value: string) => void
  onSave: (editorState: string) => void
  onModeChange: (mode: EditorMode, editorState: string) => void
  isSaving: boolean
}

export function EmailTopbar({
  name,
  subject,
  mode,
  onNameChange,
  onSubjectChange,
  onSave,
  onModeChange,
  isSaving,
}: EmailTopbarProps) {
  const router = useRouter()
  const { actions, query, canUndo, canRedo } = useEditor((state, query) => ({
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }))

  const handleSave = () => {
    const editorState = query.serialize()
    onSave(editorState)
  }

  const handleModeChange = (value: string) => {
    if (!value) return
    const editorState = query.serialize()
    onModeChange(value as EditorMode, editorState)
  }

  return (
    <div className="flex items-center gap-3 border-b px-4 py-2 bg-background shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.push('/dashboard/templates-email')}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Nome do template..."
        className="max-w-[200px] border-none shadow-none focus-visible:ring-0 font-medium"
      />

      <div className="h-4 w-px bg-border" />

      <Input
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
        placeholder="Assunto do email..."
        className="flex-1 border-none shadow-none focus-visible:ring-0 text-sm text-muted-foreground"
      />

      <div className="flex items-center gap-1 ml-auto">
        {/* Mode toggle */}
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={handleModeChange}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="edit" aria-label="Modo Edição" className="gap-1.5 px-3">
            <Pencil className="h-3.5 w-3.5" />
            Edição
          </ToggleGroupItem>
          <ToggleGroupItem value="preview" aria-label="Modo Pré-visualização" className="gap-1.5 px-3">
            <Eye className="h-3.5 w-3.5" />
            Pré-visualizar
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          disabled={!canUndo || mode === 'preview'}
          onClick={() => actions.history.undo()}
          title="Desfazer"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canRedo || mode === 'preview'}
          onClick={() => actions.history.redo()}
          title="Refazer"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button onClick={handleSave} disabled={isSaving} size="sm">
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
