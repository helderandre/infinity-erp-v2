'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Archive, VolumeX, Image as ImageIcon, FileText, Link2, Users, Shield, MessageSquare, Loader2, UserPlus, Handshake, ChevronDown, Briefcase, Phone, Mail, MapPin, Tag, Thermometer, ShoppingCart, Store, Key, Building2, BedDouble, ChevronRight, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { LeadForm } from '@/components/leads/lead-form'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { CreatePartnerDialog } from './create-partner-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErpLinkTags } from './erp-link-tags'
import { ContactLinkDialog } from './contact-link-dialog'
import type { WppChat } from '@/lib/types/whatsapp-web'
import { createClient } from '@/lib/supabase/client'

interface ChatInfoPanelProps {
  chatId: string
  instanceId: string
  onClose: () => void
  onChatSelect?: (chatId: string) => void
}

interface MediaItem {
  id: string
  message_type: string
  media_url: string | null
  media_file_name: string | null
  media_file_size: number | null
  timestamp: number
}

interface GroupParticipant {
  jid: string
  lid: string
  phone: string
  displayName: string
  isAdmin: boolean
  isSuperAdmin: boolean
  profilePicUrl: string | null
  contactId: string | null
  ownerId: string | null
  leadId: string | null
}

interface LeadData {
  id: string
  nome: string
  email: string | null
  telemovel: string | null
  estado: string | null
  temperatura: string | null
  lead_type: string | null
  observacoes: string | null
  tags: string[]
  localidade: string | null
  concelho: string | null
  distrito: string | null
}

interface NegocioData {
  id: string
  tipo: string | null
  estado: string | null
  temperatura: string | null
  tipo_imovel: string | null
  quartos: number | null
  quartos_min: number | null
  localizacao: string | null
  concelho: string | null
  distrito: string | null
  orcamento: number | null
  orcamento_max: number | null
  preco_venda: number | null
  renda_pretendida: number | null
  renda_max_mensal: number | null
  expected_close_date: string | null
  created_at: string
  probability_pct: number | null
  leads_pipeline_stages?: {
    id: string
    name: string
    color: string
    order_index: number | null
    is_terminal: boolean
    terminal_type: string | null
  } | null
}

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  novo: { label: 'Novo', color: 'bg-sky-100 text-sky-800' },
  em_curso: { label: 'Em curso', color: 'bg-blue-100 text-blue-800' },
  qualificado: { label: 'Qualificado', color: 'bg-emerald-100 text-emerald-800' },
  proposta: { label: 'Proposta', color: 'bg-violet-100 text-violet-800' },
  negociacao: { label: 'Negociação', color: 'bg-amber-100 text-amber-800' },
  ganho: { label: 'Ganho', color: 'bg-green-100 text-green-800' },
  perdido: { label: 'Perdido', color: 'bg-red-100 text-red-800' },
  arquivado: { label: 'Arquivado', color: 'bg-slate-100 text-slate-800' },
}

const TEMPERATURA_LABELS: Record<string, { label: string; color: string }> = {
  frio: { label: 'Frio', color: 'bg-blue-100 text-blue-700' },
  morno: { label: 'Morno', color: 'bg-amber-100 text-amber-700' },
  quente: { label: 'Quente', color: 'bg-orange-100 text-orange-700' },
  muito_quente: { label: 'Muito quente', color: 'bg-red-100 text-red-700' },
}

const TIPO_ICONS: Record<string, typeof ShoppingCart> = {
  'Compra': ShoppingCart,
  'Venda': Store,
  'Arrendatário': Key,
  'Arrendador': Building2,
}

const TIPO_COLORS: Record<string, string> = {
  'Compra': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Venda': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Arrendatário': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'Arrendador': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
}

export function ChatInfoPanel({ chatId, instanceId, onClose, onChatSelect }: ChatInfoPanelProps) {
  const router = useRouter()
  const [chat, setChat] = useState<WppChat | null>(null)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [docs, setDocs] = useState<MediaItem[]>([])
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [createLeadOpen, setCreateLeadOpen] = useState(false)
  const [createPartnerOpen, setCreatePartnerOpen] = useState(false)
  const [erpKey, setErpKey] = useState(0)
  const [participants, setParticipants] = useState<GroupParticipant[]>([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  // CRM tab state
  const [leadData, setLeadData] = useState<LeadData | null>(null)
  const [negocios, setNegocios] = useState<NegocioData[]>([])
  const [loadingCrm, setLoadingCrm] = useState(false)
  // Lead form state (for creating contact + negocio from chat)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [aiTranscript, setAiTranscript] = useState('')

  // Fetch consultants + recent messages when "Criar Lead" dialog opens
  useEffect(() => {
    if (!createLeadOpen) return

    fetch('/api/users/consultants')
      .then((r) => r.json())
      .then((d) => setConsultants(
        (d.data || d || []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          commercial_name: c.commercial_name as string,
        }))
      ))
      .catch(() => {})

    // Build a transcript from the last 20 messages of this chat to feed the AI extractor
    fetch(`/api/whatsapp/chats/${chatId}/messages?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        const msgs = (data.messages || []) as Array<{ from_me: boolean; sender_name: string | null; text: string | null; message_type: string }>
        const lines = msgs
          .filter((m) => m.text?.trim() || m.message_type !== 'text')
          .map((m) => {
            const who = m.from_me ? 'Agente' : (m.sender_name || 'Contacto')
            const body = m.text?.trim() || `[${m.message_type}]`
            return `${who}: ${body}`
          })
        setAiTranscript(lines.join('\n'))
      })
      .catch(() => {})
  }, [createLeadOpen, chatId])

  useEffect(() => {
    fetch(`/api/whatsapp/chats?chat_id=${chatId}`)
      .then((r) => r.json())
      .then((data) => { if (data.chat) setChat(data.chat) })
      .catch(() => {})

    fetch(`/api/whatsapp/chats/${chatId}/media?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        const items = (data.media || []) as MediaItem[]
        setMedia(items.filter((m) => m.message_type === 'image' || m.message_type === 'video'))
        setDocs(items.filter((m) => m.message_type === 'document'))
      })
      .catch(() => {})
  }, [chatId, instanceId])

  // Fetch group participants
  useEffect(() => {
    if (!chat?.is_group || !chat?.wa_chat_id) return
    setLoadingParticipants(true)
    fetch(`/api/whatsapp/groups/${encodeURIComponent(chat.wa_chat_id)}?instance_id=${instanceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.participants) {
          const sorted = [...data.participants].sort((a: GroupParticipant, b: GroupParticipant) => {
            if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1
            return (a.displayName || '').localeCompare(b.displayName || '')
          })
          setParticipants(sorted)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingParticipants(false))
  }, [chat?.is_group, chat?.wa_chat_id, instanceId])

  // Fetch CRM data when a contact is linked. Uses the erp-data endpoint so
  // queries run through the service role (bypassing RLS that blocks the
  // browser client from reading leads/negocios).
  useEffect(() => {
    const contactDbId = chat?.contact?.id
    const hasLink = !!(chat?.contact?.lead_id || chat?.contact?.owner_id)
    if (!contactDbId || !hasLink) {
      setLeadData(null)
      setNegocios([])
      return
    }

    setLoadingCrm(true)
    fetch(`/api/whatsapp/contacts/${contactDbId}/erp-data`)
      .then((r) => r.json())
      .then((data) => {
        if (data.lead) {
          // Map the API shape to LeadData (PT column aliases)
          setLeadData({
            id: data.lead.id,
            nome: data.lead.name,
            email: data.lead.email,
            telemovel: data.lead.phone_primary,
            estado: data.lead.status,
            temperatura: data.lead.priority,
            lead_type: data.lead.lead_type,
            observacoes: data.lead.observacoes,
            tags: data.lead.tags || [],
            localidade: data.lead.localidade,
            concelho: data.lead.concelho,
            distrito: data.lead.distrito,
          })
          setNegocios(data.lead.negocios || [])
        } else {
          setLeadData(null)
          setNegocios([])
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCrm(false))
  }, [chat?.contact?.id, chat?.contact?.lead_id, chat?.contact?.owner_id])

  const handleLinked = useCallback(() => {
    fetch(`/api/whatsapp/chats?chat_id=${chatId}`)
      .then((r) => r.json())
      .then((data) => { if (data.chat) setChat(data.chat) })
      .catch(() => {})
    setErpKey((k) => k + 1)
  }, [chatId])

  const handleOpenParticipantChat = useCallback(async (participant: GroupParticipant) => {
    if (!onChatSelect || !participant.phone) return
    try {
      const res = await fetch(`/api/whatsapp/chats?instance_id=${instanceId}&phone=${participant.phone}`)
      const data = await res.json()
      if (data.chats?.[0]?.id) onChatSelect(data.chats[0].id)
    } catch {}
  }, [instanceId, onChatSelect])

  const displayName = chat?.name || chat?.phone || 'Conversa'
  const picUrl = chat?.contact?.profile_pic_url || chat?.profile_pic_url || chat?.image
  const phone = chat?.phone || chat?.contact?.phone
  const isGroup = chat?.is_group
  const hasLead = !!chat?.contact?.lead_id

  function formatPrice(price: number | null): string {
    if (!price) return '-'
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
        <span className="text-sm font-semibold">
          {isGroup ? 'Informação do grupo' : 'Informação do contacto'}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center py-6 px-4">
        <Avatar className="h-20 w-20 mb-3">
          {picUrl && <AvatarImage src={picUrl} alt={displayName} />}
          <AvatarFallback className="text-2xl">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h3 className="text-base font-semibold">{displayName}</h3>
        {phone && !isGroup && <p className="text-sm text-muted-foreground mt-0.5">{phone}</p>}
        {isGroup && participants.length > 0 && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Grupo · {participants.length} participantes
          </p>
        )}
      </div>

      {/* Tabs for non-group chats, or just content for groups */}
      {isGroup ? (
        <>
          <Separator />
          {/* Group Participants */}
          <div className="px-4 py-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Participantes ({participants.length})
            </h4>
            {loadingParticipants ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-0.5 max-h-[300px] overflow-y-auto -mx-1">
                {participants.map((p) => (
                  <button
                    key={p.jid || p.lid}
                    type="button"
                    onClick={() => handleOpenParticipantChat(p)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      {p.profilePicUrl && <AvatarImage src={p.profilePicUrl} />}
                      <AvatarFallback className="text-xs">
                        {(p.displayName || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium truncate">{p.displayName || p.phone}</span>
                        {(p.isAdmin || p.isSuperAdmin) && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
                            <Shield className="h-2.5 w-2.5 mr-0.5" />Admin
                          </Badge>
                        )}
                      </div>
                      {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                    </div>
                    {onChatSelect && p.phone && (
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Separator />
          {/* Media + Docs for groups */}
          <div className="px-4 py-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />Media ({media.length})
            </h4>
            {media.length > 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {media.filter((m) => m.media_url).slice(0, 9).map((m) => (
                  <a key={m.id} href={m.media_url!} target="_blank" rel="noopener noreferrer" className="aspect-square rounded overflow-hidden bg-muted">
                    <img src={m.media_url!} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Sem media</p>}
          </div>
        </>
      ) : (
        <>
          <div className="px-2">
            <Tabs defaultValue={hasLead ? 'crm' : 'whatsapp'}>
              <TabsList className="w-full h-8">
                <TabsTrigger value="whatsapp" className="flex-1 text-xs">WhatsApp</TabsTrigger>
                <TabsTrigger value="crm" className="flex-1 text-xs">CRM</TabsTrigger>
              </TabsList>

              {/* WhatsApp Tab */}
              <TabsContent value="whatsapp" className="mt-3 space-y-0">
                {/* ERP Link */}
                <div className="px-2 pb-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />Vinculação ERP
                  </h4>
                  {chat?.contact && (chat.contact.owner_id || chat.contact.lead_id) ? (
                    <ErpLinkTags key={erpKey} contactId={chat.contact.id} />
                  ) : (
                    <p className="text-sm text-muted-foreground mb-2">Contacto sem vinculação ERP</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setLinkDialogOpen(true)} disabled={!chat?.contact}>
                      <Link2 className="h-3.5 w-3.5 mr-1.5" />
                      {chat?.contact?.owner_id || chat?.contact?.lead_id ? 'Alterar' : 'Vincular'}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          <UserPlus className="h-3.5 w-3.5 mr-1.5" />Criar
                          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setCreateLeadOpen(true)}>
                          <UserPlus className="h-3.5 w-3.5 mr-2" />Criar Lead
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setCreatePartnerOpen(true)}>
                          <Handshake className="h-3.5 w-3.5 mr-2" />Criar Parceiro
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <Separator />

                {/* Media Gallery */}
                <div className="px-2 py-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />Media ({media.length})
                  </h4>
                  {media.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1">
                      {media.filter((m) => m.media_url).slice(0, 9).map((m) => (
                        <a key={m.id} href={m.media_url!} target="_blank" rel="noopener noreferrer" className="aspect-square rounded overflow-hidden bg-muted">
                          <img src={m.media_url!} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Sem media</p>}
                </div>

                <Separator />

                {/* Documents */}
                <div className="px-2 py-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />Documentos ({docs.length})
                  </h4>
                  {docs.length > 0 ? (
                    <div className="space-y-1.5">
                      {docs.slice(0, 5).map((d) => (
                        <a key={d.id} href={d.media_url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{d.media_file_name || 'Documento'}</span>
                        </a>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Sem documentos</p>}
                </div>

                <Separator />

                {/* Actions */}
                <div className="px-2 py-3 space-y-1">
                  <Button variant="ghost" className="w-full justify-start h-9 text-sm">
                    <VolumeX className="mr-2 h-4 w-4" />Silenciar
                  </Button>
                  <Button variant="ghost" className="w-full justify-start h-9 text-sm">
                    <Archive className="mr-2 h-4 w-4" />Arquivar
                  </Button>
                </div>
              </TabsContent>

              {/* CRM Tab */}
              <TabsContent value="crm" className="mt-3 space-y-0">
                {loadingCrm ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !leadData ? (
                  <div className="text-center py-8 px-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Contacto sem vinculação ao CRM
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setCreateLeadOpen(true)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />Criar contacto
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Lead Info */}
                    <div className="px-2 pb-3 space-y-2.5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                        Dados do contacto
                      </h4>

                      <div className="space-y-2">
                        {leadData.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{leadData.email}</span>
                          </div>
                        )}
                        {leadData.telemovel && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span>{leadData.telemovel}</span>
                          </div>
                        )}
                        {(leadData.localidade || leadData.concelho || leadData.distrito) && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">
                              {[leadData.localidade, leadData.concelho, leadData.distrito].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Status badges */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {leadData.estado && ESTADO_LABELS[leadData.estado] && (
                          <Badge variant="secondary" className={`text-[10px] ${ESTADO_LABELS[leadData.estado].color}`}>
                            {ESTADO_LABELS[leadData.estado].label}
                          </Badge>
                        )}
                        {leadData.temperatura && TEMPERATURA_LABELS[leadData.temperatura] && (
                          <Badge variant="secondary" className={`text-[10px] ${TEMPERATURA_LABELS[leadData.temperatura].color}`}>
                            <Thermometer className="h-2.5 w-2.5 mr-0.5" />
                            {TEMPERATURA_LABELS[leadData.temperatura].label}
                          </Badge>
                        )}
                        {leadData.lead_type && (
                          <Badge variant="outline" className="text-[10px]">
                            {leadData.lead_type}
                          </Badge>
                        )}
                      </div>

                      {/* Tags */}
                      {leadData.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {leadData.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                              <Tag className="h-2.5 w-2.5 mr-0.5" />{tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {leadData.observacoes && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground font-medium mb-1">Observações</p>
                          <p className="text-sm text-muted-foreground line-clamp-3">{leadData.observacoes}</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Negócios — cards mirrored from /dashboard/leads/[id] */}
                    <div className="px-2 py-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" />
                        Negócios ({negocios.length})
                      </h4>
                      {negocios.length > 0 ? (
                        <div className="space-y-3">
                          {negocios.map((neg, idx) => {
                            const TIPO_TAG: Record<string, { color: string; label: string }> = {
                              'Compra':         { color: '#3b82f6', label: 'Compra' },
                              'Venda':          { color: '#10b981', label: 'Venda' },
                              'Compra e Venda': { color: '#8b5cf6', label: 'C+V' },
                              'Arrendatário':   { color: '#f59e0b', label: 'Arrendat.' },
                              'Arrendador':     { color: '#fb923c', label: 'Senhorio' },
                            }
                            const tipoTag = neg.tipo ? (TIPO_TAG[neg.tipo] || { color: '#64748b', label: neg.tipo }) : null

                            const TEMP_TAG: Record<string, { color: string; emoji: string; label: string }> = {
                              'Frio':   { color: '#3b82f6', emoji: '❄️', label: 'Frio' },
                              'Morno':  { color: '#f59e0b', emoji: '🌤️', label: 'Morno' },
                              'Quente': { color: '#ef4444', emoji: '🔥', label: 'Quente' },
                            }
                            const tempTag = neg.temperatura ? TEMP_TAG[neg.temperatura] : null

                            const stage = neg.leads_pipeline_stages
                            const stageName = stage?.name || neg.estado || 'Contactado'
                            const stageColor = stage?.color || '#64748b'

                            // Derive status (Aberto / Ganho / Perdido) from pipeline terminal flags
                            const status = (() => {
                              if (stage?.is_terminal) {
                                if (stage.terminal_type === 'won') return { label: 'Ganho', color: '#10b981' }
                                if (stage.terminal_type === 'lost') return { label: 'Perdido', color: '#ef4444' }
                                return { label: stageName, color: stageColor }
                              }
                              return { label: 'Aberto', color: '#0ea5e9' }
                            })()

                            return (
                              <button
                                key={neg.id}
                                type="button"
                                onClick={() => router.push(`/dashboard/leads/${leadData?.id}/negocios/${neg.id}`)}
                                className="group relative w-full text-left rounded-2xl border-2 border-border bg-card cursor-pointer p-4 transition-all duration-300 hover:shadow-md hover:border-foreground/20 animate-in fade-in slide-in-from-bottom-2"
                                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
                              >
                                {/* Row 1: tipo + temperatura + status (Aberto/Ganho/Perdido) */}
                                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                  {tipoTag && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1"
                                      style={{
                                        backgroundColor: `${tipoTag.color}26`,
                                        color: tipoTag.color,
                                        ['--tw-ring-color' as any]: `${tipoTag.color}55`,
                                      }}
                                    >
                                      <Briefcase className="h-3 w-3" />
                                      {tipoTag.label}
                                    </span>
                                  )}
                                  {tempTag && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1"
                                      style={{
                                        backgroundColor: `${tempTag.color}26`,
                                        color: tempTag.color,
                                        ['--tw-ring-color' as any]: `${tempTag.color}55`,
                                      }}
                                    >
                                      <span aria-hidden className="text-[10px] leading-none">{tempTag.emoji}</span>
                                      {tempTag.label}
                                    </span>
                                  )}
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1"
                                    style={{
                                      backgroundColor: `${status.color}26`,
                                      color: status.color,
                                      ['--tw-ring-color' as any]: `${status.color}55`,
                                    }}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                                    {status.label}
                                  </span>
                                </div>

                                {/* Row 2: fase (pipeline stage) with progress */}
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fase</span>
                                  <span
                                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                    style={{
                                      backgroundColor: `${stageColor}18`,
                                      color: stageColor,
                                    }}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageColor }} />
                                    {stageName}
                                  </span>
                                  {typeof neg.probability_pct === 'number' && (
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                      {neg.probability_pct}%
                                    </span>
                                  )}
                                </div>

                                {/* Middle: criteria pills */}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {!!neg.tipo_imovel && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 text-foreground px-2.5 py-1 rounded-full">
                                      {neg.tipo_imovel}
                                    </span>
                                  )}
                                  {!!neg.quartos_min && (
                                    <span className="text-[10px] font-medium bg-muted/60 text-foreground px-2.5 py-1 rounded-full">T{neg.quartos_min}+</span>
                                  )}
                                  {!!neg.localizacao && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 text-foreground px-2.5 py-1 rounded-full truncate max-w-[160px]">
                                      {neg.localizacao}
                                    </span>
                                  )}
                                  {!neg.tipo_imovel && !neg.quartos_min && !neg.localizacao && (
                                    <span className="text-[10px] text-muted-foreground italic">Sem critérios definidos</span>
                                  )}
                                </div>

                                {/* Bottom: value */}
                                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {!!neg.orcamento && (
                                      <span className="text-sm font-bold text-foreground">{formatPrice(neg.orcamento)}</span>
                                    )}
                                    {!!neg.orcamento_max && neg.orcamento_max !== neg.orcamento && (
                                      <>
                                        {!!neg.orcamento && <span className="text-xs text-muted-foreground">–</span>}
                                        <span className="text-sm font-bold text-foreground">{formatPrice(neg.orcamento_max)}</span>
                                      </>
                                    )}
                                    {!!neg.preco_venda && (
                                      <span className="text-sm font-bold text-emerald-600">{formatPrice(neg.preco_venda)}</span>
                                    )}
                                    {!!neg.renda_pretendida && (
                                      <span className="text-sm font-bold text-foreground">{formatPrice(neg.renda_pretendida)}<span className="text-xs text-muted-foreground font-normal">/mês</span></span>
                                    )}
                                    {!!neg.renda_max_mensal && !neg.renda_pretendida && (
                                      <span className="text-sm font-bold text-foreground">até {formatPrice(neg.renda_max_mensal)}<span className="text-xs text-muted-foreground font-normal">/mês</span></span>
                                    )}
                                    {!neg.orcamento && !neg.orcamento_max && !neg.preco_venda && !neg.renda_pretendida && !neg.renda_max_mensal && (
                                      <span className="text-xs text-muted-foreground italic">Sem valor definido</span>
                                    )}
                                  </div>
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem negócios</p>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}

      {/* Dialogs - always rendered */}
      {chat?.contact && (
        <ContactLinkDialog
          contactId={chat.contact.id}
          instanceId={instanceId}
          currentOwnerId={chat.contact.owner_id}
          currentLeadId={chat.contact.lead_id}
          onLinked={handleLinked}
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
        />
      )}
      {/* Create contacto + negócio (same form as /dashboard/leads "Novo Contacto") */}
      <Dialog open={createLeadOpen} onOpenChange={setCreateLeadOpen}>
        <DialogContent
          className="sm:max-w-md !rounded-2xl !p-0 !gap-0 !ring-0 overflow-hidden max-h-[90vh] overflow-y-auto"
          showCloseButton={false}
        >
          <VisuallyHidden><DialogTitle>Novo Contacto</DialogTitle></VisuallyHidden>
          <LeadForm
            consultants={consultants}
            initialValues={{
              nome: displayName !== 'Conversa' ? displayName : '',
              // Strip PT country code so the mask (which already shows +351) doesn't duplicate it
              telemovel: (() => {
                const digits = (phone || '').replace(/\D/g, '')
                if (digits.startsWith('351') && digits.length > 9) return digits.slice(3)
                return digits
              })(),
            }}
            autoExtractText={aiTranscript}
            onSuccess={async (newLeadId) => {
              setCreateLeadOpen(false)
              // Link the wpp_contact to the newly created lead, then refresh
              if (chat?.contact?.id && newLeadId) {
                try {
                  await fetch(`/api/whatsapp/contacts/${chat.contact.id}/link`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lead_id: newLeadId }),
                  })
                } catch {
                  // non-fatal — auto-match will catch it on next sync
                }
              }
              handleLinked()
            }}
            onCancel={() => setCreateLeadOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <CreatePartnerDialog
        open={createPartnerOpen}
        onOpenChange={setCreatePartnerOpen}
        defaultName={displayName !== 'Conversa' ? displayName : ''}
        defaultPhone={phone || ''}
        onComplete={() => handleLinked()}
      />
    </div>
  )
}
