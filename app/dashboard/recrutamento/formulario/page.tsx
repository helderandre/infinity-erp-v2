'use client'

import { useState } from 'react'
import { FileText, Settings2, Eye, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { SubmissionsTab } from '@/components/recrutamento/submissions-tab'
import { FormBuilder } from '@/components/recrutamento/form-builder'

export default function FormularioPage() {
  const [tab, setTab] = useState<'submissions' | 'editor'>('submissions')

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900 mx-6 mt-6 shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Formulário de Entrada</h2>
              <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">Configuração e gestão do formulário de novos consultores</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-neutral-400 hover:text-white hover:bg-white/10 gap-1.5 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/entryform`)
                  toast.success('Link copiado!')
                }}
              >
                <Copy className="h-3 w-3" />Copiar link
              </Button>
              <Button
                size="sm"
                className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25 gap-1.5 text-xs"
                onClick={() => window.open('/entryform', '_blank')}
              >
                <ExternalLink className="h-3 w-3" />Abrir formulário
              </Button>
            </div>
          </div>

          {/* Tab selector inside hero */}
          <div className="mt-5 inline-flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
            {([['submissions', 'Submissões', FileText] as const, ['editor', 'Editor', Settings2] as const]).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300',
                  tab === key
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'editor' && <FormBuilder />}
        {tab === 'submissions' && (
          <div className="p-6 overflow-y-auto h-full">
            <SubmissionsTab />
          </div>
        )}
      </div>
    </div>
  )
}
