'use client'

/**
 * Reencaminhar mensagem do chat interno para outro destino.
 *
 * Targets:
 * - "Geral" (canal global do chat interno) — POST sem `dm_recipient_id`
 *   nem `channel_id` específico (a rota usa o canal Geral por defeito).
 * - DM com outro consultor — POST com `dm_recipient_id=<userId>`.
 *
 * Forward = enviar uma nova mensagem com o conteúdo do original, prefixada
 * por um marcador "↪ Reencaminhada". Anexos não são re-uploaded por agora
 * — uma futura iteração pode passar a referenciar os mesmos `attachment_id`s.
 */

import { useEffect, useMemo, useState } from 'react'
import { Forward, Loader2, Search, Hash, User as UserIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ConsultantOption {
  id: string
  commercial_name: string
  dev_consultant_profiles: { profile_photo_url: string | null } | null
}

type Target =
  | { kind: 'geral' }
  | { kind: 'dm'; userId: string; userName: string; avatarUrl?: string | null }

interface InternalForwardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Conteúdo da mensagem a reencaminhar. */
  messageContent: string
  /** Tem anexos? Mostra aviso de que serão omitidos. */
  hasAttachments?: boolean
  /** ID do utilizador actual — excluído da lista de DMs. */
  currentUserId: string
}

export function InternalForwardDialog({
  open,
  onOpenChange,
  messageContent,
  hasAttachments,
  currentUserId,
}: InternalForwardDialogProps) {
  const [users, setUsers] = useState<ConsultantOption[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Lazy-load consultants on first open
  useEffect(() => {
    if (!open || users.length > 0) return
    let cancelled = false
    setLoading(true)
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ConsultantOption[]) => {
        if (cancelled) return
        setUsers(data.filter((u) => u.id !== currentUserId))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, users.length, currentUserId])

  // Reset transient state on close
  useEffect(() => {
    if (!open) {
      setSelectedKey(null)
      setSearch('')
    }
  }, [open])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const t = search.trim().toLowerCase()
    return users.filter((u) => u.commercial_name.toLowerCase().includes(t))
  }, [users, search])

  const buildTarget = (key: string): Target | null => {
    if (key === 'geral') return { kind: 'geral' }
    if (key.startsWith('dm:')) {
      const userId = key.slice(3)
      const u = users.find((x) => x.id === userId)
      if (!u) return null
      return {
        kind: 'dm',
        userId: u.id,
        userName: u.commercial_name,
        avatarUrl: u.dev_consultant_profiles?.profile_photo_url ?? null,
      }
    }
    return null
  }

  const handleForward = async () => {
    if (!selectedKey) return
    const target = buildTarget(selectedKey)
    if (!target) {
      toast.error('Destino inválido')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        content: `↪ Reencaminhada\n${messageContent}`,
        mentions: [],
        parent_message_id: null,
      }
      if (target.kind === 'dm') body.dm_recipient_id = target.userId
      // Geral usa o canal por defeito (sem campos extra).

      const res = await fetch('/api/chat/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Falha ao reencaminhar')
      toast.success(
        target.kind === 'geral'
          ? 'Reencaminhada para Geral'
          : `Reencaminhada para ${target.userName}`,
      )
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reencaminhar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-4 w-4" />
            Reencaminhar mensagem
          </DialogTitle>
          <DialogDescription>
            Escolha o destino — Geral ou conversa directa com um colega.
          </DialogDescription>
        </DialogHeader>

        {/* Preview do conteúdo */}
        <div className="rounded-xl border bg-muted/40 p-3 text-xs">
          <p className="font-medium text-muted-foreground mb-1">Mensagem</p>
          <p className="line-clamp-3 whitespace-pre-wrap break-words">{messageContent || '(sem texto)'}</p>
          {hasAttachments && (
            <p className="text-[11px] text-amber-600 mt-1.5">
              Os anexos não são reencaminhados nesta versão.
            </p>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar destino..."
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Targets */}
        <ScrollArea className="h-[260px] -mx-1 pr-1">
          <div className="space-y-0.5 px-1">
            {/* Geral */}
            {(!search.trim() || 'geral'.includes(search.trim().toLowerCase())) && (
              <TargetRow
                selected={selectedKey === 'geral'}
                onClick={() => setSelectedKey('geral')}
                left={
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Hash className="h-4 w-4" />
                  </div>
                }
                title="Geral"
                subtitle="Canal interno da equipa"
              />
            )}

            {/* DMs */}
            {loading && users.length === 0 ? (
              <div className="space-y-1.5 mt-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredUsers.length === 0 && !loading ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Sem resultados.
              </p>
            ) : (
              filteredUsers.map((u) => {
                const photo = u.dev_consultant_profiles?.profile_photo_url
                const key = `dm:${u.id}`
                return (
                  <TargetRow
                    key={u.id}
                    selected={selectedKey === key}
                    onClick={() => setSelectedKey(key)}
                    left={
                      <Avatar className="h-9 w-9">
                        {photo && <AvatarImage src={photo} alt="" />}
                        <AvatarFallback className="text-xs">
                          {u.commercial_name?.[0]?.toUpperCase() ?? <UserIcon className="h-3.5 w-3.5" />}
                        </AvatarFallback>
                      </Avatar>
                    }
                    title={u.commercial_name}
                    subtitle="Mensagem directa"
                  />
                )
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleForward} disabled={!selectedKey || submitting}>
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Forward className="h-3.5 w-3.5 mr-1.5" />
            )}
            Reencaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TargetRow({
  selected,
  onClick,
  left,
  title,
  subtitle,
}: {
  selected: boolean
  onClick: () => void
  left: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:bg-muted/50',
      )}
    >
      {left}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </button>
  )
}
