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
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Strikethrough } from 'lucide-react'
import { useTemplateVariables } from '@/hooks/use-template-variables'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput } from '@/components/email-editor/settings'

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
  } = useNode()

  const editorRef = useRef<HTMLHeadingElement>(null)
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
      setProp((p: EmailHeadingProps) => {
        p.html = cleaned
      })
    }
  }

  const HeadingTag = level

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
    >
      <HeadingTag
        ref={editorRef as any}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        style={{
          color,
          textAlign: textAlign as React.CSSProperties['textAlign'],
          fontFamily,
          fontSize,
          fontWeight,
          padding: padding > 0 ? padding : undefined,
          margin: 0,
          outline: 'none',
          cursor: 'text',
        }}
        dangerouslySetInnerHTML={{ __html: highlightVariables(html) }}
      />
    </div>
  )
}

const EmailHeadingSettings = () => {
  const { variables: templateVariables } = useTemplateVariables()
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailHeadingProps,
  }))

  const insertVariable = (variable: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setProp((p: EmailHeadingProps) => {
        p.html = (props.html || '') + ' ' + variable
      })
      return
    }

    const range = selection.getRangeAt(0)
    let node: Node | null = range.commonAncestorContainer
    let isInEditor = false
    while (node) {
      if (node.nodeType === 1 && (node as HTMLElement).contentEditable === 'true') {
        isInEditor = true
        break
      }
      node = node.parentNode
    }

    if (!isInEditor) {
      setProp((p: EmailHeadingProps) => {
        p.html = (props.html || '') + ' ' + variable
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

    setProp((p: EmailHeadingProps) => {
      p.html = cleanVariables((node as HTMLElement).innerHTML)
    })
  }

  const applyFormatting = (command: string) => {
    document.execCommand(command, false)
    setTimeout(() => {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.getRangeAt(0).commonAncestorContainer
        while (node) {
          if (node.nodeType === 1 && (node as HTMLElement).contentEditable === 'true') {
            setProp((p: EmailHeadingProps) => {
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
          <ToggleGroupItem value="bold" aria-label="Negrito" onClick={() => applyFormatting('bold')}>
            <Bold className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="italic" aria-label="Itálico" onClick={() => applyFormatting('italic')}>
            <Italic className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="underline" aria-label="Sublinhado" onClick={() => applyFormatting('underline')}>
            <Underline className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="strikethrough" aria-label="Riscado" onClick={() => applyFormatting('strikeThrough')}>
            <Strikethrough className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          Seleccione o texto no editor e clique para formatar
        </p>
      </div>

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
