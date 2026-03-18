'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  User, Shield, Briefcase, ArrowRight, ArrowLeft, Loader2, Check, Pencil
} from 'lucide-react'
import type { ConsultantDetail } from '@/types/consultant'

const STEPS = [
  { key: 'general', label: 'Dados Gerais', icon: User },
  { key: 'profile', label: 'Perfil', icon: Shield },
  { key: 'private', label: 'Privado', icon: Briefcase },
] as const

const SPECIALIZATIONS = [
  'Residencial', 'Comercial', 'Luxo', 'Arrendamento',
  'Investimento', 'Terrenos', 'Reabilitação', 'Internacional',
]

const LANGUAGES = ['Português', 'Inglês', 'Francês', 'Espanhol', 'Alemão', 'Italiano', 'Mandarim']

interface EditConsultantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  consultant: ConsultantDetail
  roles: { id: string; name: string }[]
  onSaved: () => void
}

export function EditConsultantDialog({ open, onOpenChange, consultant, roles, onSaved }: EditConsultantDialogProps) {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const profile = consultant.dev_consultant_profiles
  const privateData = consultant.dev_consultant_private_data
  const currentRoleId = consultant.user_roles?.[0]?.role_id || ''

  const [form, setForm] = useState({
    commercial_name: consultant.commercial_name,
    professional_email: consultant.professional_email || '',
    phone_commercial: profile?.phone_commercial || '',
    role_id: currentRoleId,
    is_active: consultant.is_active ?? true,
    display_website: consultant.display_website ?? false,
    bio: profile?.bio || '',
    specializations: (profile?.specializations || []) as string[],
    languages: (profile?.languages || []) as string[],
    instagram_handle: profile?.instagram_handle || '',
    linkedin_url: profile?.linkedin_url || '',
    full_name: privateData?.full_name || '',
    nif: privateData?.nif || '',
    iban: privateData?.iban || '',
    address_private: privateData?.address_private || '',
    monthly_salary: privateData?.monthly_salary != null ? String(privateData.monthly_salary) : '',
    commission_rate: privateData?.commission_rate != null ? String(privateData.commission_rate) : '',
    hiring_date: privateData?.hiring_date || '',
  })

  // Reset form when consultant changes
  useEffect(() => {
    if (open) {
      setStep(0)
      setForm({
        commercial_name: consultant.commercial_name,
        professional_email: consultant.professional_email || '',
        phone_commercial: profile?.phone_commercial || '',
        role_id: currentRoleId,
        is_active: consultant.is_active ?? true,
        display_website: consultant.display_website ?? false,
        bio: profile?.bio || '',
        specializations: (profile?.specializations || []) as string[],
        languages: (profile?.languages || []) as string[],
        instagram_handle: profile?.instagram_handle || '',
        linkedin_url: profile?.linkedin_url || '',
        full_name: privateData?.full_name || '',
        nif: privateData?.nif || '',
        iban: privateData?.iban || '',
        address_private: privateData?.address_private || '',
        monthly_salary: privateData?.monthly_salary != null ? String(privateData.monthly_salary) : '',
        commission_rate: privateData?.commission_rate != null ? String(privateData.commission_rate) : '',
        hiring_date: privateData?.hiring_date || '',
      })
    }
  }, [open, consultant.id])

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const toggleArray = (field: 'specializations' | 'languages', item: string) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(item) ? f[field].filter(i => i !== item) : [...f[field], item],
    }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/consultants/${consultant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            commercial_name: form.commercial_name,
            professional_email: form.professional_email || null,
            is_active: form.is_active,
            display_website: form.display_website,
          },
          profile: {
            bio: form.bio || null,
            phone_commercial: form.phone_commercial || null,
            specializations: form.specializations.length > 0 ? form.specializations : null,
            languages: form.languages.length > 0 ? form.languages : null,
            instagram_handle: form.instagram_handle || null,
            linkedin_url: form.linkedin_url || null,
          },
          private_data: {
            full_name: form.full_name || null,
            nif: form.nif || null,
            iban: form.iban || null,
            address_private: form.address_private || null,
            monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null,
            commission_rate: form.commission_rate ? Number(form.commission_rate) : null,
            hiring_date: form.hiring_date || null,
          },
          role_id: form.role_id || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar')
      }

      toast.success('Consultor actualizado com sucesso')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar consultor')
    } finally {
      setSubmitting(false)
    }
  }

  const isLast = step === STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col gap-0">
        {/* Header */}
        <div className="shrink-0 bg-neutral-900 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5 text-white" /> })()}
            </div>
            <div>
              <h3 className="text-white font-semibold">Editar Consultor</h3>
              <p className="text-neutral-400 text-xs mt-0.5">{consultant.commercial_name} — {STEPS[step].label}</p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex gap-1.5 mt-4">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-300 cursor-pointer',
                  i < step ? 'bg-emerald-400' : i === step ? 'bg-white' : 'bg-white/20'
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4">
          {/* Step 0: General */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Nome Comercial *</Label>
                <Input className="rounded-xl" placeholder="Nome do consultor" value={form.commercial_name} onChange={e => update('commercial_name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Email Profissional</Label>
                  <Input className="rounded-xl" type="email" placeholder="email@empresa.pt" value={form.professional_email} onChange={e => update('professional_email', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Telemóvel</Label>
                  <Input className="rounded-xl" placeholder="9XX XXX XXX" value={form.phone_commercial} onChange={e => update('phone_commercial', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Função</Label>
                <Select value={form.role_id} onValueChange={v => update('role_id', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar função" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.is_active} onCheckedChange={v => update('is_active', v)} />
                  <span className="text-xs">Activo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.display_website} onCheckedChange={v => update('display_website', v)} />
                  <span className="text-xs">Mostrar no Website</span>
                </label>
              </div>
            </>
          )}

          {/* Step 1: Profile */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Biografia</Label>
                <Textarea className="rounded-xl" rows={3} placeholder="Breve descrição do consultor..." value={form.bio} onChange={e => update('bio', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Especializações</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALIZATIONS.map(spec => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => toggleArray('specializations', spec)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                        form.specializations.includes(spec)
                          ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white'
                          : 'bg-transparent text-muted-foreground border-border hover:bg-muted/50'
                      )}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Idiomas</Label>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleArray('languages', lang)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                        form.languages.includes(lang)
                          ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white'
                          : 'bg-transparent text-muted-foreground border-border hover:bg-muted/50'
                      )}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Instagram</Label>
                  <Input className="rounded-xl" placeholder="@utilizador" value={form.instagram_handle} onChange={e => update('instagram_handle', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">LinkedIn URL</Label>
                  <Input className="rounded-xl" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Private */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Nome Completo</Label>
                  <Input className="rounded-xl" placeholder="Nome completo legal" value={form.full_name} onChange={e => update('full_name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">NIF</Label>
                  <Input className="rounded-xl" placeholder="123456789" value={form.nif} onChange={e => update('nif', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">IBAN</Label>
                <Input className="rounded-xl" placeholder="PT50 0000 0000 0000 0000 0000 0" value={form.iban} onChange={e => update('iban', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Morada Pessoal</Label>
                <Input className="rounded-xl" placeholder="Morada completa" value={form.address_private} onChange={e => update('address_private', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Salário Mensal</Label>
                  <Input className="rounded-xl" type="number" step="0.01" min="0" placeholder="0.00" value={form.monthly_salary} onChange={e => update('monthly_salary', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Comissão (%)</Label>
                  <Input className="rounded-xl" type="number" step="0.01" min="0" max="100" placeholder="0.00" value={form.commission_rate} onChange={e => update('commission_rate', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Data Contratação</Label>
                  <Input className="rounded-xl" type="date" value={form.hiring_date} onChange={e => update('hiring_date', e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 pb-5 pt-3 border-t flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="outline" className="rounded-full" onClick={() => setStep(s => s - 1)}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Anterior
            </Button>
          ) : (
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}

          {isLast ? (
            <Button className="rounded-full" onClick={handleSubmit} disabled={submitting || !form.commercial_name}>
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Guardar
            </Button>
          ) : (
            <Button className="rounded-full" onClick={() => setStep(s => s + 1)}>
              Seguinte
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
