'use client'

import { useCallback, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Color from '@tiptap/extension-color'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

// Custom page break node — renders as <hr data-page-break="true">
const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,

  parseHTML() {
    return [
      { tag: 'hr[data-page-break]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true' })]
  },

  addCommands() {
    return {
      insertPageBreak: () => ({ chain }) => {
        return chain().insertContent({ type: this.name }).run()
      },
    } as any
  },
})
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignJustify,
  List, ListOrdered, Printer, Variable, Undo, Redo, Save, Loader2, Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const VARIABLES = [
  { key: 'nome_completo', label: 'Nome Completo' },
  { key: 'tipo_documento', label: 'Tipo Documento' },
  { key: 'cc_numero', label: 'N.º Documento' },
  { key: 'cc_validade', label: 'Validade Documento' },
  { key: 'nif', label: 'NIF' },
  { key: 'morada_completa', label: 'Morada Completa' },
  { key: 'data_contrato', label: 'Data do Contrato' },
  { key: 'comissao_percentagem', label: 'Comissão (%)' },
  { key: 'comissao_extenso', label: 'Comissão (extenso)' },
  { key: 'nome_profissional', label: 'Nome Profissional' },
  { key: 'telemovel', label: 'Telemóvel' },
  { key: 'email_pessoal', label: 'Email Pessoal' },
  { key: 'niss', label: 'NISS' },
  { key: 'naturalidade', label: 'Naturalidade' },
  { key: 'estado_civil', label: 'Estado Civil' },
  { key: 'data_nascimento', label: 'Data de Nascimento' },
]

interface Props {
  initialHtml: string
  onSave?: (html: string) => void
  onPrint?: (html: string) => void
  saving?: boolean
  mode?: 'template' | 'generated'
}

export function ContractEditor({ initialHtml, onSave, onPrint, saving, mode = 'template' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ horizontalRule: false }),
      Underline,
      TextStyle,
      FontFamily,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      PageBreak,
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px]',
        style: "font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; line-height: 1.6;",
      },
    },
  })

  const insertVariable = useCallback((key: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(`{{${key}}}`).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="rounded-xl border overflow-hidden bg-white">
      {/* Toolbar — sticky */}
      <div className="flex items-center gap-0.5 flex-wrap px-3 py-2 border-b bg-neutral-50/80 sticky top-0 z-10">
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          icon={<Undo className="h-3.5 w-3.5" />}
          tooltip="Desfazer"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          icon={<Redo className="h-3.5 w-3.5" />}
          tooltip="Refazer"
        />

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          icon={<Bold className="h-3.5 w-3.5" />}
          tooltip="Negrito"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          icon={<Italic className="h-3.5 w-3.5" />}
          tooltip="Itálico"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          icon={<UnderlineIcon className="h-3.5 w-3.5" />}
          tooltip="Sublinhado"
        />

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          icon={<span className="text-[10px] font-bold">H2</span>}
          tooltip="Título"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          icon={<span className="text-[10px] font-bold">H3</span>}
          tooltip="Subtítulo"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive('paragraph')}
          icon={<Type className="h-3.5 w-3.5" />}
          tooltip="Parágrafo"
        />

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          icon={<AlignLeft className="h-3.5 w-3.5" />}
          tooltip="Alinhar esquerda"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          icon={<AlignCenter className="h-3.5 w-3.5" />}
          tooltip="Centrar"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
          icon={<AlignJustify className="h-3.5 w-3.5" />}
          tooltip="Justificar"
        />

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          icon={<ListOrdered className="h-3.5 w-3.5" />}
          tooltip="Lista numerada"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          icon={<List className="h-3.5 w-3.5" />}
          tooltip="Lista"
        />

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Page break */}
        <button
          type="button"
          onClick={() => (editor.commands as any).insertPageBreak()}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
          title="Inserir quebra de pagina"
        >
          <span className="text-[10px]">⸻</span> Quebra de Pagina
        </button>

        {/* Variables dropdown (only in template mode) */}
        {mode === 'template' && (
          <>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors">
                  <Variable className="h-3.5 w-3.5" />
                  Variável
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-64 overflow-y-auto">
                {VARIABLES.map((v) => (
                  <DropdownMenuItem key={v.key} onClick={() => insertVariable(v.key)} className="text-xs">
                    <span className="font-mono text-violet-600 mr-2">{`{{${v.key}}}`}</span>
                    {v.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Right side: Save & Print */}
        <div className="ml-auto flex items-center gap-1.5">
          {onSave && (
            <Button size="sm" variant="outline" className="rounded-full gap-1.5 h-7 text-xs" onClick={() => onSave(editor.getHTML())} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Guardar
            </Button>
          )}
          {onPrint && (
            <Button size="sm" className="rounded-full gap-1.5 h-7 text-xs" onClick={() => onPrint(editor.getHTML())}>
              <Printer className="h-3 w-3" />
              Imprimir PDF
            </Button>
          )}
        </div>
      </div>

      {/* Editor — A4 pages with visible page breaks */}
      <div className="bg-neutral-100 p-6 overflow-y-auto contract-editor-pages" style={{ maxHeight: '70vh' }}>
        <style>{`
          .contract-editor-pages .ProseMirror hr[data-page-break] {
            position: relative;
            border: none;
            margin: 40px -2.5cm;
            padding: 30px 0;
            background: #f5f5f5;
          }
          .contract-editor-pages .ProseMirror hr[data-page-break]::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 2cm;
            right: 2cm;
            height: 0;
            border-top: 2px dashed #d1d5db;
          }
          .contract-editor-pages .ProseMirror hr[data-page-break]::after {
            content: 'Quebra de pagina';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #e5e7eb;
            color: #6b7280;
            font-family: system-ui, sans-serif;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 3px 12px;
            border-radius: 10px;
            white-space: nowrap;
          }
        `}</style>
        <div
          className="bg-white shadow-lg mx-auto rounded-sm min-h-[800px]"
          style={{
            maxWidth: '210mm',
            padding: '2.5cm 2.5cm',
            fontFamily: "'Times New Roman', Georgia, serif",
            fontSize: '12pt',
            lineHeight: 1.6,
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({ onClick, active, disabled, icon, tooltip }: {
  onClick: () => void; active?: boolean; disabled?: boolean; icon: React.ReactNode; tooltip: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
        active ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {icon}
    </button>
  )
}
