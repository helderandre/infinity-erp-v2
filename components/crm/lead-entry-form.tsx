'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Inbox } from 'lucide-react'
import { toast } from 'sonner'

const SOURCES = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'website', label: 'Website' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'organic', label: 'Orgânico' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone_call', label: 'Chamada' },
  { value: 'social_media', label: 'Redes Sociais' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Outro' },
] as const

const SECTORS = [
  { value: 'real_estate_buy', label: 'Compra' },
  { value: 'real_estate_sell', label: 'Venda' },
  { value: 'real_estate_rent', label: 'Arrendamento' },
  { value: 'real_estate_landlord', label: 'Arrendador' },
  { value: 'recruitment', label: 'Recrutamento' },
  { value: 'credit', label: 'Crédito' },
] as const

export interface LeadEntryFormProps {
  consultants: { id: string; commercial_name: string }[]
  onSuccess?: (entryId: string, contactId: string) => void
  onCancel?: () => void
}

export function LeadEntryForm({ consultants, onSuccess, onCancel }: LeadEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    raw_name: '',
    raw_email: '',
    raw_phone: '',
    source: 'manual',
    sector: '',
    assigned_consultant_id: '',
    notes: '',
  })

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.raw_name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    if (!form.raw_email && !form.raw_phone) {
      toast.error('Indique pelo menos email ou telemóvel')
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        source: form.source,
        raw_name: form.raw_name.trim(),
        raw_email: form.raw_email.trim() || null,
        raw_phone: form.raw_phone.trim() || null,
        sector: form.sector || null,
        assigned_consultant_id: form.assigned_consultant_id || null,
        notes: form.notes.trim() || null,
      }
      const res = await fetch('/api/lead-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao criar lead')
      }
      const entry = await res.json()
      toast.success('Lead criada com sucesso')
      onSuccess?.(entry?.id ?? '', entry?.contact_id ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lead')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Header */}
      <div className="bg-neutral-900 dark:bg-neutral-800 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-white text-lg font-semibold">Nova Lead</h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Entra no pool e é atribuída automaticamente se houver regra.
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="raw_name" className="text-xs font-medium">Nome *</Label>
          <Input
            id="raw_name"
            value={form.raw_name}
            onChange={(e) => setField('raw_name', e.target.value)}
            placeholder="Ex: João Silva"
            className="rounded-xl"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="raw_email" className="text-xs font-medium">Email</Label>
            <Input
              id="raw_email"
              type="email"
              value={form.raw_email}
              onChange={(e) => setField('raw_email', e.target.value)}
              placeholder="email@exemplo.pt"
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="raw_phone" className="text-xs font-medium">Telemóvel</Label>
            <Input
              id="raw_phone"
              value={form.raw_phone}
              onChange={(e) => setField('raw_phone', e.target.value)}
              placeholder="+351 9XX XXX XXX"
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-xs font-medium">Origem</Label>
            <Select value={form.source} onValueChange={(v) => setField('source', v)}>
              <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs font-medium">Sector</Label>
            <Select
              value={form.sector || 'none'}
              onValueChange={(v) => setField('sector', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="rounded-xl text-xs">
                <SelectValue placeholder="Não especificado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não especificado</SelectItem>
                {SECTORS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="text-xs font-medium">Atribuir a consultor</Label>
          <Select
            value={form.assigned_consultant_id || 'auto'}
            onValueChange={(v) => setField('assigned_consultant_id', v === 'auto' ? '' : v)}
          >
            <SelectTrigger className="rounded-xl text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automático (via regras)</SelectItem>
              {consultants.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes" className="text-xs font-medium">Notas</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            rows={3}
            className="rounded-xl text-xs"
            placeholder="Observações internas…"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 px-6 pb-6">
        <Button
          type="button"
          variant="outline"
          className="rounded-full w-full sm:w-auto"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="rounded-full w-full sm:flex-1"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Criar lead
        </Button>
      </div>
    </form>
  )
}
