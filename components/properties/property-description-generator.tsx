'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sparkles, Mic, MicOff, Check, RefreshCw, Copy,
  Building2, Send, X,
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
  inline?: boolean
  onClose?: () => void
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
  inline = false,
  onClose,
}: PropertyDescriptionGeneratorProps) {
  const [open, setOpen] = useState(inline)
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
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false)
  const [genPopoverOpen, setGenPopoverOpen] = useState(false)
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

  // When inline, load existing description on mount
  useEffect(() => {
    if (inline && existingDescription && !loadedExisting && !description) {
      setDescription(existingDescription)
      setLoadedExisting(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline])

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
    if (inline) {
      onClose?.()
    } else {
      setOpen(false)
    }
    toast.success('Descrição aplicada')
  }

  const handleCancel = () => {
    if (inline) {
      onClose?.()
    } else {
      setOpen(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(description)
    toast.success('Copiado')
  }

  // ─── Editor body (used inside Sheet OR inline) ───
  const editorBody = (
    <>
      {/* ─── Header ─── */}
      <div className={cn(
        'shrink-0 flex items-center justify-between gap-3',
        inline
          ? 'pb-3 border-b'
          : 'bg-neutral-900 px-6 py-4'
      )}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
            inline
              ? 'bg-primary/10 ring-1 ring-primary/20'
              : 'bg-white/10 ring-1 ring-white/20'
          )}>
            <Sparkles className={cn('h-4 w-4', inline ? 'text-primary' : 'text-white')} />
          </div>
          <div className="min-w-0 flex-1">
            {inline ? (
              <h3 className="text-base font-semibold">Editar Descrição</h3>
            ) : (
              <SheetHeader className="p-0">
                <SheetTitle className="text-white text-base font-semibold">
                  Editar Descrição
                </SheetTitle>
              </SheetHeader>
            )}
            <p className={cn(
              'text-xs mt-0.5 truncate',
              inline ? 'text-muted-foreground' : 'text-neutral-400'
            )}>
              {propertySummary || 'Imóvel'}{detailLines[0] ? ` · ${detailLines[0]}` : ''}
            </p>
          </div>
        </div>
        {inline && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleUse}
              disabled={!description || isBusy}
              className="h-9 w-9 rounded-full p-0 bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm"
              title="Guardar alterações"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="h-9 w-9 rounded-full p-0 bg-muted/60 hover:bg-muted"
              title="Fechar sem guardar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ─── Scrollable content ─── */}
      <div className={cn(
        'flex-1 overflow-y-auto space-y-5',
        inline ? 'py-4' : 'px-6 py-5'
      )}>

            {/* ─── Editable description ─── */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Descrição</span>
                  <span className="text-[10px] text-muted-foreground/60 truncate">
                    {description.length} caracteres
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost" size="sm"
                    onClick={copyToClipboard}
                    disabled={!description || isBusy}
                    className="h-7 px-2 text-[11px] gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>

                  {/* AI Assistant Popover */}
                  <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline" size="sm"
                        className="h-7 px-2 text-[11px] gap-1 border-primary/30"
                      >
                        <Sparkles className="h-3 w-3 text-primary" />
                        Assistente IA
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-96 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold">Assistente IA</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {hasDescription ? 'Pede para editar a descrição' : 'Descreve o imóvel para gerar'}
                      </p>
                      <div className="rounded-lg border bg-background overflow-hidden">
                        <textarea
                          ref={refineInputRef as any}
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault()
                              if (hasDescription) refine()
                              else {
                                if (!notes) setNotes(refineInput.trim())
                                generate()
                              }
                            }
                          }}
                          placeholder={hasDescription
                            ? 'Ex: torna mais formal · trata por tu · acrescenta secção sobre a vista...'
                            : 'Ex: 3 quartos com vista mar, totalmente remodelado em 2024...'
                          }
                          rows={4}
                          className="w-full text-xs bg-transparent border-0 focus:outline-none placeholder:text-muted-foreground/40 px-3 py-2 resize-none"
                          disabled={isBusy}
                          autoFocus
                        />
                        <div className="flex items-center justify-between px-2.5 py-1.5 border-t bg-muted/20">
                          <span className="text-[9px] text-muted-foreground">⌘+Enter</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={recording ? stopRecording : startRecording}
                              disabled={transcribing || isBusy}
                              className={cn(
                                'h-6 px-2 text-[11px] gap-1',
                                recording && 'text-red-500 bg-red-50 hover:bg-red-100 animate-pulse'
                              )}
                            >
                              {transcribing ? <Spinner className="h-3 w-3" /> : recording ? <><MicOff className="h-3 w-3" /> Parar</> : <><Mic className="h-3 w-3" /> Voz</>}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (hasDescription) refine()
                                else {
                                  if (!notes) setNotes(refineInput.trim())
                                  generate()
                                }
                              }}
                              disabled={!refineInput.trim() || isBusy}
                              className="h-6 px-2.5 text-[11px] gap-1 bg-neutral-900 text-white hover:bg-neutral-800"
                            >
                              {refining || generating ? (
                                <><Spinner className="h-3 w-3" /> {hasDescription ? 'A editar...' : 'A gerar...'}</>
                              ) : (
                                <><Send className="h-3 w-3" /> {hasDescription ? 'Editar' : 'Gerar'}</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Generate from scratch Popover */}
                  <Popover open={genPopoverOpen} onOpenChange={setGenPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline" size="sm"
                        className="h-7 px-2 text-[11px] gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Gerar do zero
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-96 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        <span className="text-xs font-semibold">Gerar nova descrição</span>
                      </div>

                      {/* Property summary */}
                      <div className="rounded-lg border bg-muted/20 p-2.5 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                          <Building2 className="h-3 w-3" /> Dados do Imóvel
                        </div>
                        <p className="text-xs font-medium">{propertySummary || 'Imóvel'}</p>
                        {detailLines.map((line, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground">{line}</p>
                        ))}
                      </div>

                      {/* Notes */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                          Notas adicionais
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className="w-full text-xs bg-muted/30 rounded-lg border border-border/50 p-2 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-relaxed placeholder:text-muted-foreground/50"
                          placeholder="Ex: Último andar com muita luz, armários embutidos..."
                        />
                      </div>

                      {/* Language + Tone */}
                      <div className="flex gap-3 flex-wrap">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Idioma</label>
                          <div className="flex gap-0.5 p-0.5 rounded-full bg-muted/40 border border-border/30 w-fit">
                            {LANGUAGES.map((l) => (
                              <button
                                key={l.value}
                                onClick={() => setLanguage(l.value)}
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] font-medium transition-all',
                                  language === l.value
                                    ? 'bg-neutral-900 text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >{l.label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Tom</label>
                          <div className="flex gap-0.5 p-0.5 rounded-full bg-muted/40 border border-border/30 w-fit">
                            {TONES.map((t) => (
                              <button
                                key={t.value}
                                onClick={() => setTone(t.value)}
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] font-medium transition-all',
                                  tone === t.value
                                    ? 'bg-neutral-900 text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >{t.label}</button>
                            ))}
                          </div>
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
                          <><RefreshCw className="h-3.5 w-3.5" /> Gerar descrição</>
                        )}
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isBusy}
                  rows={16}
                  placeholder={isBusy ? '' : 'Escreve a descrição aqui ou usa os botões acima para gerar/editar com IA...'}
                  className="w-full text-sm text-foreground leading-relaxed p-4 bg-transparent resize-y focus:outline-none focus:ring-0 placeholder:text-muted-foreground/40 disabled:opacity-60 min-h-[280px] max-h-[60vh]"
                />
                {isBusy && !description && (
                  <div className="absolute inset-0 flex items-center gap-2 text-sm text-muted-foreground p-4 pointer-events-none">
                    <Spinner className="h-3.5 w-3.5" />
                    {generating ? 'A gerar descrição...' : 'A editar com IA...'}
                  </div>
                )}
              </div>
              <div className="px-4 py-1.5 border-t bg-muted/10">
                <span className="text-[10px] text-muted-foreground/70">
                  Usa <code className="text-[10px] px-1 py-0.5 rounded bg-muted/40 font-mono">**texto**</code> para negrito
                </span>
              </div>
            </div>
          </div>

      {/* ─── Sticky save bar (sheet mode only) ─── */}
      {!inline && (
        <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-background/95 backdrop-blur-sm px-6 py-3">
          <span className="text-[11px] text-muted-foreground">
            {hasDescription ? 'Alterações não guardadas' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-9 px-4 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleUse}
              disabled={!description || isBusy}
              className="h-9 px-5 text-xs gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Check className="h-3.5 w-3.5" /> Guardar
            </Button>
          </div>
        </div>
      )}
    </>
  )

  // ─── Inline rendering ───
  if (inline) {
    return (
      <div className="flex flex-col h-full">
        {editorBody}
      </div>
    )
  }

  // ─── Sheet rendering (default) ───
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
          Editar descrição
        </Button>
      )}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
          {editorBody}
        </SheetContent>
      </Sheet>
    </>
  )
}
