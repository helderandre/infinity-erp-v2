'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { Handshake } from 'lucide-react'

const CATEGORIES = {
  lawyer: 'Advogado',
  notary: 'Notário',
  bank: 'Banco',
  photographer: 'Fotógrafo',
  constructor: 'Construtor',
  insurance: 'Seguros',
  energy_cert: 'Certificação Energética',
  cleaning: 'Limpezas',
  moving: 'Mudanças',
  appraiser: 'Avaliador',
  architect: 'Arquitecto',
  home_staging: 'Home Staging',
  credit_broker: 'Intermediário de Crédito',
  interior_design: 'Design de Interiores',
  marketing: 'Marketing',
  other: 'Outro',
} as const

interface CreatePartnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName?: string
  defaultPhone?: string
  onComplete?: (id: string) => void
}

export function CreatePartnerDialog({
  open,
  onOpenChange,
  defaultName = '',
  defaultPhone = '',
  onComplete,
}: CreatePartnerDialogProps) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState(defaultPhone)
  const [category, setCategory] = useState('other')
  const [contactPerson, setContactPerson] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setPhone(defaultPhone)
      setEmail('')
      setCategory('other')
      setContactPerson('')
      setNotes('')
    }
  }, [open, defaultName, defaultPhone])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          category,
          contact_person: contactPerson.trim() || null,
          internal_notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar parceiro')
      }
      const { data } = await res.json()
      toast.success('Parceiro criado com sucesso')
      onOpenChange(false)
      onComplete?.(data?.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar parceiro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 dark:bg-neutral-800 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Handshake className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-white text-lg">Novo Parceiro</DialogTitle>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label className="text-xs font-medium">Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl" placeholder="Nome do parceiro" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl" placeholder="email@exemplo.com" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Telefone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="rounded-xl" placeholder="+351 9XX XXX XXX" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Pessoa de Contacto</Label>
              <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="rounded-xl" placeholder="Nome da pessoa" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-medium">Notas</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl text-xs" rows={2} placeholder="Observações..." />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full w-full sm:w-auto" disabled={saving} onClick={handleSubmit}>
            {saving && <Spinner variant="infinite" size={14} className="mr-1.5" />}
            Criar Parceiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
