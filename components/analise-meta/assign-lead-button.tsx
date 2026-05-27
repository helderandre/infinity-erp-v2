'use client'

/**
 * "Atribuir" action for an unprocessed Meta lead in the "Por atribuir" inbox.
 * Opens a dialog to pick a consultor and posts to the manual-assign endpoint,
 * which runs the lead through ingestLead (forced to that consultor). Refreshes
 * the page on success so the row leaves the inbox.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Consultant {
  id: string
  commercial_name: string | null
}

export function AssignLeadButton({
  leadId,
  leadName,
}: {
  leadId: string
  leadName?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loadingCons, setLoadingCons] = useState(false)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [consultantId, setConsultantId] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadConsultants() {
    if (consultants.length) return
    setLoadingCons(true)
    try {
      const res = await fetch('/api/users/consultants')
      const json = await res.json()
      setConsultants(Array.isArray(json) ? json : json.data ?? [])
    } catch {
      toast.error('Erro ao carregar consultores.')
    } finally {
      setLoadingCons(false)
    }
  }

  async function handleAssign() {
    if (!consultantId) {
      toast.error('Escolha um consultor.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/analise-meta/leads/${leadId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultant_id: consultantId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error === 'forbidden' ? 'Sem permissão.' : 'Não foi possível atribuir.')
        return
      }
      toast.success(
        json.status === 'already' ? 'Este lead já estava no CRM.' : 'Lead atribuído.',
      )
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Erro de rede.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) loadConsultants()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
          <UserPlus className="h-3 w-3" />
          Atribuir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir lead</DialogTitle>
          <DialogDescription>
            {leadName ? `${leadName} — ` : ''}escolhe o consultor que vai trabalhar este lead.
            Entra no CRM como contacto + lead, com notificação ao consultor.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Select value={consultantId} onValueChange={setConsultantId} disabled={loadingCons}>
            <SelectTrigger>
              <SelectValue placeholder={loadingCons ? 'A carregar…' : 'Escolher consultor…'} />
            </SelectTrigger>
            <SelectContent>
              {consultants.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.commercial_name ?? c.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleAssign} disabled={saving || !consultantId}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
