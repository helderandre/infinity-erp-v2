'use client'

import { useEditor } from '@craftjs/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ArrowLeft, Undo2, Redo2, Save, Pencil, Eye, Pen } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/kibo-ui/spinner'
import { useRouter } from 'next/navigation'
import {
  TEMPLATE_CATEGORY_VALUES,
  TEMPLATE_CATEGORY_LABELS_PT,
  type TemplateCategory,
} from '@/lib/constants-template-categories'

export type EditorMode = 'edit' | 'preview'

export type SignatureMode = 'process_owner' | 'sender'

interface EmailTopbarProps {
  name: string
  subject: string
  mode: EditorMode
  signatureMode?: SignatureMode
  category?: TemplateCategory
  onNameChange: (value: string) => void
  onSubjectChange: (value: string) => void
  onSignatureModeChange?: (mode: SignatureMode) => void
  onCategoryChange?: (value: TemplateCategory) => void
  onSave: (editorState: string) => void
  onModeChange: (mode: EditorMode, editorState: string) => void
  isSaving: boolean
}

export function EmailTopbar({
  name,
  subject,
  mode,
  signatureMode = 'process_owner',
  category = 'geral',
  onNameChange,
  onSubjectChange,
  onSignatureModeChange,
  onCategoryChange,
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

      {/* Categoria */}
      {onCategoryChange && (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Categoria</span>
          <Select value={category} onValueChange={(v) => onCategoryChange(v as TemplateCategory)}>
            <SelectTrigger className="h-7 w-[140px] text-xs font-medium border-none shadow-none bg-transparent p-0 gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {TEMPLATE_CATEGORY_VALUES.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {TEMPLATE_CATEGORY_LABELS_PT[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Signature mode */}
      {onSignatureModeChange && (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1">
          <Pen className="h-3.5 w-3.5 text-foreground shrink-0" />
          <Select value={signatureMode} onValueChange={(v) => onSignatureModeChange(v as SignatureMode)}>
            <SelectTrigger className="h-7 w-[180px] text-xs font-medium border-none shadow-none bg-transparent p-0 gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="process_owner" className="text-xs">Assinatura do consultor</SelectItem>
              <SelectItem value="sender" className="text-xs">Assinatura de quem envia</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
            <Spinner variant="infinite" size={16} className="mr-2" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar
        </Button>
      </div>
    </div>
  )
}
