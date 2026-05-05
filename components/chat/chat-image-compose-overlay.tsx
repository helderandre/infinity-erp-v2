'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'

interface ChatImageComposeOverlayProps {
  /** Lista filtrada apenas com imagens (mime image/*). O caller é
   * responsável pelo filtro — assim o overlay não tem de saber o que
   * está fora dele. */
  images: File[]
  /** Remove uma imagem da lista. O índice é relativo ao array `images`
   * passado, não à lista global de anexos. */
  onRemove: (index: number) => void
  /** Cancela completamente — limpa todas as imagens. Usado pelo botão X
   * do topo. */
  onClearAll: () => void
  /** Quando true mostra spinner sobreposto e desactiva os controlos.
   * Ligado durante o submit da mensagem para feedback visual claro. */
  isUploading?: boolean
}

/**
 * Overlay que cobre a área das mensagens enquanto há imagens anexadas
 * ao composer — pattern WhatsApp. Contexto:
 *   - Mostra a imagem em foco em grande (object-contain) em fundo
 *     escuro neutro, simulando uma "lightbox" de pré-envio.
 *   - Faixa de thumbnails em baixo para alternar focus quando há mais
 *     do que uma imagem; cada thumbnail tem o seu próprio botão X para
 *     remover apenas aquela imagem.
 *   - O botão X grande no topo cancela todas as imagens (e fecha o
 *     overlay).
 *
 * Mantém-se "burro" — não conhece o input/caption nem o submit. O
 * caption é escrito no input do footer normal do chat e o envio é
 * feito pelo botão de avião — exactamente o mesmo flow que sem o
 * overlay (a única diferença é a apresentação visual).
 *
 * Os blob URLs são revogados quando o ficheiro é removido ou o
 * overlay desmonta — sem leak de memória.
 */
export function ChatImageComposeOverlay({
  images,
  onRemove,
  onClearAll,
  isUploading,
}: ChatImageComposeOverlayProps) {
  const [focusedIdx, setFocusedIdx] = useState(0)

  // Gera blob URLs uma vez por File. useMemo + cleanup via useEffect
  // garante que cada URL é revogado quando o array muda ou o
  // componente desmonta.
  const urls = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images])
  useEffect(() => {
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [urls])

  // Garante que o focus fica num índice válido se a imagem em foco
  // for removida (ou se mais imagens forem adicionadas e o utilizador
  // ainda estiver no índice 0).
  useEffect(() => {
    if (focusedIdx >= images.length) {
      setFocusedIdx(Math.max(0, images.length - 1))
    }
  }, [focusedIdx, images.length])

  if (images.length === 0) return null

  const focused = images[focusedIdx] ?? images[0]
  const focusedUrl = urls[focusedIdx] ?? urls[0]
  const showStrip = images.length > 1

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-zinc-950/95 backdrop-blur-sm">
      {/* Top bar — só com botão X (sem opções extra; o utilizador
          escreve a caption no input do footer normal). */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={onClearAll}
          disabled={isUploading}
          aria-label="Cancelar imagens"
          className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15 transition-colors disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-xs text-white/70 font-medium">
          {images.length === 1
            ? focused.name
            : `${focusedIdx + 1} de ${images.length}`}
        </span>
        {/* Spacer para manter o nome centrado. */}
        <div className="w-9" />
      </div>

      {/* Preview principal — object-contain para nunca cortar a imagem,
          fundo zinc-950 para fazer a foto destacar. */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-6 pb-2 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={focusedUrl}
          src={focusedUrl}
          alt={focused.name}
          className={`max-h-full max-w-full object-contain transition-opacity ${isUploading ? 'opacity-60' : ''}`}
        />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 rounded-full px-4 py-2 flex items-center gap-2 text-white text-sm">
              <Spinner className="h-4 w-4" />
              <span>A enviar…</span>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail strip — só visível com >1 imagem. Cada thumb tem o
          seu próprio X. A imagem em foco fica com ring para destacar. */}
      {showStrip && (
        <div className="px-4 py-3 shrink-0 flex gap-2 overflow-x-auto">
          {images.map((file, i) => {
            const isFocused = i === focusedIdx
            return (
              <div key={`${file.name}-${i}`} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setFocusedIdx(i)}
                  disabled={isUploading}
                  className={`h-14 w-14 rounded-md overflow-hidden border-2 transition-all ${
                    isFocused
                      ? 'border-white shadow-lg'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  aria-label={`Pré-visualizar ${file.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urls[i]}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                </button>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    aria-label={`Remover ${file.name}`}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-white text-zinc-900 shadow border border-zinc-200 hover:bg-zinc-100 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
