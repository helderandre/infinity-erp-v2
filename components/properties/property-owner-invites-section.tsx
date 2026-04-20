'use client'

import { useEffect, useState } from 'react'
import {
  Link2,
  Copy,
  Check,
  Clock,
  XCircle,
  Loader2,
  Send,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/constants'

interface InviteRow {
  id: string
  token: string
  status: 'pending' | 'completed' | 'expired' | 'revoked'
  expires_at: string
  submitted_at: string | null
  submitted_owner_ids: string[] | null
  created_at: string
  note: string | null
  created_by_user?: { commercial_name: string | null } | null
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: {
    label: 'A aguardar resposta',
    cls: 'bg-amber-100 text-amber-800',
  },
  completed: { label: 'Submetido', cls: 'bg-emerald-100 text-emerald-800' },
  expired: { label: 'Expirado', cls: 'bg-neutral-200 text-neutral-700' },
  revoked: { label: 'Cancelado', cls: 'bg-red-100 text-red-800' },
}

export function PropertyOwnerInvitesSection({
  propertyId,
  onSubmissionDetected,
}: {
  propertyId: string
  onSubmissionDetected?: () => void
}) {
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [note, setNote] = useState('')
  const [expiresInDays, setExpiresInDays] = useState(14)
  const [newLink, setNewLink] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/owner-invites`)
      if (!res.ok) throw new Error('Erro ao carregar convites')
      const data = (await res.json()) as InviteRow[]
      setInvites(data)
      if (data.some((i) => i.status === 'completed') && onSubmissionDetected) {
        onSubmissionDetected()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const createInvite = async () => {
    setCreating(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/owner-invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: note || undefined,
          expires_in_days: expiresInDays,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error || 'Erro ao criar convite')
      }
      const invite = (await res.json()) as InviteRow
      const url = `${window.location.origin}/proprietario/${invite.token}`
      setNewLink(url)
      setNote('')
      await load()
      toast.success('Link criado — partilhe com o cliente')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (inviteId: string) => {
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/owner-invites/${inviteId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error || 'Erro ao cancelar convite')
      }
      toast.success('Convite cancelado')
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/proprietario/${token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  const pendingInvites = invites.filter((i) => i.status === 'pending')
  const historicalInvites = invites.filter((i) => i.status !== 'pending')

  return (
    <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-muted-foreground" />
            Convidar proprietário
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gere um link para o cliente preencher os seus dados e documentos.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setNewLink(null)
            setDialogOpen(true)
          }}
        >
          <Link2 className="h-3.5 w-3.5 mr-1.5" /> Gerar link
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">A carregar...</p>
      ) : invites.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Ainda não foi gerado nenhum convite para este imóvel.
        </p>
      ) : (
        <div className="space-y-2">
          {pendingInvites.map((invite) => (
            <InviteCard
              key={invite.id}
              invite={invite}
              onCopy={() => copyLink(invite.token)}
              onRevoke={() => revoke(invite.id)}
            />
          ))}
          {historicalInvites.length > 0 && (
            <details className="pt-2">
              <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                Histórico ({historicalInvites.length})
              </summary>
              <div className="mt-2 space-y-2">
                {historicalInvites.map((invite) => (
                  <InviteCard
                    key={invite.id}
                    invite={invite}
                    onCopy={() => copyLink(invite.token)}
                    onRevoke={() => revoke(invite.id)}
                    historical
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar link de proprietário</DialogTitle>
            <DialogDescription>
              O link é de uso único. Partilhe com quem vai submeter os dados.
            </DialogDescription>
          </DialogHeader>

          {newLink ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-900 font-medium">
                  Link pronto a partilhar
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={newLink} className="font-mono text-xs" />
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(newLink)
                    toast.success('Link copiado')
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie este link por email, WhatsApp, ou o canal que preferir.
                Expira em {expiresInDays} dias e só pode ser usado uma vez.
              </p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Fechar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Validade (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={expiresInDays}
                  onChange={(e) =>
                    setExpiresInDays(
                      Math.max(1, Math.min(60, Number(e.target.value) || 14))
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Nota para o cliente (opcional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Ex: Olá, por favor preencha estes dados para avançarmos com o processo."
                />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Quem tiver o link poderá preencher dados pessoais e carregar
                  documentos sem autenticação.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={createInvite}
                  disabled={creating}
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Gerar link
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InviteCard({
  invite,
  onCopy,
  onRevoke,
  historical,
}: {
  invite: InviteRow
  onCopy: () => void
  onRevoke: () => void
  historical?: boolean
}) {
  const status = STATUS_LABEL[invite.status] || STATUS_LABEL.pending
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        historical ? 'bg-muted/20 opacity-80' : 'bg-white'
      }`}
    >
      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${status.cls}`}
          >
            {status.label}
          </span>
          <span className="text-xs text-muted-foreground">
            Criado a {formatDate(invite.created_at)}
          </span>
          {invite.status === 'pending' && (
            <span className="text-xs text-muted-foreground">
              · expira {formatDate(invite.expires_at)}
            </span>
          )}
          {invite.submitted_at && (
            <span className="text-xs text-emerald-700">
              · submetido {formatDate(invite.submitted_at)}
            </span>
          )}
        </div>
        {invite.created_by_user?.commercial_name ? (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Criado por {invite.created_by_user.commercial_name}
          </p>
        ) : null}
      </div>
      {invite.status === 'pending' && (
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={onCopy}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRevoke}
            className="text-red-600 hover:text-red-700"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
