"use client"

import { useState, useEffect } from "react"
import {
  MessageCircle,
  ImageIcon,
  Video,
  Mic,
  FileText,
  Upload,
  Braces,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { VariablePicker } from "@/components/automations/variable-picker"
import type { WhatsAppTemplateMessage } from "@/lib/types/whatsapp-template"
import type { WhatsAppMessageType } from "@/lib/types/automation-flow"

interface WppMessageEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: WhatsAppTemplateMessage | null
  onSave: (message: WhatsAppTemplateMessage) => void
}

const MESSAGE_TYPES: {
  type: WhatsAppMessageType
  icon: typeof MessageCircle
  label: string
}[] = [
  { type: "text", icon: MessageCircle, label: "Texto" },
  { type: "image", icon: ImageIcon, label: "Imagem" },
  { type: "video", icon: Video, label: "Vídeo" },
  { type: "audio", icon: Mic, label: "Áudio" },
  { type: "document", icon: FileText, label: "Documento" },
]

export function WppMessageEditor({
  open,
  onOpenChange,
  message,
  onSave,
}: WppMessageEditorProps) {
  const [type, setType] = useState<WhatsAppMessageType>("text")
  const [content, setContent] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [docName, setDocName] = useState("")
  const [delay, setDelay] = useState(2)
  const [audioType, setAudioType] = useState<"audio" | "ptt">("ptt")

  useEffect(() => {
    if (message) {
      setType(message.type)
      setContent(message.content || "")
      setMediaUrl(message.mediaUrl || "")
      setDocName(message.docName || "")
      setDelay(message.delay ?? 2)
      setAudioType(message.type === "ptt" ? "ptt" : "audio")
    } else {
      setType("text")
      setContent("")
      setMediaUrl("")
      setDocName("")
      setDelay(2)
      setAudioType("ptt")
    }
  }, [message, open])

  function handleSave() {
    const finalType = type === "audio" ? audioType : type

    onSave({
      id: message?.id || crypto.randomUUID(),
      type: finalType,
      content,
      mediaUrl: mediaUrl || undefined,
      docName: docName || undefined,
      delay,
    })
    onOpenChange(false)
  }

  function handleInsertVariable(variableKey: string) {
    setContent((prev) => prev + `{{${variableKey}}}`)
  }

  const charCount = content.length
  const maxChars = type === "text" ? 4096 : 1024

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg min-w-[600px] p-0 flex flex-col" side="right">
        {/* HEADER FIXO */}
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-base">
            {message ? "Editar Mensagem" : "Nova Mensagem"}
          </SheetTitle>
        </SheetHeader>

        {/* CORPO SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Section 1: Message Type */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Tipo de Mensagem
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {MESSAGE_TYPES.map((mt) => {
                const Icon = mt.icon
                const isActive =
                  mt.type === type ||
                  (mt.type === "audio" &&
                    (type === "audio" || type === "ptt"))
                return (
                  <button
                    key={mt.type}
                    type="button"
                    onClick={() => setType(mt.type)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-[11px] font-medium ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {mt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* Section 2: Content (dynamic by type) */}
          <div className="space-y-4">
            {/* Text content (all types except audio) */}
            {type === "text" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Mensagem</Label>
                  <VariablePicker
                    onSelect={(v) => handleInsertVariable(v.key)}
                    compact
                  />
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escreva a sua mensagem..."
                  className="min-h-[120px] resize-y"
                  maxLength={maxChars}
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[10px] text-muted-foreground">
                    Formatação: *negrito* _itálico_ ~riscado~
                  </p>
                  <span
                    className={`text-[10px] ${
                      charCount > maxChars * 0.9
                        ? "text-red-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {charCount} / {maxChars}
                  </span>
                </div>
              </div>
            )}

            {/* Image / Video */}
            {(type === "image" || type === "video") && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    URL do ficheiro
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="https://... ou arrastar ficheiro"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {type === "image"
                      ? "Formatos: JPG, PNG, WebP (máx. 5 MB)"
                      : "Formatos: MP4 (máx. 16 MB)"}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">
                      Legenda (opcional)
                    </Label>
                    <VariablePicker
                      onSelect={(v) => handleInsertVariable(v.key)}
                      compact
                    />
                  </div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Legenda da imagem/vídeo..."
                    className="min-h-[60px] resize-y"
                    maxLength={maxChars}
                  />
                </div>
              </>
            )}

            {/* Document */}
            {type === "document" && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    URL do ficheiro
                  </Label>
                  <Input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Formatos: PDF, DOCX, XLSX, PPTX (máx. 10 MB)
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Nome do ficheiro
                  </Label>
                  <Input
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Brochura_Infinity_Group.pdf"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">
                      Legenda (opcional)
                    </Label>
                    <VariablePicker
                      onSelect={(v) => handleInsertVariable(v.key)}
                      compact
                    />
                  </div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Segue o documento solicitado..."
                    className="min-h-[60px] resize-y"
                    maxLength={maxChars}
                  />
                </div>
              </>
            )}

            {/* Audio */}
            {(type === "audio" || type === "ptt") && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    URL do ficheiro de áudio
                  </Label>
                  <Input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Formatos: MP3, OGG (máx. 5 MB)
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Tipo</Label>
                  <RadioGroup
                    value={audioType}
                    onValueChange={(v) => setAudioType(v as "audio" | "ptt")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="audio" id="audio-normal" />
                      <Label htmlFor="audio-normal" className="text-sm">
                        Áudio normal
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ptt" id="audio-ptt" />
                      <Label htmlFor="audio-ptt" className="text-sm">
                        Mensagem de voz
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}
          </div>

          <Separator />

          {/* Section 3: Send config */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Atraso antes de enviar
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={30}
                value={delay}
                onChange={(e) =>
                  setDelay(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">segundos</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Mostra &quot;digitando...&quot; antes de enviar
            </p>
          </div>

        </div>

        {/* FOOTER FIXO */}
        <div className="border-t px-6 py-3 shrink-0">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {message ? "Guardar Alterações" : "Adicionar Mensagem"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
