'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Archive, VolumeX, Image as ImageIcon, FileText, Link2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ErpLinkTags } from './erp-link-tags'
import { ContactLinkDialog } from './contact-link-dialog'
import type { WppChat } from '@/lib/types/whatsapp-web'

interface ChatInfoPanelProps {
  chatId: string
  instanceId: string
  onClose: () => void
}

interface MediaItem {
  id: string
  message_type: string
  media_url: string | null
  media_file_name: string | null
  media_file_size: number | null
  timestamp: number
}

export function ChatInfoPanel({ chatId, instanceId, onClose }: ChatInfoPanelProps) {
  const [chat, setChat] = useState<WppChat | null>(null)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [docs, setDocs] = useState<MediaItem[]>([])
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [erpKey, setErpKey] = useState(0)

  useEffect(() => {
    // Fetch chat
    fetch(`/api/whatsapp/chats?instance_id=${instanceId}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.chats?.find((c: WppChat) => c.id === chatId)
        if (found) setChat(found)
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

  const handleLinked = useCallback(() => {
    // Re-fetch chat to update contact data + refresh ErpLinkTags
    fetch(`/api/whatsapp/chats?instance_id=${instanceId}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.chats?.find((c: WppChat) => c.id === chatId)
        if (found) setChat(found)
      })
      .catch(() => {})
    setErpKey((k) => k + 1)
  }, [chatId, instanceId])

  const displayName = chat?.name || chat?.phone || 'Conversa'
  const picUrl = chat?.contact?.profile_pic_url || chat?.profile_pic_url
  const phone = chat?.phone || chat?.contact?.phone

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-semibold">Informação do contacto</span>
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
        {phone && <p className="text-sm text-muted-foreground mt-0.5">{phone}</p>}
      </div>

      <Separator />

      {/* ERP Link */}
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
