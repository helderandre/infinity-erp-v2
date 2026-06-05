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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useTemplateVariables } from '@/hooks/use-template-variables'
import { useEmailVariables } from '@/components/email-editor/email-variables-context'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput } from '@/components/email-editor/settings'
import { useEmailTiptap } from '@/components/email-editor/hooks/use-email-tiptap'
import { EmailBubbleMenu } from '@/components/email-editor/email-bubble-menu'
import { registerEditor, unregisterEditor, getEditor } from '@/components/email-editor/hooks/editor-registry'
import { useAutomationVariables } from '@/components/email-editor/automation-variables-context'
import { EmailVariablesGrouped } from '@/components/email-editor/email-variables-grouped'

interface EmailHeadingProps {
  html?: string
  level?: 'h1' | 'h2' | 'h3' | 'h4'
  fontSize?: number
  fontWeight?: string
  color?: string
  textAlign?: string
  fontFamily?: string
  padding?: number
}

export const EmailHeading = ({
  html = 'Título',
  level = 'h2',
  fontSize = 24,
  fontWeight = '700',
  color = '#000000',
  textAlign = 'left',
  fontFamily = 'Arial, sans-serif',
  padding = 0,
}: EmailHeadingProps) => {
  const {
    connectors: { connect, drag },
    actions: { setProp },
    id: nodeId,
  } = useNode((node) => ({ id: node.id }))

  const isInternalUpdate = useRef(false)
  const automationVariables = useAutomationVariables()

  const handleUpdate = useCallback(
    (newHtml: string) => {
      isInternalUpdate.current = true
      setProp((p: EmailHeadingProps) => {
        p.html = newHtml
      })
    },
    [setProp]
  )

  const headingLevel = parseInt(level.replace('h', '')) as 1 | 2 | 3 | 4

  const { editor } = useEmailTiptap({
    content: html,
    onUpdate: handleUpdate,
    placeholder: 'Título...',
    isHeading: true,
    headingLevel,
    variables: automationVariables ?? undefined,
  })

  // Register editor instance for settings panel access
  useEffect(() => {
    if (editor) {
      registerEditor(nodeId, editor)
      return () => unregisterEditor(nodeId)
    }
  }, [editor, nodeId])

  // Sync external prop changes
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
        color,
        textAlign: textAlign as React.CSSProperties['textAlign'],
        fontFamily,
        fontSize,
        fontWeight,
        padding: padding > 0 ? padding : undefined,
      }}
    >
      {editor && <EmailBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

const EmailHeadingSettings = () => {
  const { variables: templateVariables } = useTemplateVariables()
  const { variables: resolvedVariables } = useEmailVariables()
  const {
    actions: { setProp },
    props,
    nodeId,
  } = useNode((node) => ({
    props: node.data.props as EmailHeadingProps,
    nodeId: node.id,
  }))

  const insertVariable = (varKey: string) => {
    const editor = getEditor(nodeId)
    if (editor) {
      editor.chain().focus().insertVariable(varKey).run()
      return
    }
    setProp((p: EmailHeadingProps) => {
      p.html = (props.html || '') + `{{${varKey}}}`
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nível</Label>
        <Select
          value={props.level}
          onValueChange={(v) => setProp((p: EmailHeadingProps) => { p.level = v as EmailHeadingProps['level'] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="h1">H1 - Principal</SelectItem>
            <SelectItem value="h2">H2 - Secundário</SelectItem>
            <SelectItem value="h3">H3 - Terciário</SelectItem>
            <SelectItem value="h4">H4 - Quaternário</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Peso</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={props.fontWeight || '700'}
          onValueChange={(val) => {
            if (val) setProp((p: EmailHeadingProps) => { p.fontWeight = val })
          }}
        >
          <ToggleGroupItem value="400" className="text-xs font-normal">Aa</ToggleGroupItem>
          <ToggleGroupItem value="600" className="text-xs font-semibold">Aa</ToggleGroupItem>
          <ToggleGroupItem value="700" className="text-xs font-bold">Aa</ToggleGroupItem>
          <ToggleGroupItem value="900" className="text-xs font-black">Aa</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={props.textAlign}
          onValueChange={(v) => {
            if (v) setProp((p: EmailHeadingProps) => { p.textAlign = v })
          }}
        >
          <ToggleGroupItem value="left" aria-label="Esquerda">
            <AlignLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Centro">
            <AlignCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Direita">
            <AlignRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tamanho</Label>
        <UnitInput
          value={`${props.fontSize ?? 24}px`}
          onChange={(v) => setProp((p: EmailHeadingProps) => { p.fontSize = parseFloat(v) || 24 })}
          units={['px']}
        />
      </div>

      <ColorPickerField
        label="Cor"
        value={props.color || '#000000'}
        onChange={(v) => setProp((p: EmailHeadingProps) => { p.color = v })}
      />

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Padding</Label>
        <UnitInput
          value={`${props.padding ?? 0}px`}
          onChange={(v) => setProp((p: EmailHeadingProps) => { p.padding = parseFloat(v) || 0 })}
          units={['px']}
        />
      </div>

      <div className="space-y-2">
        <Label>Fonte</Label>
        <Select
          value={props.fontFamily}
          onValueChange={(v) => setProp((p: EmailHeadingProps) => { p.fontFamily = v })}
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

      <EmailVariablesGrouped
        templateVariables={templateVariables}
        resolvedVariables={resolvedVariables}
        onInsertVariable={insertVariable}
      />
    </div>
  )
}

EmailHeading.craft = {
  displayName: 'Título',
  props: {
    html: 'Título',
    level: 'h2',
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
    fontFamily: 'Arial, sans-serif',
    padding: 0,
  },
  related: {
    settings: EmailHeadingSettings,
  },
}
