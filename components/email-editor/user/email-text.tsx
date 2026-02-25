'use client'

import { useNode } from '@craftjs/core'
import { useRef, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline, Strikethrough } from 'lucide-react'
import { useTemplateVariables } from '@/hooks/use-template-variables'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput } from '@/components/email-editor/settings'

interface EmailTextProps {
  html?: string
  fontSize?: number
  color?: string
  textAlign?: string
  lineHeight?: number
  fontFamily?: string
  rows?: number
}

const VAR_STYLE = [
  'background-color: color-mix(in oklch, var(--muted), transparent)',
  'border: 1px solid var(--border)',
  'border-radius: 6px',
  'padding: 1px 6px',
  'font-size: 0.9em',
  'font-family: ui-monospace, monospace',
  'white-space: nowrap',
].join(';')

function highlightVariables(html: string): string {
  return html.replace(
    /(\{\{[^}]+\}\})/g,
    `<span class="email-variable" contenteditable="false" style="${VAR_STYLE}">$1</span>`
  )
}

function cleanVariables(html: string): string {
  return html.replace(
    /<span class="email-variable"[^>]*>(.*?)<\/span>/g,
    '$1'
  )
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
  } = useNode()

  const editorRef = useRef<HTMLParagraphElement>(null)
  const lastHtml = useRef(html)

  useEffect(() => {
    if (editorRef.current && html !== lastHtml.current) {
      editorRef.current.innerHTML = highlightVariables(html)
      lastHtml.current = html
    }
  }, [html])

  const handleBlur = () => {
    if (editorRef.current) {
      const cleaned = cleanVariables(editorRef.current.innerHTML)
      lastHtml.current = cleaned
      setProp((p: EmailTextProps) => {
        p.html = cleaned
      })
    }
  }

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
    >
      <p
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        style={{
          fontSize,
          color,
          textAlign: textAlign as React.CSSProperties['textAlign'],
          lineHeight,
          fontFamily,
          margin: 0,
          outline: 'none',
          cursor: 'text',
          minHeight: rows ? `${rows * lineHeight}em` : undefined,
        }}
        dangerouslySetInnerHTML={{ __html: highlightVariables(html) }}
      />
    </div>
  )
}


const EmailTextSettings = () => {
  const { variables: templateVariables } = useTemplateVariables()
  const {
    actions: { setProp },
    fontSize,
    color,
    textAlign,
    lineHeight,
    fontFamily,
    html,
    rows,
  } = useNode((node) => ({
    fontSize: node.data.props.fontSize,
    color: node.data.props.color,
    textAlign: node.data.props.textAlign,
    lineHeight: node.data.props.lineHeight,
    fontFamily: node.data.props.fontFamily,
    html: node.data.props.html,
    rows: node.data.props.rows,
  }))

  const insertVariable = (variable: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setProp((p: EmailTextProps) => {
        p.html = (html || '') + ' ' + variable
      })
      return
    }

    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer

    let isInEditor = false
    let node: Node | null = container
    while (node) {
      if (node.nodeType === 1 && (node as HTMLElement).contentEditable === 'true') {
        isInEditor = true
        break
      }
      node = node.parentNode
    }

    if (!isInEditor) {
      setProp((p: EmailTextProps) => {
        p.html = (html || '') + ' ' + variable
      })
      return
    }

    range.deleteContents()
    const textNode = document.createTextNode(variable)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)

    const editorElement = node as HTMLElement
    setProp((p: EmailTextProps) => {
      p.html = cleanVariables(editorElement.innerHTML)
    })
  }

  const applyFormatting = (command: string) => {
    document.execCommand(command, false)

    setTimeout(() => {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const container = selection.getRangeAt(0).commonAncestorContainer
        let node: Node | null = container
        while (node) {
          if (node.nodeType === 1 && (node as HTMLElement).contentEditable === 'true') {
            setProp((p: EmailTextProps) => {
              p.html = cleanVariables((node as HTMLElement).innerHTML)
            })
            break
          }
          node = node.parentNode
        }
      }
    }, 10)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Formatação de Texto</Label>
        <ToggleGroup
          type="multiple"
          variant="outline"
          className="justify-start"
        >
          <ToggleGroupItem
            value="bold"
            aria-label="Negrito"
            onClick={() => applyFormatting('bold')}
          >
            <Bold className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="italic"
            aria-label="Itálico"
            onClick={() => applyFormatting('italic')}
          >
            <Italic className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="underline"
            aria-label="Sublinhado"
            onClick={() => applyFormatting('underline')}
          >
            <Underline className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="strikethrough"
            aria-label="Riscado"
            onClick={() => applyFormatting('strikeThrough')}
          >
            <Strikethrough className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          Seleccione o texto no editor e clique para formatar
        </p>
      </div>

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

      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={textAlign}
          onValueChange={(v) => {
            if (v) setProp((p: EmailTextProps) => { p.textAlign = v })
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
          <ToggleGroupItem value="justify" aria-label="Justificado">
            <AlignJustify className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

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
          {templateVariables.map((v) => (
            <button
              key={v.key}
              type="button"
              className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
              onClick={() => insertVariable(`{{${v.key}}}`)}
              title={v.label}
            >
              {v.label}
            </button>
          ))}
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
