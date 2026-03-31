'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/kibo-ui/spinner'
import {
  Infinity, Send, Sparkles, Mic, MicOff, Loader2,
  MapPin, BedDouble, Maximize, Euro, ExternalLink, Eye,
  Phone, Mail, User, Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────

interface ToolResult {
  tool: string
  data: any
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  data?: ToolResult[]
}

const SUGGESTIONS = [
  'Quantas leads novas tenho esta semana?',
  'Quais são as minhas tarefas pendentes?',
  'Resume os meus KPIs',
  'Imóveis disponíveis em Lisboa',
]

// ── Card Renderers ────────────────────────────────────────────

function PropertyCard({ p, onNavigate }: { p: any; onNavigate: (path: string) => void }) {
  const coverUrl = p.media?.find((m: any) => m.is_cover)?.url || p.media?.[0]?.url
  const beds = p.specs?.bedrooms
  const area = p.specs?.area_util || p.specs?.area_gross
  const price = p.listing_price
    ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p.listing_price)
    : null

  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      {coverUrl && (
        <div className="h-28 w-full bg-muted overflow-hidden">
          <img src={coverUrl} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-2.5 space-y-1.5">
        <p className="text-xs font-semibold truncate">{p.title}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          {p.city && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{p.city}</span>}
          {beds && <span className="flex items-center gap-0.5"><BedDouble className="h-2.5 w-2.5" />T{beds}</span>}
          {area && <span className="flex items-center gap-0.5"><Maximize className="h-2.5 w-2.5" />{area}m²</span>}
        </div>
        {price && (
          <p className="text-xs font-bold flex items-center gap-0.5">
            <Euro className="h-3 w-3" />{price}
          </p>
        )}
        {/* Action */}
        <Button
          variant="default"
          size="sm"
          className="h-6 text-[10px] rounded-full gap-1 w-full mt-1"
          onClick={() => onNavigate(`/dashboard/imoveis/${p.slug || p.id}`)}
        >
          <Eye className="h-2.5 w-2.5" /> Ver Imóvel
        </Button>
      </div>
    </div>
  )
}

function LeadCard({ l, onNavigate }: { l: any; onNavigate: (path: string) => void }) {
  return (
    <button
      onClick={() => onNavigate(`/dashboard/crm/contactos/${l.id}`)}
      className="w-full text-left rounded-xl border bg-card p-2.5 hover:shadow-md transition-shadow space-y-1"
    >
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
          {(l.nome || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{l.nome}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {l.agent?.commercial_name || 'Sem consultor'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {l.telemovel && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{l.telemovel}</span>}
        {l.email && <span className="flex items-center gap-0.5 truncate"><Mail className="h-2.5 w-2.5" />{l.email}</span>}
      </div>
    </button>
  )
}

function ContactCard({ c, type, onNavigate }: { c: any; type: string; onNavigate: (path: string) => void }) {
  const href = type === 'leads' ? `/dashboard/crm/contactos/${c.id}`
    : type === 'proprietarios' ? `/dashboard/proprietarios/${c.id}`
    : `/dashboard/consultores/${c.id}`
  const name = c.nome || c.name || c.commercial_name || '?'

  return (
    <button
      onClick={() => onNavigate(href)}
      className="w-full text-left rounded-lg border bg-card px-2.5 py-2 hover:bg-muted/30 transition-colors flex items-center gap-2"
    >
      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
        {name[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium truncate">{name}</p>
        <p className="text-[9px] text-muted-foreground truncate">
          {c.email || c.professional_email || c.telemovel || c.phone || ''}
        </p>
      </div>
      <span className="text-[8px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 shrink-0 capitalize">{type === 'leads' ? 'Lead' : type === 'proprietarios' ? 'Proprietário' : 'Consultor'}</span>
    </button>
  )
}

function DataCards({ data, onNavigate }: { data: ToolResult[]; onNavigate: (path: string) => void }) {
  const items: React.ReactNode[] = []

  for (const result of data) {
    const d = result.data
    if (!d) continue

    // Properties
    if (result.tool === 'query_properties' && d.properties?.length > 0) {
      items.push(
        <div key={`props-${items.length}`} className="grid grid-cols-2 gap-2">
          {d.properties.slice(0, 6).map((p: any) => (
            <PropertyCard key={p.id} p={p} onNavigate={onNavigate} />
          ))}
        </div>
      )
    }

    // Leads
    if (result.tool === 'query_leads' && d.leads?.length > 0) {
      items.push(
        <div key={`leads-${items.length}`} className="space-y-1.5">
          {d.leads.slice(0, 6).map((l: any) => (
            <LeadCard key={l.id} l={l} onNavigate={onNavigate} />
          ))}
        </div>
      )
    }

    // Search contacts
    if (result.tool === 'search_contacts') {
      const all = [
        ...(d.leads || []).map((c: any) => ({ ...c, _type: 'leads' })),
        ...(d.proprietarios || []).map((c: any) => ({ ...c, _type: 'proprietarios' })),
        ...(d.consultores || []).map((c: any) => ({ ...c, _type: 'consultores' })),
      ]
      if (all.length > 0) {
        items.push(
          <div key={`contacts-${items.length}`} className="space-y-1">
            {all.slice(0, 8).map((c: any, i: number) => (
              <ContactCard key={`${c._type}-${c.id}-${i}`} c={c} type={c._type} onNavigate={onNavigate} />
            ))}
          </div>
        )
      }
    }
  }

  if (items.length === 0) return null
  return <div className="space-y-2 mt-2">{items}</div>
}

// ── Main Component ────────────────────────────────────────────

export function AiAgentChat() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = scrollContainerRef.current
    if (el) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
    }
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  const handleNavigate = useCallback((path: string) => {
    setOpen(false)
    router.push(path)
  }, [router])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!res.ok) throw new Error()
          const { text } = await res.json()
          if (text) setInput(prev => prev ? `${prev} ${text}` : text)
        } catch { toast.error('Erro ao transcrever áudio') }
        finally { setIsTranscribing(false) }
      }
      recorder.start()
      setIsRecording(true)
    } catch { toast.error('Não foi possível aceder ao microfone') }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) throw new Error()
      const { message, data } = await res.json()

      setMessages(prev => [...prev, { role: 'assistant', content: message, data }])
    } catch {
      toast.error('Erro ao comunicar com o assistente')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted/50 transition-colors"
        >
          <Infinity className="size-4" />
          <span className="sr-only">Assistente IA</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] max-h-[700px] flex flex-col p-0 !rounded-t-3xl">
        {/* Header */}
        <SheetHeader className="shrink-0 px-5 pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-3" />
          <SheetTitle className="text-center text-sm font-medium italic text-muted-foreground">
            Infinitas possibilidades, basta perguntar
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="px-4 pb-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-4 pt-4">
                <div className="text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Infinity className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium">Como posso ajudar?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pergunte sobre leads, imóveis, tarefas, calendário...
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left text-[11px] rounded-xl border p-3 transition-colors hover:bg-muted/50 text-muted-foreground"
                    >
                      <Sparkles className="h-3 w-3 inline-block mr-1.5 opacity-40" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                <div
                  className={cn(
                    'rounded-xl px-3.5 py-2.5 max-w-[85%] animate-in fade-in slide-in-from-top-1 duration-200',
                    msg.role === 'user'
                      ? 'bg-neutral-900 text-white dark:bg-neutral-700 ml-auto'
                      : 'bg-muted/60 mr-auto'
                  )}
                >
                  <div className="text-xs leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
                {/* Interactive cards for tool results */}
                {msg.data && msg.data.length > 0 && (
                  <div className="max-w-[95%] mr-auto">
                    <DataCards data={msg.data} onNavigate={handleNavigate} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2">
                <Spinner variant="infinite" size={12} />
                A pensar...
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t p-3 flex items-end gap-2">
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'outline'}
            size="icon"
            className={cn(
              'h-9 w-9 rounded-full shrink-0',
              isRecording && 'animate-pulse'
            )}
            disabled={loading || isTranscribing}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder={isRecording ? 'A gravar...' : 'Pergunte algo...'}
            rows={1}
            className="rounded-xl text-xs resize-none flex-1 min-h-[36px] max-h-[80px]"
            disabled={loading || isRecording}
          />
          <Button
            size="icon"
            className="rounded-full h-9 w-9 shrink-0"
            disabled={!input.trim() || loading}
            onClick={() => sendMessage(input)}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
