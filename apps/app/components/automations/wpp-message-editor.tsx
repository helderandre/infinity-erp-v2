"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  MessageCircle,
  ImageIcon,
  Video,
  Mic,
  FileText,
  Upload,
  X,
  Square,
  Link2,
  Play,
  Pause,
  RotateCcw,
  Music,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WppRichEditor, type WppRichEditorRef } from "@/components/automations/wpp-rich-editor"
import type { VariableItem } from "@/components/automations/variable-picker"
import type { WhatsAppTemplateMessage } from "@/lib/types/whatsapp-template"
import type { WhatsAppMessageType } from "@/lib/types/automation-flow"
import { WppMessagePreview } from "@/components/automations/wpp-message-preview"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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

// ── Accepted types config (mirrors API) ──

const MEDIA_ACCEPT: Record<string, { accept: string; label: string }> = {
  image: { accept: "image/jpeg,image/png,image/webp", label: "JPG, PNG, WebP · Máx. 5 MB" },
  video: { accept: "video/mp4", label: "MP4 · Máx. 16 MB" },
  audio: { accept: "audio/mpeg,audio/ogg,audio/webm,audio/wav", label: "MP3, OGG, WebM, WAV · Máx. 5 MB" },
  document: { accept: "application/pdf,.docx,.xlsx", label: "PDF, DOCX, XLSX · Máx. 10 MB" },
}

// ── Upload helper ──

async function uploadMediaFile(
  file: File,
  type: string,
  templateId?: string
): Promise<{ url: string; fileName: string } | null> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("type", type)
  if (templateId) formData.append("templateId", templateId)

  const res = await fetch("/api/automacao/media/upload", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json()
    toast.error(err.error || "Erro ao enviar ficheiro")
    return null
  }

  const data = await res.json()
  return { url: data.url, fileName: data.fileName }
}

// ── FileDropZone ──

function FileDropZone({
  accept,
  label,
  uploading,
  onFileSelected,
}: {
  accept: string
  label: string
  uploading: boolean
  onFileSelected: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) onFileSelected(file)
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
        uploading && "opacity-50 pointer-events-none"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelected(file)
          e.target.value = ""
        }}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Spinner className="h-6 w-6 text-primary" />
          <span className="text-sm text-muted-foreground">A enviar...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Arrasta um ficheiro ou clica para seleccionar
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      )}
    </div>
  )
}

// ── Uploaded file info ──

function UploadedFileInfo({
  fileName,
  url,
  onRemove,
}: {
  fileName: string
  url: string
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-2.5 bg-muted/30">
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <p className="text-[10px] text-muted-foreground truncate">{url}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ── AudioPlayer ──

function AudioPlayer({ src, className }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  if (!src) return null

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border bg-muted/30 p-3", className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1 space-y-1">
        <div className="h-1.5 rounded-full bg-muted-foreground/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: audioDuration ? `${(currentTime / audioDuration) * 100}%` : "0%" }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(audioDuration)}</span>
        </div>
      </div>
    </div>
  )
}

// ── AudioRecordTab ──

type RecordingState = "idle" | "recording" | "recorded" | "uploaded"

function AudioRecordTab({
  onUploaded,
  uploadedUrl,
  uploadedFileName,
  onRemove,
  templateId,
}: {
  onUploaded: (url: string, fileName: string) => void
  uploadedUrl: string
  uploadedFileName: string
  onRemove: () => void
  templateId?: string
}) {
  const [recordingState, setRecordingState] = useState<RecordingState>(
    uploadedUrl ? "uploaded" : "idle"
  )
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedLocalUrl, setRecordedLocalUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [uploading, setUploading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Sync external state
  useEffect(() => {
    if (uploadedUrl && recordingState !== "uploaded") {
      setRecordingState("uploaded")
    } else if (!uploadedUrl && recordingState === "uploaded") {
      setRecordingState("idle")
    }
  }, [uploadedUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const localUrl = URL.createObjectURL(blob)
        setRecordedBlob(blob)
        setRecordedLocalUrl(localUrl)
        setRecordingState("recorded")
        stream.getTracks().forEach((t) => t.stop())
      }

      recorder.start()
      setRecordingState("recording")
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch {
      toast.error("Nao foi possivel aceder ao microfone")
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleConfirmRecording = async () => {
    if (!recordedBlob) return
    setUploading(true)
    const file = new File([recordedBlob], `audio-${Date.now()}.webm`, { type: "audio/webm" })
    try {
      const result = await uploadMediaFile(file, "audio", templateId)
      if (result) {
        setRecordingState("uploaded")
        onUploaded(result.url, result.fileName)
        toast.success("Audio enviado com sucesso")
      }
    } finally {
      setUploading(false)
    }
  }

  const handleReRecord = () => {
    if (recordedLocalUrl) URL.revokeObjectURL(recordedLocalUrl)
    setRecordedBlob(null)
    setRecordedLocalUrl(null)
    setDuration(0)
    setRecordingState("idle")
  }

  const handleRecordNew = () => {
    onRemove()
    handleReRecord()
  }

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

  // IDLE
  if (recordingState === "idle") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Mic className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Clica para gravar uma mensagem de voz</p>
        <Button variant="outline" onClick={startRecording}>
          <Mic className="h-4 w-4 mr-2" />
          Iniciar Gravacao
        </Button>
      </div>
    )
  }

  // RECORDING
  if (recordingState === "recording") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium">A gravar...</span>
        </div>
        <span className="text-lg font-mono tabular-nums">{formatDuration(duration)}</span>
        <Button variant="outline" onClick={stopRecording}>
          <Square className="h-3.5 w-3.5 mr-2" /> Parar Gravacao
        </Button>
      </div>
    )
  }

  // RECORDED (pre-submit)
  if (recordingState === "recorded" && recordedLocalUrl) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-emerald-600">Gravacao concluida</p>
        <AudioPlayer src={recordedLocalUrl} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReRecord} className="flex-1">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Regravar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmRecording}
            disabled={uploading}
            className="flex-1"
          >
            {uploading ? (
              <><Spinner className="h-3.5 w-3.5 mr-1.5" /> A enviar...</>
            ) : (
              <><Upload className="h-3.5 w-3.5 mr-1.5" /> Usar esta gravacao</>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // UPLOADED
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-emerald-600">Audio enviado</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Music className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{uploadedFileName}</span>
        </div>
        <AudioPlayer src={uploadedUrl} />
        <p className="text-[10px] text-muted-foreground truncate">{uploadedUrl}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleRecordNew} className="flex-1">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Gravar novo
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove} className="flex-1">
          <X className="h-3.5 w-3.5 mr-1.5" /> Remover
        </Button>
      </div>
    </div>
  )
}

// ── Main editor ──

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
  const [uploading, setUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState("")
  const [mediaInputMode, setMediaInputMode] = useState<"upload" | "url">("upload")
  const [audioInputMode, setAudioInputMode] = useState<"record" | "upload" | "url">("record")
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
      setUploadedFileName("")
      setMediaInputMode(message.mediaUrl ? "url" : "upload")
      setAudioInputMode(message.mediaUrl ? "url" : "record")
    } else {
      setType("text")
      setContent("")
      setMediaUrl("")
      setDocName("")
      setDelay(2)
      setAudioType("ptt")
      setUploadedFileName("")
      setMediaInputMode("upload")
      setAudioInputMode("record")
    }
  }, [message, open])

  const handleFileUpload = useCallback(async (file: File, mediaTypeOverride?: string) => {
    const uploadType = mediaTypeOverride || type
    setUploading(true)
    try {
      const result = await uploadMediaFile(file, uploadType)
      if (result) {
        setMediaUrl(result.url)
        setUploadedFileName(result.fileName)
        if (type === "document" && !docName) {
          setDocName(result.fileName)
        }
        toast.success("Ficheiro enviado com sucesso")
      }
    } finally {
      setUploading(false)
    }
  }, [type, docName])

  const handleRemoveMedia = useCallback(() => {
    setMediaUrl("")
    setUploadedFileName("")
  }, [])

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
      <SheetContent className="w-full sm:max-w-lg min-w-[600px] p-0 gap-0 flex flex-col" side="right">
        {/* HEADER FIXO */}
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-base">
            {message ? "Editar Mensagem" : "Nova Mensagem"}
          </SheetTitle>
        </SheetHeader>

        {/* CORPO SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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

          {/* WhatsApp Preview Mockup */}
          <WppMessagePreview
            type={type === "audio" ? audioType : type}
            content={content}
            mediaUrl={mediaUrl}
            docName={docName}
          />

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
                  <Label className="text-sm font-medium mb-2 block">Ficheiro</Label>
                  <Tabs value={mediaInputMode} onValueChange={(v) => setMediaInputMode(v as "upload" | "url")} className="mb-3">
                    <TabsList className="h-8">
                      <TabsTrigger value="upload" className="text-xs h-7"><Upload className="h-3 w-3 mr-1.5" />Upload</TabsTrigger>
                      <TabsTrigger value="url" className="text-xs h-7"><Link2 className="h-3 w-3 mr-1.5" />URL</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {mediaInputMode === "upload" ? (
                    mediaUrl && uploadedFileName ? (
                      <UploadedFileInfo fileName={uploadedFileName} url={mediaUrl} onRemove={handleRemoveMedia} />
                    ) : (
                      <FileDropZone
                        accept={MEDIA_ACCEPT[type].accept}
                        label={MEDIA_ACCEPT[type].label}
                        uploading={uploading}
                        onFileSelected={(f) => handleFileUpload(f)}
                      />
                    )
                  ) : (
                    <div>
                      <Input
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://..."
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {MEDIA_ACCEPT[type].label}
                      </p>
                    </div>
                  )}
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
                  <Label className="text-sm font-medium mb-2 block">Ficheiro</Label>
                  <Tabs value={mediaInputMode} onValueChange={(v) => setMediaInputMode(v as "upload" | "url")} className="mb-3">
                    <TabsList className="h-8">
                      <TabsTrigger value="upload" className="text-xs h-7"><Upload className="h-3 w-3 mr-1.5" />Upload</TabsTrigger>
                      <TabsTrigger value="url" className="text-xs h-7"><Link2 className="h-3 w-3 mr-1.5" />URL</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {mediaInputMode === "upload" ? (
                    mediaUrl && uploadedFileName ? (
                      <UploadedFileInfo fileName={uploadedFileName} url={mediaUrl} onRemove={handleRemoveMedia} />
                    ) : (
                      <FileDropZone
                        accept={MEDIA_ACCEPT.document.accept}
                        label={MEDIA_ACCEPT.document.label}
                        uploading={uploading}
                        onFileSelected={(f) => handleFileUpload(f)}
                      />
                    )
                  ) : (
                    <div>
                      <Input
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://..."
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {MEDIA_ACCEPT.document.label}
                      </p>
                    </div>
                  )}
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
                  <Label className="text-sm font-medium mb-2 block">Audio</Label>
                  <Tabs value={audioInputMode} onValueChange={(v) => setAudioInputMode(v as "record" | "upload" | "url")}>
                    <TabsList className="w-full h-8 mb-3">
                      <TabsTrigger value="record" className="text-xs h-7 flex-1">
                        <Mic className="h-3 w-3 mr-1.5" /> Gravar
                      </TabsTrigger>
                      <TabsTrigger value="upload" className="text-xs h-7 flex-1">
                        <Upload className="h-3 w-3 mr-1.5" /> Enviar
                      </TabsTrigger>
                      <TabsTrigger value="url" className="text-xs h-7 flex-1">
                        <Link2 className="h-3 w-3 mr-1.5" /> URL
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="record" className="mt-0">
                      <AudioRecordTab
                        onUploaded={(url, fileName) => {
                          setMediaUrl(url)
                          setUploadedFileName(fileName)
                        }}
                        uploadedUrl={mediaUrl}
                        uploadedFileName={uploadedFileName}
                        onRemove={handleRemoveMedia}
                      />
                    </TabsContent>

                    <TabsContent value="upload" className="mt-0">
                      {mediaUrl && uploadedFileName ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-lg border p-2">
                            <div className="flex items-center gap-2 text-sm truncate">
                              <Music className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate">{uploadedFileName}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleRemoveMedia}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <AudioPlayer src={mediaUrl} />
                        </div>
                      ) : (
                        <FileDropZone
                          accept={MEDIA_ACCEPT.audio.accept}
                          label={MEDIA_ACCEPT.audio.label}
                          uploading={uploading}
                          onFileSelected={(f) => handleFileUpload(f, "audio")}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="url" className="mt-0">
                      <div className="space-y-3">
                        <div>
                          <Input
                            value={mediaUrl}
                            onChange={(e) => setMediaUrl(e.target.value)}
                            placeholder="https://exemplo.com/audio.mp3"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {MEDIA_ACCEPT.audio.label}
                          </p>
                        </div>
                        {mediaUrl && (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) && (
                          <AudioPlayer src={mediaUrl} />
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
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
                        Audio normal
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
