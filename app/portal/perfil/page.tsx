// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPortalProfile, updatePortalProfile } from '../actions'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Loader2, LogOut, Lock, Pencil, Check, X } from 'lucide-react'

interface ProfileData {
  user: { id: string; commercial_name: string; professional_email: string | null } | null
  owner: { name: string; phone: string | null; nif: string | null; address: string | null; nationality: string | null } | null
  email: string | null
}

export default function PerfilPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    setLoading(true)
    const { data, error } = await getPortalProfile()
    if (error) { toast.error(error); setLoading(false); return }
    setProfile(data as ProfileData)
    setLoading(false)
  }

  function startEdit(section: string) {
    const p = profile
    if (section === 'pessoais') {
      setDraft({ nome: p?.user?.commercial_name ?? '', email: p?.email ?? '', telefone: p?.owner?.phone ?? '' })
    } else if (section === 'morada') {
      setDraft({ morada: p?.owner?.address ?? '' })
    } else if (section === 'identificacao') {
      setDraft({ nif: p?.owner?.nif ?? '' })
    }
    setEditing(section)
  }

  function cancelEdit() { setEditing(null); setDraft({}) }

  async function saveEdit() {
    setSaving(true)
    const updates: { name?: string; phone?: string; address?: string } = {}
    if (editing === 'pessoais') {
      if (draft.nome) updates.name = draft.nome
      if (draft.telefone) updates.phone = draft.telefone
    } else if (editing === 'morada') {
      if (draft.morada) updates.address = draft.morada
    }

    const { error } = await updatePortalProfile(updates)
    if (error) { toast.error(error) } else { toast.success('Perfil atualizado com sucesso'); await loadProfile() }
    setEditing(null)
    setDraft({})
    setSaving(false)
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/portal/login')
    } catch { toast.error('Erro ao terminar sessao') }
    setLoggingOut(false)
  }

  function initials(name?: string) {
    if (!name) return '?'
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
    )
  }

  const name = profile?.user?.commercial_name ?? 'Cliente'
  const email = profile?.email ?? profile?.user?.professional_email ?? ''

  function renderField(label: string, field: string, value: string, readonly = false) {
    const isEditing = editing !== null && !readonly
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {isEditing ? (
          <Input value={draft[field] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))} className="h-9" />
        ) : (
          <p className="text-sm">{value || '-'}</p>
        )}
      </div>
    )
  }

  function sectionHeader(title: string, section: string) {
    return (
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {editing === section ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={saving}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => startEdit(section)}>
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        )}
      </CardHeader>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-2 py-6">
        <Avatar className="h-20 w-20">
          <AvatarFallback className="text-xl bg-primary/10 text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        <h1 className="text-lg font-semibold">{name}</h1>
        <p className="text-sm text-muted-foreground">{email}</p>
        <Badge variant="secondary">Cliente</Badge>
      </div>

      {/* Dados Pessoais */}
      <Card className="rounded-xl">
        {sectionHeader('Dados Pessoais', 'pessoais')}
        <CardContent className="space-y-3 pt-0">
          {renderField('Nome', 'nome', name)}
          {renderField('Email', 'email', email, true)}
          {renderField('Telefone', 'telefone', profile?.owner?.phone ?? '')}
        </CardContent>
      </Card>

      {/* Morada */}
      <Card className="rounded-xl">
        {sectionHeader('Morada', 'morada')}
        <CardContent className="space-y-3 pt-0">
          {renderField('Morada', 'morada', profile?.owner?.address ?? '')}
        </CardContent>
      </Card>

      {/* Identificacao */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Identificacao</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Label className="text-xs text-muted-foreground">NIF</Label>
          <p className="text-sm mt-1">{profile?.owner?.nif ?? '-'}</p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <Button
          variant="outline"
          className="w-full rounded-xl justify-start gap-2"
          onClick={() => toast.info('Contacte o seu consultor para alterar a password.')}
        >
          <Lock className="h-4 w-4" /> Alterar Password
        </Button>
        <Button
          variant="destructive"
          className="w-full rounded-xl justify-start gap-2"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Terminar Sessao
        </Button>
      </div>
    </div>
  )
}
