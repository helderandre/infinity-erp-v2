'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Linkedin, Loader2, Mail, Phone, UserPlus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { createCandidate } from '@/app/dashboard/recrutamento/actions'
import type { CandidateSource } from '@/types/recruitment'
import { CANDIDATE_SOURCES } from '@/types/recruitment'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Recruiter {
  id: string
  commercial_name: string
}

function Req() {
  return <span className="text-destructive">*</span>
}

export function NewCandidateSheet({
  open,
  onOpenChange,
  recruiters,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recruiters: Recruiter[]
  onCreated: (id: string) => void
}) {
  const isMobile = useIsMobile()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState<CandidateSource>('referral')
  const [sourceDetail, setSourceDetail] = useState('')
  const [recruiterId, setRecruiterId] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [saving, setSaving] = useState(false)

  // Obrigatório: nome + pelo menos uma forma de contacto.
  const canSubmit = useMemo(
    () => fullName.trim().length > 0 && (phone.trim().length > 0 || email.trim().length > 0),
    [fullName, phone, email],
  )

  function reset() {
    setFullName('')
    setEmail('')
    setPhone('')
    setSource('referral')
    setSourceDetail('')
    setRecruiterId('')
    setLinkedin('')
  }

  async function submit() {
    if (!canSubmit) {
      toast.error('Indica o nome e pelo menos um contacto (telemóvel ou email)')
      return
    }
    setSaving(true)
    try {
      const { candidate, error } = await createCandidate({
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        source,
        source_detail: sourceDetail.trim() || undefined,
        status: 'novo',
        assigned_recruiter_id: recruiterId || undefined,
      })
      if (error || !candidate) throw new Error(error ?? 'Erro')
      if (linkedin.trim()) {
        const { updateCandidate } = await import('@/app/dashboard/recrutamento/actions')
        await updateCandidate(candidate.id, { linkedin_url: linkedin.trim() })
      }
      toast.success('Candidato criado')
      reset()
      onOpenChange(false)
      onCreated(candidate.id)
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível criar o candidato')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[88dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[460px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-border/40 gap-2">
          <SheetTitle className="text-base font-medium flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-foreground/5 border border-border/40 grid place-items-center">
              <UserPlus className="h-3.5 w-3.5" />
            </span>
            Novo candidato
          </SheetTitle>
          <SheetDescription className="text-[12px]">Registar uma candidatura manualmente.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Nome <Req />
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              autoFocus
              className="h-9 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Contacto <Req />
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telemóvel"
                  className="h-9 rounded-xl pl-9"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="h-9 rounded-xl pl-9"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Indica pelo menos um — telemóvel ou email.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Origem</Label>
              <Select value={source} onValueChange={(v) => setSource(v as CandidateSource)}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CANDIDATE_SOURCES) as CandidateSource[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {CANDIDATE_SOURCES[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Recrutador</Label>
              <Select value={recruiterId || 'none'} onValueChange={(v) => setRecruiterId(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem recrutador</SelectItem>
                  {recruiters.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.commercial_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {source === 'referral' && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Quem referenciou</Label>
              <Input
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
                placeholder="Nome de quem indicou"
                className="h-9 rounded-xl"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[12px]">LinkedIn</Label>
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="Opcional"
                className="h-9 rounded-xl pl-9"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-full">
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !canSubmit} className="rounded-full gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar candidato
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
