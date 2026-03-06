'use client'

import { useNode } from '@craftjs/core'
import { useRef, useEffect, useCallback } from 'react'
import { EditorContent } from '@tiptap/react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTemplateVariables } from '@/hooks/use-template-variables'
import { useEmailVariables } from '@/components/email-editor/email-variables-context'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput } from '@/components/email-editor/settings'
import { useEmailTiptap } from '@/components/email-editor/hooks/use-email-tiptap'
import { EmailBubbleMenu } from '@/components/email-editor/email-bubble-menu'
import { registerEditor, unregisterEditor, getEditor } from '@/components/email-editor/hooks/editor-registry'

interface EmailTextProps {
  html?: string
  fontSize?: number
  color?: string
  textAlign?: string
  lineHeight?: number
  fontFamily?: string
  rows?: number
}

export const EmailText = ({
  html = 'Texto de exemplo',
  fontSize = 16,
  color = '#000000',
  textAlign = 'left',
  lineHeight = 1.5,
  fontFamily = 'Arial, sans-serif',
  rows,
}: EmailTextProps) => {
  const {
    connectors: { connect, drag },
    actions: { setProp },
    id: nodeId,
  } = useNode((node) => ({ id: node.id }))

  const isInternalUpdate = useRef(false)

  const handleUpdate = useCallback(
    (newHtml: string) => {
      isInternalUpdate.current = true
      setProp((p: EmailTextProps) => {
        p.html = newHtml
      })
    },
    [setProp]
  )

  const { editor } = useEmailTiptap({
    content: html,
    onUpdate: handleUpdate,
    placeholder: 'Escreva aqui...',
  })

  // Register editor instance for settings panel access
  useEffect(() => {
    if (editor) {
      registerEditor(nodeId, editor)
      return () => unregisterEditor(nodeId)
    }
  }, [editor, nodeId])

  // Sync external prop changes (e.g. from variable insertion in settings)
  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
  }, [html, editor])

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      className="email-tiptap"
      style={{
        fontSize,
        color,
        textAlign: textAlign as React.CSSProperties['textAlign'],
        lineHeight,
        fontFamily,
        minHeight: rows ? `${rows * lineHeight}em` : undefined,
      }}
    >
      {editor && <EmailBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}


const EmailTextSettings = () => {
  const { variables: templateVariables } = useTemplateVariables()
  const { variables: resolvedVariables } = useEmailVariables()
  const {
    actions: { setProp },
    fontSize,
    color,
    lineHeight,
    fontFamily,
    html,
    rows,
    nodeId,
  } = useNode((node) => ({
    fontSize: node.data.props.fontSize,
    color: node.data.props.color,
    textAlign: node.data.props.textAlign,
    lineHeight: node.data.props.lineHeight,
    fontFamily: node.data.props.fontFamily,
    html: node.data.props.html,
    rows: node.data.props.rows,
    nodeId: node.id,
  }))

  const insertVariable = (varKey: string) => {
    const editor = getEditor(nodeId)
    if (editor) {
      editor.chain().focus().insertVariable(varKey).run()
      return
    }
    // Fallback: append to html prop
    setProp((p: EmailTextProps) => {
      p.html = (html || '') + `{{${varKey}}}`
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tamanho</Label>
        <UnitInput
          value={`${fontSize}px`}
          onChange={(v) => setProp((p: EmailTextProps) => { p.fontSize = parseFloat(v) || 16 })}
          units={['px']}
        />
      </div>

      <ColorPickerField
        label="Cor"
        value={color}
        onChange={(v) => setProp((p: EmailTextProps) => { p.color = v })}
      />

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Altura da Linha</Label>
        <UnitInput
          value={`${lineHeight}`}
          onChange={(v) => setProp((p: EmailTextProps) => { p.lineHeight = parseFloat(v) || 1.5 })}
          units={['']}
          step={0.1}
          min={1}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Linhas mínimas</Label>
        <UnitInput
          value={`${rows || 0}`}
          onChange={(v) => setProp((p: EmailTextProps) => { p.rows = parseFloat(v) || undefined })}
          units={['']}
          min={0}
        />
      </div>

      <div className="space-y-2">
        <Label>Fonte</Label>
        <Select
          value={fontFamily}
          onValueChange={(v) => setProp((p: EmailTextProps) => { p.fontFamily = v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Arial, sans-serif">Arial</SelectItem>
            <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
            <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
            <SelectItem value="Tahoma, sans-serif">Tahoma</SelectItem>
            <SelectItem value="Trebuchet MS, sans-serif">Trebuchet MS</SelectItem>
            <SelectItem value="Lucida Sans, Lucida Grande, sans-serif">Lucida Sans</SelectItem>
            <SelectItem value="Segoe UI, sans-serif">Segoe UI</SelectItem>
            <SelectItem value="Georgia, serif">Georgia</SelectItem>
            <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
            <SelectItem value="Palatino, Palatino Linotype, serif">Palatino</SelectItem>
            <SelectItem value="Book Antiqua, Palatino, serif">Book Antiqua</SelectItem>
            <SelectItem value="Courier New, monospace">Courier New</SelectItem>
            <SelectItem value="Lucida Console, monospace">Lucida Console</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Variáveis</Label>
        <div className="flex flex-wrap gap-1">
          {templateVariables.map((v) => {
            const resolved = resolvedVariables[v.key]
            const hasResolved = resolved !== undefined && resolved !== ''
            return (
              <button
                key={v.key}
                type="button"
                className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors text-left"
                onClick={() => insertVariable(v.key)}
                title={hasResolved ? `${v.label}: ${resolved}` : v.label}
              >
                {hasResolved ? (
                  <span className="font-medium">{resolved}</span>
                ) : (
                  v.label
                )}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Clique para inserir na posição do cursor
        </p>
      </div>
    </div>
  )
}

EmailText.craft = {
  displayName: 'Texto',
  props: {
    html: 'Texto de exemplo',
    fontSize: 16,
    color: '#000000',
    textAlign: 'left',
    lineHeight: 1.5,
    fontFamily: 'Arial, sans-serif',
  },
  related: {
    settings: EmailTextSettings,
  },
}
