'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Plus, User, Building2, Check, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ComputedRequirement } from '@/lib/acquisitions/cmi-requirements'
import { PropertyCmiReadiness, SectionCard } from './property-cmi-readiness'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Prontidão do CPCV (fecho de negócio). Reaproveita o card de prontidão do CMI
 * (`PropertyCmiReadiness`) para **Imóvel + Vendedores** e acrescenta os
 * **Compradores** como cards IDÊNTICOS (`SectionCard`), alimentados pelas
 * subtarefas de documentos do négocio (agrupadas por comprador). Permite
 * carregar documentos e adicionar comprador.
 */
export function PropertyCpcvReadiness({
  propertyId,
  processId,
  dealId,
  compradorTasks,
  onRefresh,
}: {
  propertyId: string
  processId: string
  dealId: string | null
  compradorTasks: any[]
  onRefresh: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)

  // Agrupa as subtarefas de upload por comprador (config.client_id). Tasks sem
  // client_id (ex.: Compliance KYC) formam um grupo próprio pela task.
  const groups: {
    key: string
    taskId: string
    ownerId: string | null
    name: string
    personType: 'singular' | 'coletiva'
    items: ComputedRequirement[]
  }[] = []

  for (const task of compradorTasks) {
    const byClient = new Map<string, { taskId: string; ownerId: string | null; name: string; personType: 'singular' | 'coletiva'; subtasks: any[] }>()
    for (const s of (task.subtasks ?? []) as any[]) {
      if (s.config?.type !== 'upload') continue
      const cid = String(s.config?.client_id ?? `task-${task.id}`)
      if (!byClient.has(cid)) {
        byClient.set(cid, {
          taskId: task.id,
          ownerId: task.owner_id ?? null,
          name: s.config?.client_name ?? task.title,
          personType: String(task.title ?? '').includes('Empresa') ? 'coletiva' : 'singular',
          subtasks: [],
        })
      }
      byClient.get(cid)!.subtasks.push(s)
    }
    for (const [cid, g] of byClient) {
      groups.push({
        key: `${task.id}-${cid}`,
        taskId: g.taskId,
        ownerId: g.ownerId,
        name: g.name,
        personType: g.personType,
        items: g.subtasks.map((s) => ({
          key: s.id,
          label: String(s.title ?? 'Documento').replace(/\s+—\s+.*$/, ''),
          kind: 'document' as const,
          docTypeId: s.config?.doc_type_id,
          status: s.is_completed ? 'satisfied' : 'missing',
        })),
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Imóvel + Vendedores — reaproveita o card de prontidão do CMI. */}
      <PropertyCmiReadiness propertyId={propertyId} processId={processId} />

      {/* Compradores — cards idênticos (SectionCard). */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Compradores
        </h4>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 rounded-full text-xs"
          onClick={() => setAddOpen(true)}
          disabled={!dealId}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar comprador
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem compradores. Use &quot;Adicionar comprador&quot;.
        </p>
      ) : (
        groups.map((g) => {
          const satisfied = g.items.filter((i) => i.status === 'satisfied').length
          return (
            <SectionCard
              key={g.key}
              icon={
                g.personType === 'coletiva' ? (
                  <Building2 className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )
              }
              title={g.name}
              satisfied={satisfied}
              required={g.items.length}
              items={g.items}
              renderAction={(item) => (
                <CompradorDocAction
                  item={item}
                  taskId={g.taskId}
                  ownerId={g.ownerId}
                  propertyId={propertyId}
                  processId={processId}
                  onRefresh={onRefresh}
                />
              )}
            />
          )
        })
      )}

      <AddCompradorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        dealId={dealId}
        onAdded={onRefresh}
      />
    </div>
  )
}

function CompradorDocAction({
  item,
  taskId,
  ownerId,
  propertyId,
  processId,
  onRefresh,
}: {
  item: ComputedRequirement
  taskId: string
  ownerId: string | null
  propertyId: string
  processId: string
  onRefresh: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  if (item.status === 'satisfied') {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Carregado
      </span>
    )
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (item.docTypeId) fd.append('doc_type_id', item.docTypeId)
      if (ownerId) fd.append('owner_id', ownerId)
      const up = await fetch(`/api/properties/${propertyId}/documents/upload`, {
        method: 'POST',
        body: fd,
      })
      if (!up.ok) throw new Error()
      const { id: docId } = await up.json()
      await fetch(`/api/processes/${processId}/tasks/${taskId}/subtasks/${item.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: true, task_result: { doc_registry_id: docId } }),
      })
      toast.success('Documento carregado')
      onRefresh()
    } catch {
      toast.error('Erro ao carregar documento')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.webp"
        onChange={onFile}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Upload className="h-3 w-3" />
        )}
        Carregar
      </Button>
    </>
  )
}

function AddCompradorDialog({
  open,
  onOpenChange,
  dealId,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  dealId: string | null
  onAdded: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [personType, setPersonType] = useState<'singular' | 'coletiva'>('singular')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim() || !dealId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, person_type: personType }),
      })
      if (!res.ok) throw new Error()
      toast.success('Comprador adicionado')
      onAdded()
      onOpenChange(false)
      setName('')
      setEmail('')
      setPhone('')
      setPersonType('singular')
    } catch {
      toast.error('Erro ao adicionar comprador')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar comprador</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPersonType('singular')}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-sm',
                personType === 'singular'
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'text-muted-foreground'
              )}
            >
              Pessoa singular
            </button>
            <button
              type="button"
              onClick={() => setPersonType('coletiva')}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-sm',
                personType === 'coletiva'
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'text-muted-foreground'
              )}
            >
              Pessoa coletiva
            </button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpcv-comprador-nome">Nome</Label>
            <Input id="cpcv-comprador-nome" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpcv-comprador-email">Email</Label>
            <Input id="cpcv-comprador-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpcv-comprador-tel">Telemóvel</Label>
            <Input id="cpcv-comprador-tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
