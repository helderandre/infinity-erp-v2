'use client'

import { useMemo, useState } from 'react'
import { FileText, ImageIcon, Images, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePropertyMedia } from '@/hooks/use-property-media'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { PropertyMediaUpload } from '@/components/properties/property-media-upload'
import { PropertyMediaGallery } from '@/components/properties/property-media-gallery'
import { DescriptionEditorCanvas } from '@/components/properties/description-editor/description-editor-canvas'
import { MediaTaskStageButton } from '@/components/processes/media-task-stage-button'

type Tab = 'descricao' | 'imagens'

/**
 * Conteúdo do passo "Descrição e Imagens do Imóvel" (passo 6) — substitui o
 * uploader genérico de documentos (que era igual ao passo "Recolha de
 * Documentos") por DUAS tabs distintas:
 *
 *   • Descrição — editor com IA (gera a partir dos dados do imóvel/CMI,
 *     assistente para alterar, e edição à mão). Reutiliza o
 *     <DescriptionEditorCanvas> já existente na página do imóvel.
 *   • Imagens — upload + galeria das fotografias do imóvel (escreve nos
 *     mesmos `dev_property_media` da página do imóvel).
 *
 * No topo fica o botão "Tarefa Media" (só gestão) — abre uma sheet a explicar
 * o que vai fazer antes de criar a tarefa de recolha de media e abrir o editor.
 */
export function DescricaoImagensStep({
  propertyId,
  processId,
}: {
  propertyId?: string | null
  processId?: string | null
}) {
  const [tab, setTab] = useState<Tab>('descricao')
  const { user } = useUser()
  const isMgmt = isManagementRole(user?.role_names ?? [])

  // Sem imóvel real (rota de pré-visualização) → nota informativa.
  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-10 text-center">
        <Images className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-sm font-medium">Descrição e imagens do imóvel</p>
        <p className="max-w-[280px] text-xs text-muted-foreground">
          Fica disponível quando o processo estiver associado a um imóvel — a
          descrição é gerada por IA a partir dos dados e as fotografias são
          carregadas aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tarefa Media — no topo, só para gestão (a criação é gated server-side). */}
      {processId && isMgmt && (
        <div className="flex justify-end">
          <MediaTaskStageButton processId={processId} introFirst />
        </div>
      )}

      {/* Selector das 2 tabs */}
      <div className="flex w-full items-center gap-1 rounded-full border border-border/30 bg-muted/50 p-1">
        <TabButton
          active={tab === 'descricao'}
          onClick={() => setTab('descricao')}
          icon={FileText}
          label="Descrição"
        />
        <TabButton
          active={tab === 'imagens'}
          onClick={() => setTab('imagens')}
          icon={ImageIcon}
          label="Imagens"
        />
      </div>

      {tab === 'descricao' ? (
        <div className="flex h-[min(70vh,620px)] flex-col">
          <DescriptionEditorCanvas propertyId={propertyId} />
        </div>
      ) : (
        <ImagensTab propertyId={propertyId} />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof FileText
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-all',
        active
          ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  )
}

/** Tab de imagens — upload + galeria das fotografias do imóvel. */
function ImagensTab({ propertyId }: { propertyId: string }) {
  const { media, refetch } = usePropertyMedia(propertyId)

  // Só fotografias (plantas/3D/vídeo vivem na tarefa Media / página do imóvel).
  const photos = useMemo(
    () =>
      media.filter(
        (m) =>
          m.media_type !== 'planta' &&
          m.media_type !== 'planta_3d' &&
          m.media_type !== 'video'
      ),
    [media]
  )

  return (
    <div className="space-y-4">
      <PropertyMediaUpload propertyId={propertyId} onUploadComplete={refetch} />

      {photos.length > 0 ? (
        <PropertyMediaGallery
          propertyId={propertyId}
          media={photos}
          onMediaChange={refetch}
        />
      ) : (
        <p className="flex items-center justify-center gap-1.5 px-4 py-6 text-center text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Ainda sem fotografias — arrasta ou carrega acima para começar.
        </p>
      )}
    </div>
  )
}
