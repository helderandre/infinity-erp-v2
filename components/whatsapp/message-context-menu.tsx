'use client'

import { ChevronDown, Reply, Forward, Copy, Trash2, CheckSquare, FolderDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { WppMessage } from '@/lib/types/whatsapp-web'
import { toast } from 'sonner'

interface MessageContextMenuProps {
  message: WppMessage
  isMe?: boolean
  onReply: () => void
  onReact: (emoji: string) => void
  onDelete: (forEveryone?: boolean) => void
  onForward: () => void
  onSelect?: () => void
  onSaveToErp?: () => void
  hasErpContact?: boolean
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '🙏', '👎']

export function MessageContextMenu({
  message,
  isMe,
  onReply,
  onReact,
  onDelete,
  onForward,
  onSelect,
  onSaveToErp,
  hasErpContact,
}: MessageContextMenuProps) {
  const isMediaMessage = ['document', 'image', 'video'].includes(message.message_type)
  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text)
      toast.success('Texto copiado')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`absolute -top-0.5 h-4 w-4 max-md:h-5 max-md:w-5 opacity-0 max-md:opacity-100 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm shadow-sm rounded-full ${
            isMe ? '-left-6' : '-right-6'
          }`}
        >
          <ChevronDown className="h-2.5 w-2.5 max-md:h-3 max-md:w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isMe ? 'start' : 'end'}
        sideOffset={4}
        collisionPadding={8}
        className="w-44 max-w-[calc(100vw-1rem)]"
      >
        <DropdownMenuItem onClick={onReply}>
          <Reply className="mr-2 h-4 w-4" />
          Responder
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Reagir</DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            sideOffset={4}
            collisionPadding={8}
            className="max-w-[calc(100vw-1rem)]"
          >
            <div className="flex flex-wrap gap-1 p-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  className="hover:bg-accent rounded p-1 text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onClick={onForward}>
          <Forward className="mr-2 h-4 w-4" />
          Reencaminhar
        </DropdownMenuItem>

        {onSelect && (
          <DropdownMenuItem onClick={onSelect}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Seleccionar
          </DropdownMenuItem>
        )}

        {message.text && (
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar texto
          </DropdownMenuItem>
        )}

        {isMediaMessage && hasErpContact && onSaveToErp && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSaveToErp}>
              <FolderDown className="mr-2 h-4 w-4" />
              Guardar no ERP
            </DropdownMenuItem>
          </>
        )}

        {message.from_me && !message.is_deleted && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar para todos
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
