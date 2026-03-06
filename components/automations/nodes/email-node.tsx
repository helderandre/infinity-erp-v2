"use client"

import { memo, useState, useCallback, useEffect } from "react"
import type { NodeProps } from "@xyflow/react"
import { useReactFlow } from "@xyflow/react"
import { Mail, Settings2 } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { EmailNodeData } from "@/lib/types/automation-flow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Separator } from "@/components/ui/separator"
import { VariablePicker } from "@/components/automations/variable-picker"
import { useWebhookVariables } from "@/hooks/use-webhook-variables"

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
  const [bodyHtml, setBodyHtml] = useState(nodeData.bodyHtml || "")
  const [recipientVariable, setRecipientVariable] = useState(
    nodeData.recipientVariable || ""
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
    if (mode === "template") {
      onSave({
        emailTemplateId: selectedTemplateId || undefined,
        emailTemplateName: selectedTemplateName || undefined,
        subject: undefined,
        bodyHtml: undefined,
        recipientVariable,
      })
    } else {
      onSave({
        emailTemplateId: undefined,
        emailTemplateName: undefined,
        subject,
        bodyHtml,
        recipientVariable,
      })
    }
    onOpenChange(false)
  }, [
    mode, selectedTemplateId, selectedTemplateName,
    subject, bodyHtml, recipientVariable, onSave, onOpenChange,
  ])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg min-w-[520px] p-0 flex flex-col" side="right">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-base">Configurar Email</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Recipient */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Destinatário</Label>
            <div className="flex items-center gap-2">
              <Input
                value={recipientVariable}
                onChange={(e) => setRecipientVariable(e.target.value)}
                placeholder="{{lead_email}} ou email@example.com"
                className="flex-1"
              />
              <VariablePicker
                onSelect={(v) => setRecipientVariable(v.key)}
                additionalVariables={webhookVars}
                compact
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Variável ou email directo do destinatário
            </p>
          </div>

          <Separator />

          {/* Mode toggle */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Conteúdo do email
            </Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "template" | "inline")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="template">Template da biblioteca</SelectItem>
                <SelectItem value="inline">Criar neste fluxo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Template mode */}
          {mode === "template" && (
            <div className="space-y-4">
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
                      placeholder={loadingTemplates ? "A carregar..." : "Seleccionar template"}
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

          {/* Inline mode */}
          {mode === "inline" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Assunto</Label>
                  <VariablePicker
                    onSelect={(v) => setSubject((prev) => prev + `{{${v.key}}}`)}
                    additionalVariables={webhookVars}
                    compact
                  />
                </div>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Bem-vindo {{lead_nome}}!"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Corpo do Email</Label>
                  <VariablePicker
                    onSelect={(v) => setBodyHtml((prev) => prev + `{{${v.key}}}`)}
                    additionalVariables={webhookVars}
                    compact
                  />
                </div>
                <Textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  placeholder="Escreva o conteúdo do email com {{variáveis}}..."
                  className="min-h-[180px] resize-y font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Suporta HTML e variáveis: {"{{lead_nome}}"}, {"{{imovel_ref}}"}
                </p>
              </div>
            </div>
          )}
        </div>

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
              onClick={(e) => { e.stopPropagation(); setSheetOpen(true) }}
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
              onClick={(e) => { e.stopPropagation(); setSheetOpen(true) }}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <Settings2 className="h-3 w-3" /> Configurar
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setSheetOpen(true) }}
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
