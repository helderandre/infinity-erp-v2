'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { EditorContent, type Editor } from '@tiptap/react'
import { Loader2 } from 'lucide-react'
import { useStandardTiptap } from './use-standard-tiptap'
import { useAutomationVariables } from '@/components/email-editor/automation-variables-context'
import { EmailBubbleMenu } from '@/components/email-editor/email-bubble-menu'
import { StaticEmailHeader } from './static-email-header'
import { StaticEmailSignature } from './static-email-signature'
import { StaticEmailFooter } from './static-email-footer'
import { StandardToolbar } from './standard-toolbar'
import { StandardSettingsPanel } from './standard-settings-panel'
import {
  EmailAttachmentDialog,
  EmailButtonDialog,
  EmailImageDialog,
  EmailLinkDialog,
  EmailPortalLinksDialog,
  EmailPropertyGridDialog,
  useButtonDialog,
  usePortalLinksDialog,
  usePropertyGridDialog,
} from './insert-dialogs'
import type { EmailAttachmentAttrs } from './nodes/attachment-node'
import type { EmailPortalLinksAttrs } from './nodes/portal-links-node'
import type { EmailPropertyGridAttrs } from './nodes/property-grid-node'
import { cn } from '@/lib/utils'

export interface EmailStandardCanvasHandle {
  getHtml(): string
  setHtml(html: string): void
  focus(): void
}

interface EmailStandardCanvasProps {
  initialHtml: string
  signatureConsultantId?: string | null
  isAiGenerating?: boolean
  onHtmlChange?: (html: string) => void
}

export const EmailStandardCanvas = forwardRef<
  EmailStandardCanvasHandle,
  EmailStandardCanvasProps
>(function EmailStandardCanvas(
  { initialHtml, signatureConsultantId, isAiGenerating, onHtmlChange },
  ref
) {
  const automationVariables = useAutomationVariables()
  const currentHtmlRef = useRef<string>(initialHtml)
  const isProgrammaticUpdateRef = useRef(false)

  const [imageDialog, setImageDialog] = useState(false)
  const [attachmentDialog, setAttachmentDialog] = useState(false)
  const [linkDialog, setLinkDialog] = useState<{
    open: boolean
    initialUrl?: string
  }>({ open: false })

  const editorRef = useRef<Editor | null>(null)

  // Slash handlers use refs so the hook that builds the extension only runs
  // once — the refs are updated when the real dialog handles become available
  // after this component body finishes running.
  const slashHandlersRef = useRef<{
    onInsertImage: () => void
    onInsertButton: () => void
    onInsertAttachment: () => void
    onInsertVariable: () => void
    onInsertPropertyGrid: () => void
    onInsertPortalLinks: () => void
  }>({
    onInsertImage: () => setImageDialog(true),
    onInsertButton: () => {},
    onInsertAttachment: () => setAttachmentDialog(true),
    onInsertVariable: () => {},
    onInsertPropertyGrid: () => {},
    onInsertPortalLinks: () => {},
  })

  const { editor } = useStandardTiptap({
    content: initialHtml,
    onUpdate: (html) => {
      currentHtmlRef.current = html
      if (!isProgrammaticUpdateRef.current) onHtmlChange?.(html)
    },
    placeholder: 'Escreva o conteúdo do email aqui... ( / para inserir blocos )',
    variables: automationVariables ?? undefined,
    slashHandlers: {
      onInsertImage: () => slashHandlersRef.current.onInsertImage(),
      onInsertButton: () => slashHandlersRef.current.onInsertButton(),
      onInsertAttachment: () => slashHandlersRef.current.onInsertAttachment(),
      onInsertVariable: () => slashHandlersRef.current.onInsertVariable(),
      onInsertPropertyGrid: () => slashHandlersRef.current.onInsertPropertyGrid(),
      onInsertPortalLinks: () => slashHandlersRef.current.onInsertPortalLinks(),
    },
  })

  // Keep a ref to editor so dialog helpers can command it
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  const buttonDialog = useButtonDialog(editor)
  const propertyGridDialog = usePropertyGridDialog(editor)
  const portalLinksDialog = usePortalLinksDialog(editor)

  // Open the @ variable suggestion popup programmatically.
  const openVariablePicker = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertContent('@').run()
  }, [editor])

  // Keep the slash handlers ref updated with the real callbacks.
  useEffect(() => {
    slashHandlersRef.current = {
      onInsertImage: () => setImageDialog(true),
      onInsertButton: () => buttonDialog.openForInsert(),
      onInsertAttachment: () => setAttachmentDialog(true),
      onInsertVariable: () => openVariablePicker(),
      onInsertPropertyGrid: () => propertyGridDialog.openForInsert(),
      onInsertPortalLinks: () => portalLinksDialog.openForInsert(),
    }
  }, [buttonDialog, portalLinksDialog, propertyGridDialog, openVariablePicker])

  useImperativeHandle(
    ref,
    (): EmailStandardCanvasHandle => ({
      getHtml: () => currentHtmlRef.current,
      setHtml: (html: string) => {
        if (!editor) return
        isProgrammaticUpdateRef.current = true
        // Wrap raw {{key}} occurrences so the VariableNode's parseHTML
        // rule picks them up and renders them as pills. Without this,
        // setContent would leave them as plain text.
        const prepared = (html || '').replace(
          /\{\{([^}]+)\}\}/g,
          '<span data-variable-key="$1">{{$1}}</span>'
        )
        editor.commands.setContent(prepared, false)
        currentHtmlRef.current = html
        isProgrammaticUpdateRef.current = false
      },
      focus: () => editor?.commands.focus(),
    }),
    [editor]
  )

  // Keep the ref synced with the latest Tiptap output.
  useEffect(() => {
    if (!editor) return
    currentHtmlRef.current = editor.getHTML()
  }, [editor])

  // Double-click on button / property-grid / portal-links opens the edit dialog.
  useEffect(() => {
    if (!editor) return
    const handleDoubleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      // Button is edited via the sidebar (single-click selects → sidebar).
      // Double-click on grid/portal-links opens the full dialog because their
      // payloads (property list, portals list) benefit from a wider surface.
      const grid = target.closest('[data-email-property-grid]') as HTMLElement | null
      if (grid) {
        const payload = grid.getAttribute('data-payload')
        try {
          const parsed = payload
            ? (JSON.parse(decodeURIComponent(payload)) as Partial<EmailPropertyGridAttrs>)
            : null
          if (parsed) {
            editor.commands.focus()
            propertyGridDialog.openForEdit(parsed)
          }
        } catch {
          /* ignore */
        }
        return
      }

      const portal = target.closest('[data-email-portal-links]') as HTMLElement | null
      if (portal) {
        const payload = portal.getAttribute('data-payload')
        try {
          const parsed = payload
            ? (JSON.parse(decodeURIComponent(payload)) as Partial<EmailPortalLinksAttrs>)
            : null
          if (parsed) {
            editor.commands.focus()
            portalLinksDialog.openForEdit(parsed)
          }
        } catch {
          /* ignore */
        }
        return
      }
    }
    const dom = editor.view.dom
    dom.addEventListener('dblclick', handleDoubleClick)
    return () => dom.removeEventListener('dblclick', handleDoubleClick)
  }, [editor, propertyGridDialog, portalLinksDialog])

  const handleInsertLink = useCallback(() => {
    if (!editor) return
    const currentHref = editor.getAttributes('link').href as string | undefined
    setLinkDialog({ open: true, initialUrl: currentHref })
  }, [editor])

  const handleLinkSubmit = (url: string) => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    setLinkDialog({ open: false })
  }

  const handleLinkRemove = () => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkDialog({ open: false })
  }

  const handleImageInsert = (src: string) => {
    if (!editor) return
    editor.chain().focus().insertEmailImage({ src }).run()
  }

  const handleAttachmentInsert = (attrs: EmailAttachmentAttrs) => {
    if (!editor) return
    editor.chain().focus().insertEmailAttachment(attrs).run()
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <StandardToolbar
        editor={editor}
        variables={automationVariables ?? []}
        onInsertImage={() => setImageDialog(true)}
        onInsertButton={buttonDialog.openForInsert}
        onInsertAttachment={() => setAttachmentDialog(true)}
        onInsertLink={handleInsertLink}
        onInsertPropertyGrid={propertyGridDialog.openForInsert}
        onInsertPortalLinks={portalLinksDialog.openForInsert}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto bg-muted/30 p-8 relative">
          <div className="mx-auto" style={{ maxWidth: 620 }}>
            <div className="bg-white rounded-md overflow-hidden shadow-sm">
              <StaticEmailHeader />

              <div
                style={{
                  padding: '24px',
                  background: '#ffffff',
                  position: 'relative',
                }}
              >
                <div
                  className={cn(
                    'email-standard-editor',
                    isAiGenerating && 'opacity-50 pointer-events-none'
                  )}
                >
                  <EditorContent editor={editor} />
                </div>

                {isAiGenerating && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm border">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                      A gerar com IA...
                    </div>
                  </div>
                )}
              </div>

              <StaticEmailSignature
                consultantId={signatureConsultantId ?? undefined}
              />
              <StaticEmailFooter />
            </div>
          </div>
        </div>

        <StandardSettingsPanel
          editor={editor}
          onOpenPortalLinksDialog={() => {
            const sel = editor?.state.selection
            if (sel && 'node' in sel) {
              const node = (sel as { node: { attrs: unknown } }).node
              portalLinksDialog.openForEdit(
                (node?.attrs ?? {}) as Partial<import('./nodes/portal-links-node').EmailPortalLinksAttrs>
              )
            } else {
              portalLinksDialog.openForInsert()
            }
          }}
          onOpenAttachmentDialog={() => setAttachmentDialog(true)}
          onOpenImageDialog={() => setImageDialog(true)}
        />
      </div>

      <EmailButtonDialog
        state={buttonDialog.state}
        onClose={buttonDialog.close}
        onSubmit={buttonDialog.submit}
      />
      <EmailImageDialog
        open={imageDialog}
        onClose={() => setImageDialog(false)}
        onInsert={handleImageInsert}
      />
      <EmailAttachmentDialog
        open={attachmentDialog}
        onClose={() => setAttachmentDialog(false)}
        onInsert={handleAttachmentInsert}
      />
      <EmailLinkDialog
        open={linkDialog.open}
        initialUrl={linkDialog.initialUrl}
        onClose={() => setLinkDialog({ open: false })}
        onSubmit={handleLinkSubmit}
        onRemove={linkDialog.initialUrl ? handleLinkRemove : undefined}
      />
      <EmailPropertyGridDialog
        state={propertyGridDialog.state}
        onClose={propertyGridDialog.close}
        onSubmit={propertyGridDialog.submit}
      />
      <EmailPortalLinksDialog
        state={portalLinksDialog.state}
        onClose={portalLinksDialog.close}
        onSubmit={portalLinksDialog.submit}
      />

      {editor && <EmailBubbleMenu editor={editor} />}

      <style jsx global>{`
        .email-standard-editor .ProseMirror {
          outline: none;
          min-height: 240px;
          font-family: Arial, sans-serif;
          font-size: 15px;
          line-height: 1.6;
          color: #404040;
        }
        .email-standard-editor .ProseMirror p {
          margin: 0 0 0.75em 0;
        }
        .email-standard-editor .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        .email-standard-editor .ProseMirror h1,
        .email-standard-editor .ProseMirror h2,
        .email-standard-editor .ProseMirror h3,
        .email-standard-editor .ProseMirror h4 {
          font-family: Arial, sans-serif;
          font-weight: 700;
          margin: 1em 0 0.4em 0;
          line-height: 1.25;
          color: #111827;
        }
        .email-standard-editor .ProseMirror h1 {
          font-size: 28px;
        }
        .email-standard-editor .ProseMirror h2 {
          font-size: 22px;
        }
        .email-standard-editor .ProseMirror h3 {
          font-size: 18px;
        }
        .email-standard-editor .ProseMirror h4 {
          font-size: 16px;
        }
        .email-standard-editor .ProseMirror ul,
        .email-standard-editor .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0 0 0.75em 0;
        }
        .email-standard-editor .ProseMirror li > p {
          margin: 0;
        }
        .email-standard-editor .ProseMirror blockquote {
          border-left: 3px solid #d4d4d4;
          padding-left: 12px;
          color: #525252;
          margin: 0.75em 0;
        }
        .email-standard-editor .ProseMirror hr {
          border: 0;
          border-top: 1px solid #e5e7eb;
          margin: 1em 0;
        }
        .email-standard-editor .ProseMirror img.ProseMirror-selectednode,
        .email-standard-editor .ProseMirror [data-email-button].ProseMirror-selectednode,
        .email-standard-editor .ProseMirror [data-email-attachment].ProseMirror-selectednode,
        .email-standard-editor .ProseMirror [data-email-property-grid].ProseMirror-selectednode,
        .email-standard-editor .ProseMirror [data-email-portal-links].ProseMirror-selectednode {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
          border-radius: 4px;
        }
        .email-standard-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #a3a3a3;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  )
})
