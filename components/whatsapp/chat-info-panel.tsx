'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Archive, VolumeX, Image as ImageIcon, FileText, Link2, Users, Shield, MessageSquare, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ErpLinkTags } from './erp-link-tags'
import { ContactLinkDialog } from './contact-link-dialog'
import type { WppChat } from '@/lib/types/whatsapp-web'

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

export function ChatInfoPanel({ chatId, instanceId, onClose, onChatSelect }: ChatInfoPanelProps) {
  const [chat, setChat] = useState<WppChat | null>(null)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [docs, setDocs] = useState<MediaItem[]>([])
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [erpKey, setErpKey] = useState(0)
  const [participants, setParticipants] = useState<GroupParticipant[]>([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)

  useEffect(() => {
    // Fetch chat
    fetch(`/api/whatsapp/chats?chat_id=${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.chat) setChat(data.chat)
      })
      .catch(() => {})

    // Fetch media
    fetch(`/api/whatsapp/chats/${chatId}/media?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        const items = (data.media || []) as MediaItem[]
        setMedia(items.filter((m) => m.message_type === 'image' || m.message_type === 'video'))
        setDocs(items.filter((m) => m.message_type === 'document'))
      })
      .catch(() => {})
  }, [chatId, instanceId])

  // Fetch group participants when it's a group
  useEffect(() => {
    if (!chat?.is_group || !chat?.wa_chat_id) return

    setLoadingParticipants(true)
    fetch(`/api/whatsapp/groups/${encodeURIComponent(chat.wa_chat_id)}?instance_id=${instanceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.participants) {
          // Sort: admins first, then alphabetically
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

  const handleLinked = useCallback(() => {
    fetch(`/api/whatsapp/chats?chat_id=${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.chat) setChat(data.chat)
      })
      .catch(() => {})
    setErpKey((k) => k + 1)
  }, [chatId])

  const handleOpenParticipantChat = useCallback(async (participant: GroupParticipant) => {
    if (!onChatSelect || !participant.phone) return
    // Find existing chat with this participant
    try {
      const res = await fetch(`/api/whatsapp/chats?instance_id=${instanceId}&phone=${participant.phone}`)
      const data = await res.json()
      if (data.chats?.[0]?.id) {
        onChatSelect(data.chats[0].id)
      }
    } catch {
      // silently fail
    }
  }, [instanceId, onChatSelect])

  const displayName = chat?.name || chat?.phone || 'Conversa'
  const picUrl = chat?.contact?.profile_pic_url || chat?.profile_pic_url || chat?.image
  const phone = chat?.phone || chat?.contact?.phone
  const isGroup = chat?.is_group

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

      <Separator />

      {/* Group Participants */}
      {isGroup && (
        <>
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
                        <span className="text-sm font-medium truncate">
                          {p.displayName || p.phone}
                        </span>
                        {(p.isAdmin || p.isSuperAdmin) && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
                            <Shield className="h-2.5 w-2.5 mr-0.5" />
                            Admin
                          </Badge>
                        )}
                      </div>
                      {p.phone && (
                        <span className="text-xs text-muted-foreground">{p.phone}</span>
                      )}
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
        </>
      )}

      {/* ERP Link (only for non-group chats) */}
      {!isGroup && (
        <>
          <div className="px-4 py-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              Vinculacao ERP
            </h4>
            {chat?.contact && (chat.contact.owner_id || chat.contact.lead_id) ? (
              <ErpLinkTags key={erpKey} contactId={chat.contact.id} />
            ) : (
              <p className="text-sm text-muted-foreground mb-2">
                Contacto sem vinculacao ERP
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setLinkDialogOpen(true)}
              disabled={!chat?.contact}
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              {chat?.contact?.owner_id || chat?.contact?.lead_id
                ? 'Alterar vinculacao'
                : 'Vincular a Owner/Lead'}
            </Button>
          </div>
          <Separator />
        </>
      )}

      {/* Link Dialog */}
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

      {/* Media Gallery */}
      <div className="px-4 py-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" />
          Media ({media.length})
        </h4>
        {media.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {media.slice(0, 9).map((m) => (
              <a
                key={m.id}
                href={m.media_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded overflow-hidden bg-muted"
              >
                <img
                  src={m.media_url || ''}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem media</p>
        )}
      </div>

      <Separator />

      {/* Documents */}
      <div className="px-4 py-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Documentos ({docs.length})
        </h4>
        {docs.length > 0 ? (
          <div className="space-y-1.5">
            {docs.slice(0, 5).map((d) => (
              <a
                key={d.id}
                href={d.media_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{d.media_file_name || 'Documento'}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem documentos</p>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="px-4 py-3 space-y-1">
        <Button variant="ghost" className="w-full justify-start h-9 text-sm">
          <VolumeX className="mr-2 h-4 w-4" />
          Silenciar
        </Button>
        <Button variant="ghost" className="w-full justify-start h-9 text-sm">
          <Archive className="mr-2 h-4 w-4" />
          Arquivar
        </Button>
      </div>
    </div>
  )
}
