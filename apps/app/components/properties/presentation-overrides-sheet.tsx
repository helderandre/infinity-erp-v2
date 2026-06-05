'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/kibo-ui/spinner'
import { CalendarRichEditor } from '@/components/calendar/calendar-rich-editor'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  Check,
  Image as ImageIcon,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import type { PresentationOverrides } from '@/types/presentation-overrides'
import type { PropertyMedia } from '@/types/property'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  media: PropertyMedia[]
  initial?: PresentationOverrides | null
  onSaved?: (next: PresentationOverrides) => void
}

type Form = {
  cover_title: string
  cover_eyebrow: string
  cover_media_id: string | null
  resumo_title: string
  descricao_heading: string
  descricao_body: string
  galeria_heading: string
  galeria_media_ids: string[] | null
  localizacao_heading: string
  consultor_tagline: string
  closing_headline: string
  closing_eyebrow: string
}

const EMPTY_FORM: Form = {
  cover_title: '',
  cover_eyebrow: '',
  cover_media_id: null,
  resumo_title: '',
  descricao_heading: '',
  descricao_body: '',
  galeria_heading: '',
  galeria_media_ids: null,
  localizacao_heading: '',
  consultor_tagline: '',
  closing_headline: '',
  closing_eyebrow: '',
}

function fromOverrides(ov: PresentationOverrides | null | undefined): Form {
  if (!ov) return { ...EMPTY_FORM }
  return {
    cover_title: ov.cover?.title ?? '',
    cover_eyebrow: ov.cover?.eyebrow ?? '',
    cover_media_id: ov.cover?.cover_media_id ?? null,
    resumo_title: ov.resumo?.title ?? '',
    descricao_heading: ov.descricao?.heading ?? '',
    descricao_body: ov.descricao?.body ?? '',
    galeria_heading: ov.galeria?.heading ?? '',
    galeria_media_ids: ov.galeria?.media_ids ?? null,
    localizacao_heading: ov.localizacao?.heading ?? '',
    consultor_tagline: ov.consultor?.tagline ?? '',
    closing_headline: ov.closing?.headline ?? '',
    closing_eyebrow: ov.closing?.eyebrow ?? '',
  }
}

function toOverrides(f: Form): PresentationOverrides {
  const trim = (v: string) => v.trim()
  const nz = (v: string) => (trim(v).length > 0 ? trim(v) : undefined)
  const out: PresentationOverrides = {}

  const cover = {
    title: nz(f.cover_title),
    eyebrow: nz(f.cover_eyebrow),
    cover_media_id: f.cover_media_id ?? undefined,
  }
  if (cover.title || cover.eyebrow || cover.cover_media_id) out.cover = cover

  const resumo = { title: nz(f.resumo_title) }
  if (resumo.title) out.resumo = resumo

  const descricao = { heading: nz(f.descricao_heading), body: nz(f.descricao_body) }
  if (descricao.heading || descricao.body) out.descricao = descricao

  const galeria = {
    heading: nz(f.galeria_heading),
    media_ids:
      f.galeria_media_ids && f.galeria_media_ids.length > 0
        ? f.galeria_media_ids
        : undefined,
  }
  if (galeria.heading || galeria.media_ids) out.galeria = galeria

  const loc = { heading: nz(f.localizacao_heading) }
  if (loc.heading) out.localizacao = loc

  const consultor = { tagline: nz(f.consultor_tagline) }
  if (consultor.tagline) out.consultor = consultor

  const closing = {
    headline: nz(f.closing_headline),
    eyebrow: nz(f.closing_eyebrow),
  }
  if (closing.headline || closing.eyebrow) out.closing = closing

  return out
}

export function PresentationOverridesSheet({
  open,
  onOpenChange,
  propertyId,
  media,
  initial,
  onSaved,
}: Props) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>('descricao')

  useEffect(() => {
    if (open) setForm(fromOverrides(initial))
  }, [open, initial])

  const galleryMedia = useMemo(
    () =>
      media
        .filter((m) => m.media_type !== 'planta' && m.media_type !== 'planta_3d')
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [media],
  )

  const setField = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleGalleryPick = (mediaId: string) => {
    setForm((prev) => {
      const ids = prev.galeria_media_ids ?? []
      const idx = ids.indexOf(mediaId)
      if (idx >= 0) {
        const next = [...ids]
        next.splice(idx, 1)
        return { ...prev, galeria_media_ids: next.length > 0 ? next : null }
      }
      if (ids.length >= 12) {
        toast.warning('Máximo 12 imagens na galeria.')
        return prev
      }
      return { ...prev, galeria_media_ids: [...ids, mediaId] }
    })
  }

  const clearGalleryPick = () =>
    setForm((prev) => ({ ...prev, galeria_media_ids: null }))

  const save = async () => {
    setSaving(true)
    try {
      const overrides = toOverrides(form)
      const res = await fetch(
        `/api/properties/${propertyId}/presentation-overrides`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            overrides: Object.keys(overrides).length > 0 ? overrides : null,
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao guardar')
      }
      toast.success('Conteúdo guardado.', {
        description: 'Volte a "Gerar apresentação" para refletir nos PDFs.',
      })
      onSaved?.(overrides)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setForm({ ...EMPTY_FORM })
    toast.info('Conteúdo reposto. Clique "Guardar" para confirmar.')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[88dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[720px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 sm:pt-10 gap-0">
          <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight inline-flex items-center gap-1.5">
            <Pencil className="h-4 w-4" />
            Editar conteúdo
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-0.5">
            Os campos vazios usam os dados do imóvel. Edite só o que quer
            substituir na Ficha A4 e na Apresentação 16:9.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2">
          <Section
            id="cover"
            label="Capa"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <Field
              label="Eyebrow (texto pequeno por cima do título)"
              placeholder="Ex.: Apartamento · Venda"
              value={form.cover_eyebrow}
              onChange={(v) => setField('cover_eyebrow', v)}
            />
            <Field
              label="Título"
              placeholder="Ex.: T3 com vistas para o Tejo"
              value={form.cover_title}
              onChange={(v) => setField('cover_title', v)}
            />
            <CoverImagePicker
              media={galleryMedia}
              selectedId={form.cover_media_id}
              onSelect={(id) => setField('cover_media_id', id)}
            />
          </Section>

          <Section
            id="resumo"
            label="Resumo"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <Field
              label="Título do resumo"
              placeholder="Ex.: Apartamento renovado em Belém"
              value={form.resumo_title}
              onChange={(v) => setField('resumo_title', v)}
            />
          </Section>

          <Section
            id="descricao"
            label="Descrição"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <Field
              label="Cabeçalho"
              placeholder="Ex.: Sobre este imóvel"
              value={form.descricao_heading}
              onChange={(v) => setField('descricao_heading', v)}
            />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Texto da descrição
              </Label>
              <CalendarRichEditor
                value={form.descricao_body}
                onChange={(html) => setField('descricao_body', html)}
                placeholder="Substitui a descrição do imóvel apenas na apresentação. Use a barra de ferramentas para formatar."
                className="rounded-2xl bg-background/60 [&_.ProseMirror]:min-h-[360px] [&_.ProseMirror]:max-h-[520px] [&_.ProseMirror]:overflow-y-auto"
              />
              <p className="text-[11px] text-muted-foreground">
                Deixe em branco para usar a descrição do imóvel.
              </p>
            </div>
          </Section>

          <Section
            id="galeria"
            label="Galeria"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <Field
              label="Cabeçalho"
              placeholder="Ex.: Galeria"
              value={form.galeria_heading}
              onChange={(v) => setField('galeria_heading', v)}
            />
            <GalleryImagePicker
              media={galleryMedia}
              selectedIds={form.galeria_media_ids}
              onToggle={toggleGalleryPick}
              onClear={clearGalleryPick}
            />
          </Section>

          <Section
            id="localizacao"
            label="Localização"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <Field
              label="Cabeçalho"
              placeholder="Ex.: Localização"
              value={form.localizacao_heading}
              onChange={(v) => setField('localizacao_heading', v)}
            />
          </Section>

          <Section
            id="consultor"
            label="Consultor"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <Field
              label="Tagline"
              placeholder="Ex.: Consultor Imobiliário · Infinity Group"
              value={form.consultor_tagline}
              onChange={(v) => setField('consultor_tagline', v)}
            />
          </Section>

          <Section
            id="closing"
            label="Encerramento"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <Field
              label="Eyebrow"
              placeholder="Ex.: Obrigado"
              value={form.closing_eyebrow}
              onChange={(v) => setField('closing_eyebrow', v)}
            />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Mensagem
              </Label>
              <Textarea
                value={form.closing_headline}
                onChange={(e) => setField('closing_headline', e.target.value)}
                rows={2}
                placeholder={'Vamos\nconversar?'}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Use Enter para quebra de linha. Aplica-se apenas à Apresentação 16:9.
              </p>
            </div>
          </Section>
        </div>

        <div className="shrink-0 px-6 py-3 border-t border-border/40 flex items-center gap-2 bg-background/60 backdrop-blur-xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full h-8 text-xs gap-1.5"
            onClick={reset}
            disabled={saving}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Repor
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full h-8 text-xs"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full h-8 text-xs gap-1.5"
            onClick={save}
            disabled={saving}
          >
            {saving && <Spinner className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({
  id,
  label,
  openId,
  setOpenId,
  children,
}: {
  id: string
  label: string
  openId: string | null
  setOpenId: (next: string | null) => void
  children: React.ReactNode
}) {
  const isOpen = openId === id
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(o) => setOpenId(o ? id : null)}
      className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background/60 rounded-2xl transition-colors"
        >
          <span className="text-sm font-medium flex-1">{label}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pt-1 pb-4 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function CoverImagePicker({
  media,
  selectedId,
  onSelect,
}: {
  media: PropertyMedia[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  if (media.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
        <ImageIcon className="h-3.5 w-3.5" /> Sem imagens disponíveis.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Imagem de capa
        </Label>
        {selectedId && (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onSelect(null)}
          >
            Repor automática
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {media.map((m) => {
          const isSelected = selectedId === m.id
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => onSelect(isSelected ? null : m.id)}
              className={cn(
                'relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all',
                isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent',
              )}
            >
              <Image
                src={m.url}
                alt=""
                fill
                className="object-cover"
                sizes="120px"
                unoptimized
              />
              {isSelected && (
                <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GalleryImagePicker({
  media,
  selectedIds,
  onToggle,
  onClear,
}: {
  media: PropertyMedia[]
  selectedIds: string[] | null
  onToggle: (id: string) => void
  onClear: () => void
}) {
  if (media.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
        <ImageIcon className="h-3.5 w-3.5" /> Sem imagens disponíveis.
      </div>
    )
  }
  const orderById = new Map<string, number>()
  ;(selectedIds ?? []).forEach((id, idx) => orderById.set(id, idx + 1))
  const isCustom = (selectedIds?.length ?? 0) > 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Selecção de fotos
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isCustom
              ? `${selectedIds!.length} seleccionada(s) — clique pela ordem que quer mostrar.`
              : 'Sem selecção: usa as primeiras 12 fotos do imóvel.'}
          </p>
        </div>
        {isCustom && (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClear}
          >
            Repor automática
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {media.map((m) => {
          const order = orderById.get(m.id)
          const isSelected = order !== undefined
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => onToggle(m.id)}
              className={cn(
                'relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all',
                isSelected
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-transparent opacity-90 hover:opacity-100',
              )}
            >
              <Image
                src={m.url}
                alt=""
                fill
                className="object-cover"
                sizes="120px"
                unoptimized
              />
              {isSelected && (
                <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold tabular-nums">
                  {order}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
