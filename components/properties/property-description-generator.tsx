'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Sparkles, Mic, MicOff, Check, RefreshCw, Copy,
  Building2, Send, ChevronDown,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PropertyDescriptionGeneratorProps {
  propertyId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  property: Record<string, any>
  onUseDescription: (description: string) => void
  existingDescription?: string
  trigger?: React.ReactNode
}

type Language = 'pt' | 'en' | 'fr' | 'es'
type Tone = 'professional' | 'premium' | 'cozy'

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'pt', label: 'PT' },
  { value: 'en', label: 'EN' },
  { value: 'fr', label: 'FR' },
  { value: 'es', label: 'ES' },
]

const TONES: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'Profissional' },
  { value: 'premium', label: 'Premium' },
  { value: 'cozy', label: 'Acolhedor' },
]

// SSE stream reader helper
async function readSSE(
  res: Response,
  onChunk: (fullText: string) => void,
) {
  if (!res.body) throw new Error('No stream')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') break
      try {
        const { text } = JSON.parse(data)
        fullText += text
        onChunk(fullText.trim())
      } catch { /* skip */ }
    }
  }
}

export function PropertyDescriptionGenerator({
  propertyId,
  property,
  onUseDescription,
  existingDescription,
  trigger,
}: PropertyDescriptionGeneratorProps) {
  const [open, setOpen] = useState(false)
  const [loadedExisting, setLoadedExisting] = useState(false)
  const [language, setLanguage] = useState<Language>('pt')
  const [tone, setTone] = useState<Tone>('professional')
  const [notes, setNotes] = useState('')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [refining, setRefining] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [showGenOptions, setShowGenOptions] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const refineInputRef = useRef<HTMLInputElement>(null)

  const hasDescription = !!description
  const isBusy = generating || refining

  // Load existing description when sheet opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && existingDescription && !loadedExisting && !description) {
      setDescription(existingDescription)
      setLoadedExisting(true)
    }
    if (!isOpen) {
      setLoadedExisting(false)
    }
  }, [existingDescription, loadedExisting, description])

  const specs = Array.isArray(property.dev_property_specifications)
    ? property.dev_property_specifications[0]
    : property.dev_property_specifications

  const propertySummary = [
    specs?.typology && property.property_type
      ? `${specs.typology} ${property.property_type}`
      : property.property_type,
    property.business_type === 'venda' ? 'Venda' : property.business_type === 'arrendamento' ? 'Arrendamento' : property.business_type,
  ].filter(Boolean).join(' · ')

  const detailLines = [
    property.city && property.zone ? `${property.city}, ${property.zone}` : property.city || property.zone,
    [specs?.area_util && `${specs.area_util}m²`, specs?.bedrooms && `${specs.bedrooms} quartos`, specs?.bathrooms && `${specs.bathrooms} WC`].filter(Boolean).join(' · '),
    [property.energy_certificate && `Cert. ${property.energy_certificate}`, specs?.construction_year && `Ano: ${specs.construction_year}`, specs?.has_elevator && 'Elevador'].filter(Boolean).join(' · '),
  ].filter(Boolean)

  // ─── Voice recording (for refine input) ───
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (chunksRef.current.length === 0) return
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'audio.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!res.ok) throw new Error()
          const { text } = await res.json()
          // If we have a description, put transcription in refine input, otherwise in notes
          if (hasDescription) {
            setRefineInput((prev) => (prev ? prev + ' ' + text : text))
            refineInputRef.current?.focus()
          } else {
            setNotes((prev) => (prev ? prev + '\n' + text : text))
          }
          toast.success('Nota de voz transcrita')
        } catch {
          toast.error('Erro na transcrição')
        } finally {
          setTranscribing(false)
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
  }, [hasDescription])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }, [])

  // ─── Generate new description ───
  const generate = useCallback(async () => {
    setGenerating(true)
    setDescription('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/properties/${propertyId}/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, tone, additional_notes: notes }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('Erro ao gerar')
      await readSSE(res, (text) => setDescription(text))
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error('Erro ao gerar descrição')
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }, [propertyId, language, tone, notes])

  // ─── Refine existing description ───
  const refine = useCallback(async () => {
    if (!refineInput.trim() || !description) return
    setRefining(true)
    const instruction = refineInput.trim()
    setRefineInput('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/properties/${propertyId}/refine-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_description: description, instruction }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('Erro ao refinar')
      setDescription('')
      await readSSE(res, (text) => setDescription(text))
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error('Erro ao refinar descrição')
    } finally {
      setRefining(false)
      abortRef.current = null
    }
  }, [propertyId, description, refineInput])

  const handleUse = () => {
    onUseDescription(description)
    setOpen(false)
    toast.success('Descrição aplicada')
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(description)
    toast.success('Copiado')
  }

  return (
    <>
      {trigger ? (
        <div onClick={() => handleOpenChange(true)} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenChange(true)}
          className="gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Assistente IA
        </Button>
      )}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
          {/* ─── Dark header ─── */}
          <div className="bg-neutral-900 px-6 py-5 rounded-b-2xl shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <SheetHeader className="p-0">
                  <SheetTitle className="text-white text-base font-semibold">
                    Assistente de Descrição
                  </SheetTitle>
                </SheetHeader>
                <p className="text-neutral-400 text-xs mt-0.5">
                  {propertySummary || 'Imóvel'}{detailLines[0] ? ` · ${detailLines[0]}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* ─── Scrollable content ─── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {/* ─── Description preview ─── */}
            {(hasDescription || isBusy) ? (
              <div className="rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Descrição</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="sm"
                      onClick={copyToClipboard}
                      disabled={!description || isBusy}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUse}
                      disabled={!description || isBusy}
                      className="h-7 px-3 text-xs gap-1 bg-neutral-900 text-white hover:bg-neutral-800"
                    >
                      <Check className="h-3 w-3" /> Usar
                    </Button>
                  </div>
                </div>
                <div className="p-4 max-h-[50vh] overflow-y-auto">
                  {description ? (
                    <div
                      className="text-sm text-foreground/80 leading-relaxed prose prose-sm max-w-none [&_strong]:text-foreground [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        __html: description
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br/>'),
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="h-3.5 w-3.5" />
                      {generating ? 'A gerar descrição...' : 'A editar descrição...'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ─── Empty state ─── */
              <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center space-y-3">
                <div className="mx-auto h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Sem descrição</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gere uma descrição nova ou dite as suas notas
                  </p>
                </div>
              </div>
            )}

            {/* ─── Chat input (refine or voice command) ─── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
                <input
                  ref={refineInputRef}
                  type="text"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      refine()
                    }
                  }}
                  placeholder={hasDescription
                    ? 'Diz o que queres alterar...'
                    : 'Descreve o imóvel com as tuas palavras...'
                  }
                  className="flex-1 text-sm bg-transparent border-0 focus:outline-none placeholder:text-muted-foreground/50"
                  disabled={isBusy}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={transcribing || isBusy}
                  className={cn(
                    'h-8 w-8 p-0 shrink-0',
                    recording && 'text-red-500 bg-red-50 hover:bg-red-100 animate-pulse'
                  )}
                >
                  {transcribing ? (
                    <Spinner className="h-4 w-4" />
                  ) : recording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                {hasDescription && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refine}
                    disabled={!refineInput.trim() || isBusy}
                    className="h-8 w-8 p-0 shrink-0"
                  >
                    {refining ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {!hasDescription && refineInput && (
                <p className="text-[10px] text-muted-foreground px-1">
                  As notas acima serão usadas na geração da descrição
                </p>
              )}
            </div>

            {/* ─── Generate section (collapsible when description exists) ─── */}
            {hasDescription ? (
              <div className="space-y-3">
                <button
                  onClick={() => setShowGenOptions(!showGenOptions)}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showGenOptions && 'rotate-180')} />
                  Gerar nova descrição do zero
                </button>

                {showGenOptions && (
                  <div className="space-y-3 pl-5 border-l-2 border-muted/50">
                    {/* Notes */}
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full text-xs bg-muted/30 rounded-lg border border-border/50 p-2.5 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-relaxed placeholder:text-muted-foreground/50"
                      placeholder="Notas adicionais para a geração..."
                    />

                    {/* Language + Tone */}
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex gap-0.5 p-0.5 rounded-full bg-muted/40 border border-border/30">
                        {LANGUAGES.map((l) => (
                          <button
                            key={l.value}
                            onClick={() => setLanguage(l.value)}
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all',
                              language === l.value
                                ? 'bg-neutral-900 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-0.5 p-0.5 rounded-full bg-muted/40 border border-border/30">
                        {TONES.map((t) => (
                          <button
                            key={t.value}
                            onClick={() => setTone(t.value)}
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all',
                              tone === t.value
                                ? 'bg-neutral-900 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={generate}
                      disabled={generating}
                      size="sm"
                      className="w-full gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white"
                    >
                      {generating ? (
                        <><Spinner className="h-3.5 w-3.5" /> A gerar...</>
                      ) : (
                        <><RefreshCw className="h-3.5 w-3.5" /> Gerar nova descrição</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* ─── Full generate controls when no description ─── */
              <div className="space-y-4">
                {/* Property summary */}
                <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    <Building2 className="h-3 w-3" /> Dados do Imóvel
                  </div>
                  <p className="text-xs font-medium">{propertySummary || 'Imóvel'}</p>
                  {detailLines.map((line, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">{line}</p>
                  ))}
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Notas adicionais
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full text-sm bg-muted/30 rounded-xl border border-border/50 p-3 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-relaxed placeholder:text-muted-foreground/50"
                    placeholder="Ex: Último andar com muita luz, armários embutidos, condomínio organizado..."
                  />
                </div>

                {/* Language + Tone */}
                <div className="flex gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Idioma</label>
                    <div className="flex gap-1 p-0.5 rounded-full bg-muted/40 border border-border/30">
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.value}
                          onClick={() => setLanguage(l.value)}
                          className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium transition-all',
                            language === l.value ? 'bg-neutral-900 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >{l.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Tom</label>
                    <div className="flex gap-1 p-0.5 rounded-full bg-muted/40 border border-border/30">
                      {TONES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTone(t.value)}
                          className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium transition-all',
                            tone === t.value ? 'bg-neutral-900 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >{t.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate button */}
                <Button
                  onClick={() => {
                    // If user typed in chat input without description, use it as notes
                    if (refineInput.trim() && !notes) {
                      setNotes(refineInput.trim())
                      setRefineInput('')
                    }
                    generate()
                  }}
                  disabled={generating}
                  className="w-full gap-2 bg-neutral-900 hover:bg-neutral-800 text-white"
                >
                  {generating ? (
                    <><Spinner className="h-4 w-4" /> A gerar...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Gerar Descrição</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
