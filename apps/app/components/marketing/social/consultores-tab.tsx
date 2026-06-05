'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getAgents, getAgentProfiles, upsertAgentProfile } from '@/app/dashboard/marketing/redes-sociais/actions'
import type { MarketingAgentProfile } from '@/types/marketing-social'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Instagram,
  Facebook,
  Linkedin,
  ExternalLink,
  Pencil,
  Plus,
  Link,
  FolderOpen,
  Palette,
  User,
  Save,
  Globe,
  Trash2,
  Loader2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Agent {
  id: string
  commercial_name: string
  professional_email: string
  is_active: boolean
  dev_consultant_profiles: {
    profile_photo_url: string | null
    specializations: string[] | null
    instagram_handle: string | null
  } | null
}

interface OtherLink {
  label: string
  url: string
}

interface ProfileFormData {
  instagram_url: string
  facebook_url: string
  linkedin_url: string
  tiktok_url: string
  canva_workspace_url: string
  google_drive_url: string
  other_links: OtherLink[]
  notes: string
  brand_voice_notes: string
}

const EMPTY_FORM: ProfileFormData = {
  instagram_url: '',
  facebook_url: '',
  linkedin_url: '',
  tiktok_url: '',
  canva_workspace_url: '',
  google_drive_url: '',
  other_links: [],
  notes: '',
  brand_voice_notes: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function countActiveSocials(profile: MarketingAgentProfile): number {
  let count = 0
  if (profile.instagram_url) count++
  if (profile.facebook_url) count++
  if (profile.linkedin_url) count++
  if (profile.tiktok_url) count++
  return count
}

function profileToForm(profile: MarketingAgentProfile): ProfileFormData {
  return {
    instagram_url: profile.instagram_url ?? '',
    facebook_url: profile.facebook_url ?? '',
    linkedin_url: profile.linkedin_url ?? '',
    tiktok_url: profile.tiktok_url ?? '',
    canva_workspace_url: profile.canva_workspace_url ?? '',
    google_drive_url: profile.google_drive_url ?? '',
    other_links: profile.other_links?.length ? profile.other_links : [],
    notes: profile.notes ?? '',
    brand_voice_notes: profile.brand_voice_notes ?? '',
  }
}

// ─── TikTok Icon (not in lucide) ─────────────────────────────────────────────

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  )
}

// ─── Agent Card ──────────────────────────────────────────────────────────────

function AgentProfileCard({
  profile,
  onEdit,
  onClick,
}: {
  profile: MarketingAgentProfile
  onEdit: () => void
  onClick: () => void
}) {
  const name = profile.agent?.commercial_name ?? 'Consultor'
  const photoUrl = profile.agent_profile?.profile_photo_url
  const socialCount = countActiveSocials(profile)

  return (
    <Card className="group relative overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg cursor-pointer" onClick={onClick}>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar size="lg">
            {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{name}</h3>
            {profile.agent?.professional_email && (
              <p className="text-xs text-muted-foreground truncate">
                {profile.agent.professional_email}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"
            onClick={(e) => { e.stopPropagation(); onEdit() }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        <Separator className="my-3" />

        {/* Social Links Row */}
        <div className="flex items-center gap-1.5">
          <SocialIconButton
            url={profile.instagram_url}
            icon={<Instagram className="h-4 w-4" />}
            label="Instagram"
          />
          <SocialIconButton
            url={profile.facebook_url}
            icon={<Facebook className="h-4 w-4" />}
            label="Facebook"
          />
          <SocialIconButton
            url={profile.linkedin_url}
            icon={<Linkedin className="h-4 w-4" />}
            label="LinkedIn"
          />
          <SocialIconButton
            url={profile.tiktok_url}
            icon={<TikTokIcon className="h-4 w-4" />}
            label="TikTok"
          />

          <div className="ml-auto">
            {socialCount > 0 && (
              <span className="rounded-full bg-muted text-[11px] px-2 py-0.5 font-medium">
                {socialCount} {socialCount === 1 ? 'rede' : 'redes'}
              </span>
            )}
          </div>
        </div>

        {/* Quick Links */}
        {(profile.canva_workspace_url || profile.google_drive_url) && (
          <>
            <Separator className="my-3" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Links Rapidos</span>
              <div className="flex items-center gap-1 ml-auto">
                {profile.canva_workspace_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    asChild
                  >
                    <a
                      href={profile.canva_workspace_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Canva"
                    >
                      <Palette className="h-3.5 w-3.5 text-purple-500" />
                    </a>
                  </Button>
                )}
                {profile.google_drive_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    asChild
                  >
                    <a
                      href={profile.google_drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Google Drive"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-yellow-600" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Other Links */}
        {profile.other_links?.length > 0 && (
          <>
            <Separator className="my-3" />
            <div className="space-y-1">
              {profile.other_links.slice(0, 3).map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-300"
                >
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate">{link.label}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
                </a>
              ))}
              {profile.other_links.length > 3 && (
                <p className="text-[10px] text-muted-foreground">
                  +{profile.other_links.length - 3} mais
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Social Icon Button ──────────────────────────────────────────────────────

function SocialIconButton({
  url,
  icon,
  label,
}: {
  url: string | null
  icon: React.ReactNode
  label: string
}) {
  if (!url) {
    return (
      <div
        className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground/30"
        title={`${label} (nao configurado)`}
      >
        {icon}
      </div>
    )
  }

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <a href={url} target="_blank" rel="noopener noreferrer" title={label}>
        {icon}
      </a>
    </Button>
  )
}

// ─── View Dialog ────────────────────────────────────────────────────────

function ProfileViewDialog({
  open,
  onOpenChange,
  profile,
  onEdit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: MarketingAgentProfile | null
  onEdit: () => void
}) {
  if (!profile) return null

  const name = profile.agent?.commercial_name ?? 'Consultor'
  const photoUrl = profile.agent_profile?.profile_photo_url
  const socials = [
    { label: 'Instagram', url: profile.instagram_url, icon: <Instagram className="h-4 w-4" /> },
    { label: 'Facebook', url: profile.facebook_url, icon: <Facebook className="h-4 w-4" /> },
    { label: 'LinkedIn', url: profile.linkedin_url, icon: <Linkedin className="h-4 w-4" /> },
    { label: 'TikTok', url: profile.tiktok_url, icon: <TikTokIcon className="h-4 w-4" /> },
  ].filter((s) => s.url)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar>
              {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
              <AvatarFallback>{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div>
              <span>{name}</span>
              {profile.agent?.professional_email && (
                <p className="text-xs text-muted-foreground font-normal">{profile.agent.professional_email}</p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Social Links */}
          {socials.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Redes Sociais</h4>
              <div className="space-y-1.5">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                  >
                    {s.icon}
                    <span>{s.label}</span>
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Workspace Links */}
          {(profile.canva_workspace_url || profile.google_drive_url) && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Ferramentas de Trabalho</h4>
                <div className="space-y-1.5">
                  {profile.canva_workspace_url && (
                    <a
                      href={profile.canva_workspace_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                    >
                      <Palette className="h-4 w-4 text-purple-500" />
                      <span>Canva Workspace</span>
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
                  )}
                  {profile.google_drive_url && (
                    <a
                      href={profile.google_drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                    >
                      <FolderOpen className="h-4 w-4 text-yellow-600" />
                      <span>Google Drive</span>
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Other Links */}
          {profile.other_links?.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Outros Links</h4>
                <div className="space-y-1.5">
                  {profile.other_links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                    >
                      <Globe className="h-4 w-4" />
                      <span>{link.label}</span>
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {profile.notes && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Notas</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.notes}</p>
              </div>
            </>
          )}

          {/* Brand Voice */}
          {profile.brand_voice_notes && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Voz da Marca</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.brand_voice_notes}</p>
              </div>
            </>
          )}

          {/* No info message */}
          {!socials.length && !profile.canva_workspace_url && !profile.google_drive_url && !profile.other_links?.length && !profile.notes && !profile.brand_voice_notes && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma informação configurada. Clique em editar para adicionar dados.
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button className="rounded-full" onClick={() => { onOpenChange(false); onEdit() }}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Dialog ─────────────────────────────────────────────────────────────

function ProfileEditDialog({
  open,
  onOpenChange,
  profile,
  agents,
  existingAgentIds,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: MarketingAgentProfile | null
  agents: Agent[]
  existingAgentIds: Set<string>
  onSave: (agentId: string, data: ProfileFormData) => void
  saving: boolean
}) {
  const isNew = !profile
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [form, setForm] = useState<ProfileFormData>(EMPTY_FORM)

  // Available agents for new profiles (those without a profile yet)
  const availableAgents = useMemo(
    () => agents.filter((a) => !existingAgentIds.has(a.id)),
    [agents, existingAgentIds]
  )

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (profile) {
        setForm(profileToForm(profile))
        setSelectedAgentId(profile.agent_id)
      } else {
        setForm(EMPTY_FORM)
        setSelectedAgentId('')
      }
    }
  }, [open, profile])

  const updateField = useCallback(
    <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const addOtherLink = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      other_links: [...prev.other_links, { label: '', url: '' }],
    }))
  }, [])

  const updateOtherLink = useCallback(
    (index: number, field: keyof OtherLink, value: string) => {
      setForm((prev) => {
        const links = [...prev.other_links]
        links[index] = { ...links[index], [field]: value }
        return { ...prev, other_links: links }
      })
    },
    []
  )

  const removeOtherLink = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      other_links: prev.other_links.filter((_, i) => i !== index),
    }))
  }, [])

  const handleSubmit = () => {
    const agentId = isNew ? selectedAgentId : profile!.agent_id
    if (!agentId) {
      toast.error('Seleccione um consultor')
      return
    }
    onSave(agentId, form)
  }

  const agentName = isNew
    ? agents.find((a) => a.id === selectedAgentId)?.commercial_name
    : profile?.agent?.commercial_name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'Adicionar Consultor' : `Editar Perfil — ${agentName ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Agent Select (new only) */}
          {isNew && (
            <div className="space-y-2">
              <Label>Consultor</Label>
              {availableAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todos os consultores ja tem perfil configurado.
                </p>
              ) : (
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="rounded-full bg-muted/50 border-0">
                    <SelectValue placeholder="Seleccionar consultor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.commercial_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Social URLs */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Redes Sociais</h4>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5" /> Instagram
                </Label>
                <Input
                  placeholder="https://instagram.com/..."
                  value={form.instagram_url}
                  onChange={(e) => updateField('instagram_url', e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Facebook className="h-3.5 w-3.5" /> Facebook
                </Label>
                <Input
                  placeholder="https://facebook.com/..."
                  value={form.facebook_url}
                  onChange={(e) => updateField('facebook_url', e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                </Label>
                <Input
                  placeholder="https://linkedin.com/in/..."
                  value={form.linkedin_url}
                  onChange={(e) => updateField('linkedin_url', e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <TikTokIcon className="h-3.5 w-3.5" /> TikTok
                </Label>
                <Input
                  placeholder="https://tiktok.com/@..."
                  value={form.tiktok_url}
                  onChange={(e) => updateField('tiktok_url', e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Workspace Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Ferramentas de Trabalho</h4>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-purple-500" /> Canva Workspace
                </Label>
                <Input
                  placeholder="https://canva.com/..."
                  value={form.canva_workspace_url}
                  onChange={(e) => updateField('canva_workspace_url', e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-yellow-600" /> Google Drive
                </Label>
                <Input
                  placeholder="https://drive.google.com/..."
                  value={form.google_drive_url}
                  onChange={(e) => updateField('google_drive_url', e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Other Links */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Outros Links</h4>
              <Button variant="ghost" size="sm" onClick={addOtherLink} className="h-7 text-xs rounded-full">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar
              </Button>
            </div>
            {form.other_links.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum link adicional.</p>
            )}
            {form.other_links.map((link, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    placeholder="Ex: Website pessoal"
                    value={link.label}
                    onChange={(e) => updateOtherLink(i, 'label', e.target.value)}
                    className="rounded-full bg-muted/50 border-0"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">URL</Label>
                  <Input
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => updateOtherLink(i, 'url', e.target.value)}
                    className="rounded-full bg-muted/50 border-0"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full text-destructive hover:text-destructive"
                  onClick={() => removeOtherLink(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea
                placeholder="Notas internas sobre este consultor..."
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Voz da Marca</Label>
              <Textarea
                placeholder="Tom de comunicacao, palavras-chave, estilo preferido..."
                value={form.brand_voice_notes}
                onChange={(e) => updateField('brand_voice_notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="rounded-full" onClick={handleSubmit} disabled={saving || (isNew && !selectedAgentId)}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SocialConsultoresTab() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [profiles, setProfiles] = useState<MarketingAgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<MarketingAgentProfile | null>(null)
  const [saving, startSaving] = useTransition()

  const existingAgentIds = useMemo(
    () => new Set(profiles.map((p) => p.agent_id)),
    [profiles]
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsRes, profilesRes] = await Promise.all([
        getAgents(),
        getAgentProfiles(),
      ])
      if (agentsRes.error) toast.error(`Erro ao carregar consultores: ${agentsRes.error}`)
      if (profilesRes.error) toast.error(`Erro ao carregar perfis: ${profilesRes.error}`)
      setAgents((agentsRes.agents ?? []) as Agent[])
      setProfiles(profilesRes.profiles ?? [])
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleView = useCallback((profile: MarketingAgentProfile) => {
    router.push(`/dashboard/marketing/redes-sociais/${profile.agent_id}`)
  }, [router])

  const handleEdit = useCallback((profile: MarketingAgentProfile) => {
    setEditingProfile(profile)
    setDialogOpen(true)
  }, [])

  const handleAddNew = useCallback(() => {
    setEditingProfile(null)
    setDialogOpen(true)
  }, [])

  const handleSave = useCallback(
    (agentId: string, data: ProfileFormData) => {
      startSaving(async () => {
        // Filter out empty other_links
        const cleanedLinks = data.other_links.filter(
          (l) => l.label.trim() !== '' && l.url.trim() !== ''
        )

        const { success, error } = await upsertAgentProfile(agentId, {
          instagram_url: data.instagram_url.trim() || null,
          facebook_url: data.facebook_url.trim() || null,
          linkedin_url: data.linkedin_url.trim() || null,
          tiktok_url: data.tiktok_url.trim() || null,
          canva_workspace_url: data.canva_workspace_url.trim() || null,
          google_drive_url: data.google_drive_url.trim() || null,
          other_links: cleanedLinks,
          notes: data.notes.trim() || null,
          brand_voice_notes: data.brand_voice_notes.trim() || null,
        } as Partial<MarketingAgentProfile>)

        if (error) {
          toast.error(`Erro ao guardar: ${error}`)
          return
        }

        if (success) {
          toast.success(editingProfile ? 'Perfil actualizado com sucesso' : 'Perfil criado com sucesso')
          setDialogOpen(false)
          setEditingProfile(null)
          fetchData()
        }
      })
    },
    [editingProfile, fetchData]
  )

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            {profiles.length} {profiles.length === 1 ? 'consultor configurado' : 'consultores configurados'}
          </h3>
        </div>
        <Button size="sm" className="rounded-full" onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Consultor
        </Button>
      </div>

      {/* Grid or Empty */}
      {profiles.length === 0 ? (
        <EmptyState
          icon={User}
          title="Nenhum perfil de consultor"
          description="Adicione o primeiro consultor para gerir os perfis de redes sociais da equipa."
          action={{ label: 'Adicionar Primeiro Consultor', onClick: handleAddNew }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {profiles.map((profile) => (
            <AgentProfileCard
              key={profile.id}
              profile={profile}
              onClick={() => handleView(profile)}
              onEdit={() => handleEdit(profile)}
            />
          ))}
        </div>
      )}

      {/* Edit / Create Dialog */}
      <ProfileEditDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingProfile(null)
        }}
        profile={editingProfile}
        agents={agents}
        existingAgentIds={existingAgentIds}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
