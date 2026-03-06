"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  MessageCircle,
  ImageIcon,
  Video,
  Mic,
  FileText,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { WppRichEditor, type WppRichEditorRef } from "@/components/automations/wpp-rich-editor"
import type { VariableItem } from "@/components/automations/variable-picker"
import type { WhatsAppTemplateMessage } from "@/lib/types/whatsapp-template"
import type { WhatsAppMessageType } from "@/lib/types/automation-flow"

interface WppMessageEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: WhatsAppTemplateMessage | null
  onSave: (message: WhatsAppTemplateMessage) => void
  additionalVariables?: VariableItem[]
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
  additionalVariables,
}: WppMessageEditorProps) {
  const [type, setType] = useState<WhatsAppMessageType>("text")
  const [content, setContent] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [docName, setDocName] = useState("")
  const [delay, setDelay] = useState(2)
  const [audioType, setAudioType] = useState<"audio" | "ptt">("ptt")
  const [systemVariables, setSystemVariables] = useState<VariableItem[]>([])
  const editorRef = useRef<WppRichEditorRef>(null)

  // Load system variables once
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/automacao/variaveis")
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setSystemVariables(data)
        }
      } catch {
        // silently fail
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Combine system + webhook variables
  const variables = useMemo(() => {
    const combined = [...systemVariables]
    if (additionalVariables) combined.push(...additionalVariables)
    return combined
  }, [systemVariables, additionalVariables])

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
            {/* Text content */}
            {type === "text" && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Mensagem</Label>
                <WppRichEditor
                  ref={editorRef}
                  value={content}
                  onChange={setContent}
                  placeholder="Escreva a sua mensagem..."
                  maxLength={maxChars}
                  minHeight="120px"
                  variables={variables}
                />
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
                  <Label className="text-sm font-medium mb-2 block">
                    Legenda (opcional)
                  </Label>
                  <WppRichEditor
                    value={content}
                    onChange={setContent}
                    placeholder="Legenda da imagem/vídeo..."
                    maxLength={maxChars}
                    minHeight="60px"
                    variables={variables}
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
                  <Label className="text-sm font-medium mb-2 block">
                    Legenda (opcional)
                  </Label>
                  <WppRichEditor
                    value={content}
                    onChange={setContent}
                    placeholder="Segue o documento solicitado..."
                    maxLength={maxChars}
                    minHeight="60px"
                    variables={variables}
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
