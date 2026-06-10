'use client'

import { useState } from 'react'
import { Upload, Loader2, CheckCircle2, X, Video } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { uploadTrainingVideo, type VideoProvider } from '@/lib/training/upload-video'

export interface IntroVideoValue {
  url: string
  durationSeconds: number | null
  fileName: string
  provider: VideoProvider
}

interface IntroVideoUploadProps {
  value: IntroVideoValue | null
  onChange: (value: IntroVideoValue | null) => void
}

/**
 * Optional "intro video" uploader for the course-create flow. Streams the file
 * to R2 (via `/api/training/videos/upload`) and reports the resulting public
 * URL + duration to the parent. The parent submits these as `intro_video`, and
 * the courses API turns it into a first module + video lesson.
 */
export function IntroVideoUpload({ value, onChange }: IntroVideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setProgress(0)
    try {
      const result = await uploadTrainingVideo(file, setProgress)
      onChange({
        url: result.url,
        durationSeconds: result.durationSeconds,
        fileName: file.name,
        provider: result.provider,
      })
      toast.success(
        result.processing
          ? 'Vídeo enviado — a processar qualidade adaptativa (alguns minutos).'
          : 'Vídeo enviado com sucesso'
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar o vídeo')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/50 p-4">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground/80">
          Vídeo de introdução (opcional)
        </p>
      </div>

      {value?.url ? (
        <div className="flex items-center gap-2 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate text-emerald-700 dark:text-emerald-400">
            {value.fileName || 'Vídeo enviado'}
          </span>
          <button
            type="button"
            title="Remover vídeo"
            onClick={() => onChange(null)}
            className="ml-auto rounded-full p-1 text-emerald-700/70 transition-colors hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-emerald-900/40"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:border-primary/40 hover:bg-muted/30',
            isUploading && 'pointer-events-none opacity-60'
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">A enviar... {progress}%</span>
              <Progress value={progress} className="h-1.5 w-full max-w-[240px]" />
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Clique para seleccionar um vídeo
              </span>
              <span className="text-xs text-muted-foreground/60">
                MP4, WebM, MOV — Máx. 500MB
              </span>
            </>
          )}
          <input
            type="file"
            accept=".mp4,.webm,.mov,.avi,.mkv"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
              e.target.value = ''
            }}
          />
        </label>
      )}

      <p className="text-[11px] text-muted-foreground/70">
        Ao criar a formação, o vídeo fica como primeira lição (módulo
        &quot;Introdução&quot;). Pode adicionar mais lições depois no editor.
      </p>
    </div>
  )
}
