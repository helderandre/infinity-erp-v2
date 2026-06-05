'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Plus, Phone, Mail, MessageCircle, MessageSquare, Users, StickyNote, ArrowDownRight, ArrowUpRight, Loader2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { RecruitmentCommunication, CommunicationType, CommunicationDirection } from '@/types/recruitment'
import { COMMUNICATION_TYPES, COMMUNICATION_DIRECTIONS } from '@/types/recruitment'

const ICONS: Record<CommunicationType, React.ElementType> = {
  call: Phone, email: Mail, whatsapp: MessageCircle, sms: MessageSquare, meeting: Users, note: StickyNote,
}

interface CommunicationsTimelineProps {
  communications: RecruitmentCommunication[]
  onAddCommunication: (data: { type: CommunicationType; direction: CommunicationDirection; subject: string; content: string }) => Promise<void>
  saving: boolean
}

export function CommunicationsTimeline({ communications, onAddCommunication, saving }: CommunicationsTimelineProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<CommunicationType>('call')
  const [direction, setDirection] = useState<CommunicationDirection>('outbound')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')

  const resetForm = () => { setType('call'); setDirection('outbound'); setSubject(''); setContent('') }

  const handleSave = async () => {
    await onAddCommunication({ type, direction, subject, content })
    resetForm()
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Comunicacoes</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Registar comunicacao
        </Button>
      </div>

      {communications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MessageSquare className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sem comunicacoes registadas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {communications.map((comm) => {
            const isOutbound = comm.direction === 'outbound'
            const Icon = ICONS[comm.type]
            return (
              <div
                key={comm.id}
                className={cn(
                  isOutbound
                    ? 'ml-8 rounded-2xl rounded-br-sm border border-border/20 bg-primary/5 backdrop-blur-sm p-3'
                    : 'mr-8 rounded-2xl rounded-bl-sm border border-border/20 bg-card/60 backdrop-blur-sm p-3'
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {COMMUNICATION_TYPES[comm.type].label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0 gap-0.5',
                      isOutbound ? 'border-emerald-200 text-emerald-700' : 'border-blue-200 text-blue-700'
                    )}
                  >
                    {isOutbound ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                    {COMMUNICATION_DIRECTIONS[comm.direction]}
                  </Badge>
                </div>
                {comm.subject && <p className="mb-1 text-sm font-medium">{comm.subject}</p>}
                {comm.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comm.content}</p>}
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground/70">
                  <span>{formatDistanceToNow(new Date(comm.created_at), { addSuffix: true, locale: pt })}</span>
                  {comm.user && <><span>·</span><span>{comm.user.commercial_name}</span></>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registar comunicacao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as CommunicationType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(COMMUNICATION_TYPES) as CommunicationType[]).map((k) => (
                      <SelectItem key={k} value={k}>{COMMUNICATION_TYPES[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Direccao</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as CommunicationDirection)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(COMMUNICATION_DIRECTIONS) as CommunicationDirection[]).map((k) => (
                      <SelectItem key={k} value={k}>{COMMUNICATION_DIRECTIONS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto da comunicacao..." />
            </div>
            <div className="space-y-1.5">
              <Label>Conteudo</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Detalhes..." rows={4} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
