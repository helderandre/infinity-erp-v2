'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Editor, Frame, Element, useEditor } from '@craftjs/core'
import { ROOT_NODE, getRandomId } from '@craftjs/utils'
import { Layers } from '@craftjs/layers'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { EmailContainer } from './user/email-container'
import { EmailText } from './user/email-text'
import { EmailHeading } from './user/email-heading'
import { EmailImage } from './user/email-image'
import { EmailButton } from './user/email-button'
import { EmailDivider } from './user/email-divider'
import { EmailSpacer } from './user/email-spacer'
import { EmailAttachment } from './user/email-attachment'
import { EmailGrid } from './user/email-grid'
import { EmailPortalLinks } from './user/email-portal-links'
import { EmailHeader } from './user/email-header'
import { EmailFooter } from './user/email-footer'
import { EmailSignature } from './user/email-signature'
import { EmailPropertyGrid } from './user/email-property-grid'

import { RenderNode, duplicateNode } from './email-render-node'
import { EmailToolbox } from './email-toolbox'
import { EmailSettingsPanel } from './email-settings-panel'
import { EmailTopbar, type EditorMode, type SignatureMode } from './email-topbar'
import { EmailLayer } from './email-layer'
import { EmailPreviewPanel } from './email-preview-panel'
import { AiGenerateInput } from './ai-generate-panel'
import {
  EmailStandardCanvas,
  type EmailStandardCanvasHandle,
} from './standard/email-standard-canvas'
import { useEditorDrop } from './shared/use-editor-drop'
import { Upload } from 'lucide-react'
import {
  buildStandardState,
  extractStandardContent,
  isStandardCanonical,
  isStandardCompatible,
  labelForDroppedType,
} from '@/lib/email/standard-state'
import { renderEmailToHtml } from '@/lib/email-renderer'
import { normalizeCategory } from '@/lib/constants-template-categories'
import type { EmailMeta } from '@/lib/email/ai-state-injector'

const resolver = {
  EmailContainer,
  EmailText,
  EmailHeading,
  EmailImage,
  EmailButton,
  EmailDivider,
  EmailSpacer,
  EmailAttachment,
  EmailGrid,
  EmailPortalLinks,
  EmailHeader,
  EmailFooter,
  EmailSignature,
  EmailPropertyGrid,
}

interface EmailEditorProps {
  initialData: string | null
  templateId: string | null
  initialName: string
  initialSubject: string
  initialDescription: string
  initialCategory?: import('@/lib/constants-template-categories').TemplateCategory
  initialScope?: 'consultant' | 'global'
  initialMode?: 'standard' | 'advanced'
  /** Initial Tiptap HTML seed for standard mode. Only used when initialMode === 'standard'. */
  initialStandardHtml?: string
  /** Consultant id for signature preview in standard mode. */
  initialSignatureConsultantId?: string | null
}

/**
 * Sanitize serialized Craft.js state to fix duplicate node IDs
 * caused by a previous buggy duplication that reused original IDs.
 */
function sanitizeEditorState(raw: string): string {
  try {
    const nodes = JSON.parse(raw) as Record<string, Record<string, unknown>>

    function collectSubtreeIds(rootId: string): string[] {
      const ids: string[] = [rootId]
      const node = nodes[rootId] as { nodes?: string[]; linkedNodes?: Record<string, string> } | undefined
      if (!node) return ids
      for (const childId of node.nodes ?? []) {
        ids.push(...collectSubtreeIds(childId))
      }
      for (const linkedId of Object.values(node.linkedNodes ?? {})) {
        ids.push(...collectSubtreeIds(linkedId))
      }
      return ids
    }

    function cloneSubtree(rootId: string): string {
      const subtreeIds = collectSubtreeIds(rootId)
      const oldToNew: Record<string, string> = {}
      for (const id of subtreeIds) {
        oldToNew[id] = getRandomId()
      }

      for (const oldId of subtreeIds) {
        const newId = oldToNew[oldId]
        const cloned = JSON.parse(JSON.stringify(nodes[oldId]))

        if (Array.isArray(cloned.nodes)) {
          cloned.nodes = cloned.nodes.map((c: string) => oldToNew[c] ?? c)
        }
        if (cloned.linkedNodes) {
          const remapped: Record<string, string> = {}
          for (const [k, v] of Object.entries(cloned.linkedNodes)) {
            remapped[k] = oldToNew[v as string] ?? (v as string)
          }
          cloned.linkedNodes = remapped
        }
        if (cloned.parent && oldToNew[cloned.parent]) {
          cloned.parent = oldToNew[cloned.parent]
        }

        nodes[newId] = cloned
      }

      return oldToNew[rootId]
    }

    let changed = false
    for (const node of Object.values(nodes)) {
      const childIds = (node as { nodes?: string[] }).nodes
      if (!Array.isArray(childIds)) continue

      const seen = new Set<string>()
      for (let i = 0; i < childIds.length; i++) {
        if (seen.has(childIds[i])) {
          childIds[i] = cloneSubtree(childIds[i])
          changed = true
        }
        seen.add(childIds[i])
      }
    }

    return changed ? JSON.stringify(nodes) : raw
  } catch {
    return raw
  }
}

function KeyboardShortcuts() {
  const { actions, query } = useEditor()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        const selectedId = query.getEvent('selected').first()
        if (selectedId && selectedId !== ROOT_NODE) {
          duplicateNode(selectedId, query, actions)
        }
      }
    },
    [actions, query]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return null
}

function RightSidebar() {
  return (
    <Tabs defaultValue="properties" className="w-72 shrink-0 border-l flex flex-col overflow-hidden gap-0">
      <TabsList className="w-full rounded-none border-b">
        <TabsTrigger value="properties" className="flex-1">Propriedades</TabsTrigger>
        <TabsTrigger value="layers" className="flex-1">Camadas</TabsTrigger>
      </TabsList>
      <TabsContent value="properties" className="mt-0 flex-1 overflow-auto">
        <EmailSettingsPanel />
      </TabsContent>
      <TabsContent value="layers" className="mt-0 flex-1 overflow-auto">
        <Layers expandRootOnLoad renderLayer={EmailLayer} />
      </TabsContent>
    </Tabs>
  )
}

// ─── EditorShell — lives inside <Editor> so it can use useEditor() ──────────

interface EditorShellProps {
  name: string
  subject: string
  mode: EditorMode
  setMode: (m: EditorMode) => void
  signatureMode: SignatureMode
  category: import('@/lib/constants-template-categories').TemplateCategory
  isSaving: boolean
  aiPanelOpen: boolean
  setAiPanelOpen: (v: boolean) => void
  isAiGenerating: boolean
  setIsAiGenerating: (v: boolean) => void
  previewEditorState: string | null
  setPreviewEditorState: (s: string | null) => void
  onNameChange: (v: string) => void
  onSubjectChange: (v: string) => void
  onSignatureModeChange: (m: SignatureMode) => void
  onCategoryChange: (v: string) => void
  onSave: (editorState: string) => void
  onAiMeta: (meta: EmailMeta) => void
  initialScope?: 'consultant' | 'global'
  initialStandardHtml: string
  initialSignatureConsultantId?: string | null
  sanitizedData?: string
}

function EditorShell({
  name,
  subject,
  mode,
  setMode,
  signatureMode,
  category,
  isSaving,
  aiPanelOpen,
  setAiPanelOpen,
  isAiGenerating,
  setIsAiGenerating,
  previewEditorState,
  setPreviewEditorState,
  onNameChange,
  onSubjectChange,
  onSignatureModeChange,
  onCategoryChange,
  onSave,
  onAiMeta,
  initialScope,
  initialStandardHtml,
  initialSignatureConsultantId,
  sanitizedData,
}: EditorShellProps) {
  const { actions, query } = useEditor()
  const standardHandleRef = useRef<EmailStandardCanvasHandle>(null)
  const [standardHtml, setStandardHtml] = useState<string>(initialStandardHtml)
  // Baseline HTML for the standard editor — what it contained the last time
  // it was seeded from Craft.js (mount, advanced→standard switch, or AI
  // generation). If the current Tiptap HTML still matches this baseline the
  // user has NOT edited, so we can skip rewriting the Craft.js state on the
  // next mode switch (avoids duplicating AI-generated multi-node output).
  const standardBaselineRef = useRef<string>(initialStandardHtml)
  const [lossyDialog, setLossyDialog] = useState<{
    open: boolean
    html: string
    droppedByType: Record<string, number>
  }>({ open: false, html: '', droppedByType: {} })

  const dropLabel = useMemo(() => {
    const entries = Object.entries(lossyDialog.droppedByType)
    if (entries.length === 0) return ''
    return entries
      .map(([type, count]) => `${count} ${labelForDroppedType(type)}${count > 1 ? 's' : ''}`)
      .join(', ')
  }, [lossyDialog.droppedByType])

  // Read current standard HTML (from Tiptap) — falls back to internal state.
  const readStandardHtml = useCallback((): string => {
    return standardHandleRef.current?.getHtml() ?? standardHtml
  }, [standardHtml])

  // Push the standard HTML into the Craft.js state so `query.serialize()`
  // produces a valid standard editor_state.
  //
  // Three paths:
  //
  // 1. Pristine: the user has not typed since the Tiptap editor was last
  //    seeded (baseline === current). The Craft.js state already matches
  //    what the user sees — do nothing. Preserves AI-generated multi-node
  //    structures (heading + text + button as separate Craft.js nodes).
  //
  // 2. Canonical fast-path: the Craft.js state is exactly the canonical
  //    standard shape (single EmailText in INNER). Update that node's html
  //    via setProp to preserve its custom props.
  //
  // 3. Rebuild: any other case (multi-node compatible state the user has
  //    edited, or advanced state post lossy-confirm). Replace the Craft.js
  //    state with a fresh canonical shape built from the current Tiptap html.
  const syncStandardToCraft = useCallback(() => {
    const html = readStandardHtml()

    if (html === standardBaselineRef.current) {
      // Pristine — no-op.
      return
    }

    const serialized = query.serialize()

    if (isStandardCanonical(serialized)) {
      try {
        const state = JSON.parse(serialized) as Record<string, { type?: { resolvedName?: string } }>
        for (const [nodeId, node] of Object.entries(state)) {
          if (node?.type?.resolvedName === 'EmailText') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            actions.setProp(nodeId, (p: any) => {
              p.html = html
            })
            standardBaselineRef.current = html
            return
          }
        }
      } catch {
        // fall through to rebuild
      }
    }

    const rebuilt = buildStandardState({
      html,
      signatureConsultantId: initialSignatureConsultantId ?? undefined,
    })
    actions.deserialize(rebuilt)
    standardBaselineRef.current = html
  }, [actions, initialSignatureConsultantId, query, readStandardHtml])

  // Handle mode toggle with lossy confirmation when advanced → standard loses blocks.
  const handleModeChange = useCallback(
    (next: EditorMode) => {
      if (next === mode) return

      if (mode === 'standard' && next === 'advanced') {
        syncStandardToCraft()
        setMode('advanced')
        return
      }

      if (mode === 'advanced' && next === 'standard') {
        const serialized = query.serialize()
        const { html, droppedCount, droppedByType } = extractStandardContent(serialized)
        if (droppedCount > 0) {
          setLossyDialog({ open: true, html, droppedByType })
          return
        }
        setStandardHtml(html)
        standardHandleRef.current?.setHtml(html)
        standardBaselineRef.current = html
        setMode('standard')
        return
      }

      if (next === 'preview') {
        if (mode === 'standard') syncStandardToCraft()
        const snapshot = query.serialize()
        setPreviewEditorState(snapshot)
        setMode('preview')
        return
      }

      // Leaving preview to edit mode — snapshot stays in Craft.js state.
      setMode(next)
    },
    [mode, query, setMode, setPreviewEditorState, syncStandardToCraft]
  )

  const confirmLossySwitch = useCallback(() => {
    const { html } = lossyDialog
    setStandardHtml(html)
    standardHandleRef.current?.setHtml(html)
    // Destructive: replace the Craft.js state with the canonical standard
    // shape so the dropped blocks are actually gone and cannot reappear.
    const rebuilt = buildStandardState({
      html,
      signatureConsultantId: initialSignatureConsultantId ?? undefined,
    })
    actions.deserialize(rebuilt)
    standardBaselineRef.current = html
    setLossyDialog({ open: false, html: '', droppedByType: {} })
    setMode('standard')
  }, [actions, initialSignatureConsultantId, lossyDialog, setMode])

  const cancelLossySwitch = useCallback(() => {
    setLossyDialog({ open: false, html: '', droppedByType: {} })
  }, [])

  // Save — serializes whichever mode is active and hands a string to the parent.
  const handleSave = useCallback(() => {
    if (mode === 'standard') {
      syncStandardToCraft()
    }
    const serialized = query.serialize()
    if (process.env.NODE_ENV !== 'production' && mode === 'standard') {
      console.debug('[email-editor] save from standard mode', {
        tiptapHtmlLength: readStandardHtml().length,
        serializedLength: serialized.length,
      })
    }
    onSave(serialized)
  }, [mode, onSave, query, readStandardHtml, syncStandardToCraft])

  // Topbar onSave receives serialized state, but our new flow does not need it.
  const topbarSave = useCallback(() => {
    handleSave()
  }, [handleSave])

  // Advanced-mode drop zone — images and files dropped on the Craft.js
  // canvas are uploaded then inserted as EmailImage / EmailAttachment nodes
  // inside the inner container (second child of ROOT).
  const advancedDropRef = useRef<HTMLDivElement>(null)
  const [advancedDropEl, setAdvancedDropEl] = useState<HTMLDivElement | null>(
    null
  )
  useEffect(() => {
    setAdvancedDropEl(advancedDropRef.current)
  }, [])

  const findInnerContainerId = useCallback((): string | null => {
    try {
      const root = query.node(ROOT_NODE).get()
      for (const childId of root.data.nodes) {
        const child = query.node(childId).get()
        // The inner container is an EmailContainer that isn't the ROOT.
        // Header/Signature/Footer are non-container nodes.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typeRef = child.data.type as any
        if (typeRef === EmailContainer || typeRef?.resolvedName === 'EmailContainer') {
          return childId
        }
      }
    } catch {
      /* ignore */
    }
    return null
  }, [query])

  const addAdvancedNode = useCallback(
    (element: React.ReactElement) => {
      const innerId = findInnerContainerId()
      if (!innerId) return
      try {
        const tree = query.parseReactElement(element).toNodeTree()
        const inner = query.node(innerId).get()
        actions.addNodeTree(tree, innerId, inner.data.nodes.length)
      } catch (e) {
        console.error('[advanced drop] failed to insert node', e)
      }
    },
    [actions, findInnerContainerId, query]
  )

  const { dragging: advancedDropDragging } = useEditorDrop(advancedDropEl, {
    onImageUploaded: (url) => {
      addAdvancedNode(<EmailImage src={url} alt="" />)
    },
    onAttachmentUploaded: (data) => {
      addAdvancedNode(
        <EmailAttachment
          fileUrl={data.url}
          fileName={data.fileName}
          fileSize={data.fileSize}
        />
      )
    },
  })

  // Custom generating-change handler: when the AI finishes generating while
  // the user is in standard mode, decide whether to stay (standard-compatible
  // output) or switch to advanced (output contains advanced-only blocks).
  const handleAiGeneratingChange = useCallback(
    (generating: boolean) => {
      setIsAiGenerating(generating)
      if (!generating && mode === 'standard') {
        const serialized = query.serialize()
        if (isStandardCompatible(serialized)) {
          const { html } = extractStandardContent(serialized)
          setStandardHtml(html)
          standardHandleRef.current?.setHtml(html)
          // Baseline = post-AI html. Keeps the AI-generated multi-node Craft
          // state intact when the user later switches to advanced without
          // editing (no duplication).
          standardBaselineRef.current = html
          toast.success('A IA gerou o conteúdo no modo Padrão.')
        } else {
          setMode('advanced')
          toast.info('A IA gerou blocos que só existem no modo Avançado.')
        }
      }
    },
    [mode, query, setIsAiGenerating, setMode]
  )

  return (
    <>
      <EmailTopbar
        name={name}
        subject={subject}
        mode={mode}
        signatureMode={signatureMode}
        onNameChange={onNameChange}
        onSubjectChange={onSubjectChange}
        onSignatureModeChange={onSignatureModeChange}
        category={category}
        onCategoryChange={onCategoryChange}
        onSave={topbarSave}
        onModeChange={(newMode) => handleModeChange(newMode)}
        isSaving={isSaving}
        onAiGenerate={() => setAiPanelOpen(true)}
        isAiGenerating={isAiGenerating}
      />

      {/* Standard mode canvas */}
      {mode === 'standard' && (
        <div className="flex flex-1 min-h-0 relative">
          <EmailStandardCanvas
            ref={standardHandleRef}
            initialHtml={standardHtml}
            signatureConsultantId={initialSignatureConsultantId}
            isAiGenerating={isAiGenerating}
            onHtmlChange={setStandardHtml}
          />
          <AiGenerateInput
            visible={aiPanelOpen || isAiGenerating}
            onClose={() => setAiPanelOpen(false)}
            onGeneratingChange={handleAiGeneratingChange}
            onMetaGenerated={onAiMeta}
            scope={initialScope}
            category={category}
            mode="standard"
          />
        </div>
      )}

      {/* Advanced mode — Craft.js canvas. Kept mounted and hidden in preview
          to preserve the edit history. */}
      <div
        className="flex flex-1 min-h-0"
        style={{ display: mode === 'advanced' ? 'flex' : 'none' }}
      >
        <EmailToolbox />
        <div
          ref={advancedDropRef}
          className="flex-1 overflow-auto bg-muted/30 p-8 relative"
        >
          {advancedDropDragging && (
            <div className="pointer-events-none absolute inset-4 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5">
              <div className="flex flex-col items-center gap-2 rounded-md bg-background/95 px-4 py-3 text-sm font-medium shadow-sm border">
                <Upload className="h-5 w-5 text-primary" />
                Largar para adicionar
                <span className="text-[11px] font-normal text-muted-foreground">
                  Imagens entram no corpo · outros ficheiros como anexos
                </span>
              </div>
            </div>
          )}
          <div className="mx-auto" style={{ maxWidth: 620 }}>
            <Frame data={sanitizedData}>
              <Element
                is={EmailContainer}
                canvas
                padding={0}
                background="#ffffff"
                width="100%"
                direction="column"
                align="stretch"
                justify="flex-start"
                gap={0}
              >
                <EmailHeader />
                <Element
                  is={EmailContainer}
                  canvas
                  padding={24}
                  background="#ffffff"
                  width="100%"
                  direction="column"
                  align="stretch"
                  justify="flex-start"
                  gap={8}
                >
                  <EmailText html="Escreva o conteúdo do email aqui..." />
                </Element>
                <EmailSignature />
                <EmailFooter />
              </Element>
            </Frame>
          </div>

          <AiGenerateInput
            visible={(aiPanelOpen || isAiGenerating) && mode === 'advanced'}
            onClose={() => setAiPanelOpen(false)}
            onGeneratingChange={handleAiGeneratingChange}
            onMetaGenerated={onAiMeta}
            scope={initialScope}
            category={category}
            mode="advanced"
          />
        </div>
        <RightSidebar />
      </div>

      {/* Preview mode */}
      {mode === 'preview' && (
        <EmailPreviewPanel editorState={previewEditorState} subject={subject} />
      )}

      <AlertDialog
        open={lossyDialog.open}
        onOpenChange={(open) => {
          if (!open) cancelLossySwitch()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voltar ao modo Padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao voltar ao modo Padrão perderá {dropLabel} que só existem no modo
              Avançado. O texto será preservado. Tem a certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLossySwitch}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLossySwitch}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── EmailEditorComponent — top-level state + persistence ──────────────────

export function EmailEditorComponent({
  initialData,
  templateId,
  initialName,
  initialSubject,
  initialDescription,
  initialCategory,
  initialScope,
  initialMode,
  initialStandardHtml,
  initialSignatureConsultantId,
}: EmailEditorProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [subject, setSubject] = useState(initialSubject)
  const [description] = useState(initialDescription)
  const [category, setCategory] = useState<
    import('@/lib/constants-template-categories').TemplateCategory
  >(initialCategory ?? 'geral')
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState<EditorMode>(initialMode ?? 'standard')
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('process_owner')
  const [previewEditorState, setPreviewEditorState] = useState<string | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [isAiGenerating, setIsAiGenerating] = useState(false)

  const handleAiMeta = useCallback((meta: EmailMeta) => {
    if (meta.name) setName(meta.name)
    if (meta.subject) setSubject(meta.subject)
    if (meta.category)
      setCategory(
        normalizeCategory(meta.category) as import(
          '@/lib/constants-template-categories'
        ).TemplateCategory
      )
  }, [])

  const sanitizedData = useMemo(
    () => (initialData ? sanitizeEditorState(initialData) : undefined),
    [initialData]
  )

  const seededStandardHtml = useMemo(() => {
    if (typeof initialStandardHtml === 'string') return initialStandardHtml
    if (!initialData) return ''
    return extractStandardContent(initialData).html
  }, [initialData, initialStandardHtml])

  const handleSave = useCallback(
    async (editorState: string) => {
      if (!name.trim()) {
        toast.error('O nome do template é obrigatório')
        return
      }
      if (!subject.trim()) {
        toast.error('O assunto do email é obrigatório')
        return
      }

      setIsSaving(true)
      try {
        const body = {
          name: name.trim(),
          subject: subject.trim(),
          description: description.trim() || undefined,
          body_html: renderEmailToHtml(editorState, {}),
          editor_state: JSON.parse(editorState),
          signature_mode: signatureMode,
          category,
        }

        if (templateId) {
          const res = await fetch(`/api/libraries/emails/${templateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error('Erro ao guardar template')
          toast.success('Template guardado com sucesso')
        } else {
          const res = await fetch('/api/libraries/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error('Erro ao criar template')
          const data = await res.json()
          toast.success('Template criado com sucesso')
          router.push(`/dashboard/templates-email/${data.id}`)
        }
      } catch (error) {
        console.error('Erro ao guardar template:', error)
        toast.error('Erro ao guardar template')
      } finally {
        setIsSaving(false)
      }
    },
    [category, description, name, router, signatureMode, subject, templateId]
  )

  return (
    <div className="flex h-full flex-col">
      <Editor resolver={resolver} onRender={RenderNode}>
        <KeyboardShortcuts />
        <EditorShell
          name={name}
          subject={subject}
          mode={mode}
          setMode={setMode}
          signatureMode={signatureMode}
          category={category}
          isSaving={isSaving}
          aiPanelOpen={aiPanelOpen}
          setAiPanelOpen={setAiPanelOpen}
          isAiGenerating={isAiGenerating}
          setIsAiGenerating={setIsAiGenerating}
          previewEditorState={previewEditorState}
          setPreviewEditorState={setPreviewEditorState}
          onNameChange={setName}
          onSubjectChange={setSubject}
          onSignatureModeChange={setSignatureMode}
          onCategoryChange={(v) => setCategory(v as typeof category)}
          onSave={handleSave}
          onAiMeta={handleAiMeta}
          initialScope={initialScope}
          initialStandardHtml={seededStandardHtml}
          initialSignatureConsultantId={initialSignatureConsultantId}
          sanitizedData={sanitizedData}
        />
      </Editor>
    </div>
  )
}
