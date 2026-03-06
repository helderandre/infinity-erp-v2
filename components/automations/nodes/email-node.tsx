"use client"

import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react"
import type { NodeProps } from "@xyflow/react"
import { useReactFlow } from "@xyflow/react"
import { Mail, Settings2, Undo2, Redo2, Search } from "lucide-react"
import { Editor, Frame, Element, useEditor } from "@craftjs/core"
import { Layers } from "@craftjs/layers"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { NodeWrapper } from "./node-wrapper"
import type { EmailNodeData } from "@/lib/types/automation-flow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VariablePicker } from "@/components/automations/variable-picker"
import { VariableInput } from "@/components/automations/variable-input"
import { useWebhookVariables } from "@/hooks/use-webhook-variables"

// ── Craft.js email editor imports ──

import { EmailContainer } from "@/components/email-editor/user/email-container"
import { EmailText } from "@/components/email-editor/user/email-text"
import { EmailHeading } from "@/components/email-editor/user/email-heading"
import { EmailImage } from "@/components/email-editor/user/email-image"
import { EmailButton } from "@/components/email-editor/user/email-button"
import { EmailDivider } from "@/components/email-editor/user/email-divider"
import { EmailSpacer } from "@/components/email-editor/user/email-spacer"
import { EmailAttachment } from "@/components/email-editor/user/email-attachment"
import { EmailGrid } from "@/components/email-editor/user/email-grid"
import { RenderNode } from "@/components/email-editor/email-render-node"
import {
  EmailToolbox,
  categories as toolboxCategories,
  CategorySection,
} from "@/components/email-editor/email-toolbox"
import { EmailSettingsPanel } from "@/components/email-editor/email-settings-panel"
import { EmailLayer } from "@/components/email-editor/email-layer"
import { renderEmailToHtml } from "@/lib/email-renderer"
import { AutomationVariablesProvider } from "@/components/email-editor/automation-variables-context"

const craftResolver = {
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

// ── Helper: capture editor state via ref ──

interface EditorStateHandle {
  serialize: () => string
}

function EditorStateCapture({
  handleRef,
}: {
  handleRef: React.MutableRefObject<EditorStateHandle | null>
}) {
  const { query } = useEditor()
  handleRef.current = { serialize: () => query.serialize() }
  return null
}

// ── Inline toolbox with undo/redo next to search ──

function InlineToolboxWithHistory() {
  const { actions, connectors, canUndo, canRedo } = useEditor(
    (state, query) => ({
      canUndo: query.history.canUndo(),
      canRedo: query.history.canRedo(),
    })
  )
  const [search, setSearch] = useState("")

  return (
    <div className="w-60 shrink-0 border-r overflow-auto flex flex-col">
      <div className="flex items-center gap-1 p-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar..."
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={!canUndo}
          onClick={() => actions.history.undo()}
          title="Desfazer"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={!canRedo}
          onClick={() => actions.history.redo()}
          title="Refazer"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <InlineToolboxCategories search={search} />
      </div>
    </div>
  )
}

function InlineToolboxCategories({ search }: { search: string }) {
  return (
    <>
      {toolboxCategories.map((cat) => (
        <CategorySection key={cat.name} category={cat} search={search} />
      ))}
    </>
  )
}

// ── Right sidebar for inline editor ──

function InlineEditorSidebar() {
  return (
    <Tabs
      defaultValue="properties"
      className="w-60 shrink-0 border-l flex flex-col overflow-hidden gap-0"
    >
      <TabsList className="w-full rounded-none border-b">
        <TabsTrigger value="properties" className="flex-1 text-xs">
          Propriedades
        </TabsTrigger>
        <TabsTrigger value="layers" className="flex-1 text-xs">
          Camadas
        </TabsTrigger>
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

// ── Types ──

interface EmailTemplate {
  id: string
  name: string
  subject: string
  description: string | null
}

// ── Sheet de Configuração ──

function EmailConfigSheet({
  open,
  onOpenChange,
  nodeData,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeData: EmailNodeData
  onSave: (data: Partial<EmailNodeData>) => void
}) {
  const webhookVars = useWebhookVariables()
  const [mode, setMode] = useState<"template" | "inline">(
    nodeData.emailTemplateId ? "template" : "inline"
  )
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    nodeData.emailTemplateId || ""
  )
  const [selectedTemplateName, setSelectedTemplateName] = useState(
    nodeData.emailTemplateName || ""
  )
  const [subject, setSubject] = useState(nodeData.subject || "")
  const [recipientVariable, setRecipientVariable] = useState(
    nodeData.recipientVariable || ""
  )
  const [senderName, setSenderName] = useState(nodeData.senderName || "")
  const [senderEmailPrefix, setSenderEmailPrefix] = useState(() => {
    const email = nodeData.senderEmail || ""
    return email.replace(/@infinitygroup\.pt$/, "")
  })

  // Ref to get the editor state from inside Craft.js
  const editorHandleRef = useRef<EditorStateHandle | null>(null)

  // All variables (system + webhook)
  const [systemVariables, setSystemVariables] = useState<
    { key: string; label: string; category: string; color: string; sampleValue?: string }[]
  >([])

  useEffect(() => {
    let cancelled = false
    fetch("/api/automacao/variaveis")
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setSystemVariables(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const allVariables = useMemo(
    () => [...systemVariables, ...webhookVars],
    [systemVariables, webhookVars]
  )

  // Load templates on open
  useEffect(() => {
    if (!open) return
    setLoadingTemplates(true)
    fetch("/api/automacao/email-templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false))
  }, [open])

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const tpl = templates.find((t) => t.id === templateId)
    setSelectedTemplateName(tpl?.name || "")
  }

  const handleSave = useCallback(() => {
    const fullSenderEmail = senderEmailPrefix ? `${senderEmailPrefix}@infinitygroup.pt` : ""
    const senderFields = {
      senderName: senderName || undefined,
      senderEmail: fullSenderEmail || undefined,
    }

    if (mode === "template") {
      onSave({
        emailTemplateId: selectedTemplateId || undefined,
        emailTemplateName: selectedTemplateName || undefined,
        subject: undefined,
        bodyHtml: undefined,
        editorState: undefined,
        recipientVariable,
        ...senderFields,
      })
    } else {
      // Get editor state from Craft.js
      let editorState: string | undefined
      let bodyHtml: string | undefined
      if (editorHandleRef.current) {
        const serialized = editorHandleRef.current.serialize()
        editorState = serialized
        bodyHtml = renderEmailToHtml(serialized, {})
      }
      onSave({
        emailTemplateId: undefined,
        emailTemplateName: undefined,
        subject,
        bodyHtml,
        editorState,
        recipientVariable,
        ...senderFields,
      })
    }
    onOpenChange(false)
  }, [
    mode, selectedTemplateId, selectedTemplateName,
    subject, recipientVariable, senderName, senderEmailPrefix,
    onSave, onOpenChange,
  ])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  // Parse initial editor data for Craft.js
  const initialEditorData = useMemo(() => {
    if (!nodeData.editorState) return undefined
    if (typeof nodeData.editorState === "string") return nodeData.editorState
    return JSON.stringify(nodeData.editorState)
  }, [nodeData.editorState])

  const isInline = mode === "inline"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`p-0 flex flex-col gap-0 ${
          isInline
            ? "!w-[80vw] !max-w-[80vw]"
            : "w-full !max-w-lg min-w-[520px]"
        }`}
        side="right"
      >
        {/* Header: title + mode tabs */}
        <div className="border-b shrink-0">
          <div className="flex items-center justify-between px-6 py-3">
            <SheetHeader className="p-0">
              <SheetTitle className="text-base">Configurar Email</SheetTitle>
            </SheetHeader>
            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => setMode("template")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === "template"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Template da biblioteca
              </button>
              <button
                type="button"
                onClick={() => setMode("inline")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === "inline"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Criar template
              </button>
            </div>
          </div>

          {/* All config fields in one row */}
          <div className="flex items-end gap-3 px-6 pb-3">
            {/* Remetente nome */}
            <div className="flex-1 min-w-0">
              <Label className="text-xs font-medium mb-1 block text-muted-foreground">
                De (nome)
              </Label>
              <Input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Infinity Group"
                className="h-8 text-sm"
              />
            </div>
            {/* Remetente email */}
            <div className="flex-1 min-w-0">
              <Label className="text-xs font-medium mb-1 block text-muted-foreground">
                De (email)
              </Label>
              <div className="flex items-center">
                <Input
                  value={senderEmailPrefix}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^a-zA-Z0-9.\-_]/g, "").toLowerCase()
                    setSenderEmailPrefix(clean)
                  }}
                  placeholder="info"
                  className="h-8 text-sm rounded-r-none"
                />
                <div className="flex items-center rounded-r-md border border-l-0 bg-muted px-2.5 h-8 text-xs text-muted-foreground whitespace-nowrap">
                  @infinitygroup.pt
                </div>
              </div>
            </div>
            {/* Enviar para */}
            <div className="flex-1 min-w-0">
              <Label className="text-xs font-medium mb-1 block text-muted-foreground">
                Enviar para
              </Label>
              <div className="flex items-center gap-1">
                <VariableInput
                  value={recipientVariable}
                  onChange={setRecipientVariable}
                  placeholder="@ variáveis ou email"
                  variables={allVariables}
                  className="flex-1 h-8 text-sm"
                />
                <VariablePicker
                  onSelect={(v) => setRecipientVariable(v.key)}
                  additionalVariables={webhookVars}
                  compact
                />
              </div>
            </div>
            {/* Assunto (only in inline mode) */}
            {isInline && (
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-medium mb-1 block text-muted-foreground">
                  Assunto
                </Label>
                <div className="flex items-center gap-1">
                  <VariableInput
                    value={subject}
                    onChange={setSubject}
                    placeholder="@ variáveis"
                    variables={allVariables}
                    className="flex-1 h-8 text-sm"
                  />
                  <VariablePicker
                    onSelect={(v) =>
                      setSubject((prev) => prev + `{{${v.key}}}`)
                    }
                    additionalVariables={webhookVars}
                    compact
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Template mode */}
        {mode === "template" && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Template de Email
              </Label>
              <Select
                value={selectedTemplateId}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingTemplates
                        ? "A carregar..."
                        : "Seleccionar template"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                  {templates.length === 0 && !loadingTemplates && (
                    <SelectItem value="_empty" disabled>
                      Nenhum template encontrado
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && (
              <div className="rounded-lg border p-3 space-y-1 bg-muted/30">
                <p className="text-sm font-medium">{selectedTemplate.name}</p>
                <p className="text-xs text-muted-foreground">
                  Assunto: {selectedTemplate.subject}
                </p>
                {selectedTemplate.description && (
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.description}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Inline mode — full Craft.js email editor */}
        {isInline && (
          <div className="flex-1 min-h-0 flex flex-col">
            <AutomationVariablesProvider variables={allVariables}>
            <Editor resolver={craftResolver} onRender={RenderNode}>
              <EditorStateCapture handleRef={editorHandleRef} />
              <div className="flex flex-1 min-h-0">
                {/* Toolbox with undo/redo */}
                <InlineToolboxWithHistory />
                {/* Canvas */}
                <div className="flex-1 overflow-auto bg-muted/30 p-6">
                  <div className="mx-auto" style={{ maxWidth: 620 }}>
                    <Frame data={initialEditorData}>
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
                        <EmailText html="Edite o conteúdo do email aqui" />
                      </Element>
                    </Frame>
                  </div>
                </div>
                {/* Settings sidebar */}
                <InlineEditorSidebar />
              </div>
            </Editor>
            </AutomationVariablesProvider>
          </div>
        )}

        {/* Footer */}
        <div className="border-t px-6 py-4 shrink-0">
          <Button onClick={handleSave} className="w-full">
            Guardar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Node Component ──

function EmailNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as EmailNodeData
  const { updateNodeData } = useReactFlow()
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleSave = useCallback(
    (patch: Partial<EmailNodeData>) => {
      updateNodeData(id, { ...nodeData, ...patch })
    },
    [id, nodeData, updateNodeData]
  )

  const isConfigured = nodeData.emailTemplateId || nodeData.subject

  return (
    <>
      <NodeWrapper
        id={id}
        nodeType="email"
        selected={selected}
        icon={<Mail />}
        title={nodeData.label || "Email"}
        description={!isConfigured ? "Enviar email automático" : undefined}
      >
        {nodeData.emailTemplateId ? (
          <div className="space-y-1.5">
            <div className="rounded-lg bg-muted/60 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  Template
                </Badge>
                <span className="truncate text-[10px] font-medium text-foreground">
                  {nodeData.emailTemplateName || "Template seleccionado"}
                </span>
              </div>
            </div>
            {nodeData.recipientVariable && (
              <p className="text-[10px]">Para: {nodeData.recipientVariable}</p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSheetOpen(true)
              }}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <Settings2 className="h-3 w-3" /> Configurar
            </button>
          </div>
        ) : nodeData.subject ? (
          <div className="space-y-1.5">
            <div className="rounded-lg bg-muted/60 px-2.5 py-1.5">
              <p className="truncate text-[10px] font-medium text-foreground">
                {nodeData.subject}
              </p>
            </div>
            {nodeData.recipientVariable && (
              <p className="text-[10px]">Para: {nodeData.recipientVariable}</p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSheetOpen(true)
              }}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <Settings2 className="h-3 w-3" /> Configurar
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSheetOpen(true)
            }}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <Settings2 className="h-3.5 w-3.5" /> Configurar email
          </button>
        )}
      </NodeWrapper>

      <EmailConfigSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        nodeData={nodeData}
        onSave={handleSave}
      />
    </>
  )
}

export const EmailNode = memo(EmailNodeInner)
