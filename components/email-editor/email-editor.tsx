'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Editor, Frame, Element, useEditor } from '@craftjs/core'
import { ROOT_NODE, getRandomId } from '@craftjs/utils'
import { Layers } from '@craftjs/layers'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

import { EmailContainer } from './user/email-container'
import { EmailText } from './user/email-text'
import { EmailHeading } from './user/email-heading'
import { EmailImage } from './user/email-image'
import { EmailButton } from './user/email-button'
import { EmailDivider } from './user/email-divider'
import { EmailSpacer } from './user/email-spacer'
import { EmailAttachment } from './user/email-attachment'
import { EmailGrid } from './user/email-grid'

import { RenderNode, duplicateNode } from './email-render-node'
import { EmailToolbox } from './email-toolbox'
import { EmailSettingsPanel } from './email-settings-panel'
import { EmailTopbar, type EditorMode } from './email-topbar'
import { EmailLayer } from './email-layer'
import { EmailPreviewPanel } from './email-preview-panel'

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
}

interface EmailEditorProps {
  initialData: string | null
  templateId: string | null
  initialName: string
  initialSubject: string
  initialDescription: string
}

/**
 * Sanitize serialized Craft.js state to fix duplicate node IDs
 * caused by a previous buggy duplication that reused original IDs.
 *
 * When a parent's `nodes` array has the same ID more than once,
 * we deep-clone the subtree for each extra occurrence and assign fresh IDs.
 */
function sanitizeEditorState(raw: string): string {
  try {
    const nodes = JSON.parse(raw) as Record<string, Record<string, unknown>>

    // Collect all subtree node IDs for a given root
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

    // Clone a subtree starting from rootId, generating fresh IDs
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

    // Walk every node and fix duplicate children
    let changed = false
    for (const node of Object.values(nodes)) {
      const childIds = (node as { nodes?: string[] }).nodes
      if (!Array.isArray(childIds)) continue

      const seen = new Set<string>()
      for (let i = 0; i < childIds.length; i++) {
        if (seen.has(childIds[i])) {
          // Duplicate — clone the subtree and replace reference
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

export function EmailEditorComponent({
  initialData,
  templateId,
  initialName,
  initialSubject,
  initialDescription,
}: EmailEditorProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [subject, setSubject] = useState(initialSubject)
  const [description] = useState(initialDescription)
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState<EditorMode>('edit')
  const [previewEditorState, setPreviewEditorState] = useState<string | null>(null)

  const sanitizedData = useMemo(
    () => (initialData ? sanitizeEditorState(initialData) : undefined),
    [initialData]
  )

  const handleSave = async (editorState: string) => {
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
        body_html: `<!-- craft.js template: ${name} -->`,
        editor_state: JSON.parse(editorState),
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
  }

  const handleModeChange = (newMode: EditorMode, editorState: string) => {
    if (newMode === 'preview') {
      setPreviewEditorState(editorState)
    }
    setMode(newMode)
  }

  return (
    <div className="flex flex-col -m-4 md:-m-6 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] overflow-hidden">
      <Editor resolver={resolver} onRender={RenderNode}>
        <KeyboardShortcuts />
        <EmailTopbar
          name={name}
          subject={subject}
          mode={mode}
          onNameChange={setName}
          onSubjectChange={setSubject}
          onSave={handleSave}
          onModeChange={handleModeChange}
          isSaving={isSaving}
        />

        {/* Edit mode */}
        {mode === 'edit' && (
          <div className="flex flex-1 overflow-hidden">
            <EmailToolbox />
            <div className="flex-1 overflow-auto bg-muted/30 p-8">
              <div className="mx-auto" style={{ maxWidth: 620 }}>
                <Frame data={sanitizedData}>
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
                    <EmailText html="Edite o seu template aqui" />
                  </Element>
                </Frame>
              </div>
            </div>
            <RightSidebar />
          </div>
        )}

        {/* Preview mode */}
        {mode === 'preview' && (
          <EmailPreviewPanel
            editorState={previewEditorState}
            subject={subject}
          />
        )}
      </Editor>
    </div>
  )
}
