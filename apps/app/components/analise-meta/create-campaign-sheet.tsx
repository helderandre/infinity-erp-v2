'use client'

/**
 * Criar campanha Meta (gestão) — porta o formulário do antigo /dashboard/meta-ads
 * para o CRM → Análise → Meta. Cria campanha + conjunto + criativo + anúncio, todos
 * PAUSADOS, via createMetaCampaignAction (Graph API). O consultor revê e activa
 * depois (aqui pelo botão Activar ou no Meta Ads Manager).
 */

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Target } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  createMetaCampaignAction,
  getMetaPagesAction,
  type MetaPage,
} from '@/lib/meta/graph-actions'

const OBJECTIVES = [
  { value: 'OUTCOME_LEADS', label: 'Geração de leads' },
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfego' },
  { value: 'OUTCOME_AWARENESS', label: 'Reconhecimento' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Interação' },
  { value: 'OUTCOME_SALES', label: 'Vendas' },
]

const CTA_TYPES = [
  { value: 'LEARN_MORE', label: 'Saber mais' },
  { value: 'SIGN_UP', label: 'Inscrever-se' },
  { value: 'CONTACT_US', label: 'Contactar' },
  { value: 'GET_QUOTE', label: 'Pedir orçamento' },
  { value: 'SHOP_NOW', label: 'Comprar agora' },
  { value: 'APPLY_NOW', label: 'Candidatar-se' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-foreground text-xs font-medium">{label}</label>
      {children}
    </div>
  )
}

export function CreateCampaignSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [pages, setPages] = useState<MetaPage[]>([])

  const [name, setName] = useState('')
  const [objective, setObjective] = useState('OUTCOME_LEADS')
  const [dailyBudget, setDailyBudget] = useState('5')
  const [ageMin, setAgeMin] = useState('18')
  const [ageMax, setAgeMax] = useState('65')
  const [countries, setCountries] = useState('PT')
  const [pageId, setPageId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [cta, setCta] = useState('LEARN_MORE')

  // Load Facebook pages the first time the sheet opens.
  useEffect(() => {
    if (!open || pages.length > 0) return
    let active = true
    getMetaPagesAction()
      .then((p) => {
        if (!active) return
        setPages(p)
        if (p[0] && !pageId) setPageId(p[0].id)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [open, pages.length, pageId])

  const canSubmit = name.trim() && headline.trim() && body.trim() && linkUrl.trim() && pageId

  function handleSubmit() {
    if (!canSubmit) return
    startTransition(async () => {
      const res = await createMetaCampaignAction({
        name: name.trim(),
        objective,
        dailyBudget: parseFloat(dailyBudget) || 5,
        targeting: {
          ageMin: parseInt(ageMin) || 18,
          ageMax: parseInt(ageMax) || 65,
          countries: countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
        },
        adCreative: {
          pageId,
          imageUrl: imageUrl.trim() || undefined,
          headline: headline.trim(),
          body: body.trim(),
          linkUrl: linkUrl.trim(),
          callToAction: cta,
        },
      })
      if (res.success) {
        toast.success('Campanha criada (pausada). Activa-a quando estiver pronta.')
        onCreated?.()
        onOpenChange(false)
      } else {
        toast.error(res.error ?? 'Erro ao criar campanha.')
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#1877F2]" />
            Criar campanha
          </SheetTitle>
          <p className="text-muted-foreground text-xs">
            A campanha é criada como <strong>pausada</strong>. Revê e activa depois.
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Nome da campanha">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Infinity — Lead Gen Junho" />
          </Field>

          <Field label="Objetivo">
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Orçamento diário (€)">
              <Input type="number" min="1" step="1" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
            </Field>
            <Field label="Países (ISO, vírgula)">
              <Input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="PT, ES" />
            </Field>
            <Field label="Idade mínima">
              <Input type="number" min="13" max="65" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
            </Field>
            <Field label="Idade máxima">
              <Input type="number" min="13" max="65" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
            </Field>
          </div>

          {pages.length > 0 && (
            <Field label="Página Facebook">
              <Select value={pageId} onValueChange={setPageId}>
                <SelectTrigger><SelectValue placeholder="Escolher página" /></SelectTrigger>
                <SelectContent>
                  {pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-foreground text-sm font-semibold">Criativo</h3>
            <Field label="URL da imagem (público)">
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Título">
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Ex.: Encontre a sua casa" />
            </Field>
            <Field label="Texto do anúncio">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Descrição do anúncio…" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="URL de destino">
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Call to action">
                <Select value={cta} onValueChange={setCta}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CTA_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </div>

        <div className="bg-background/80 flex items-center justify-end gap-2 border-t px-6 py-4 backdrop-blur">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !canSubmit}
            className="bg-[#1877F2] text-white hover:bg-[#1877F2]/90"
          >
            {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Target className="mr-1 h-4 w-4" />}
            Criar campanha
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
