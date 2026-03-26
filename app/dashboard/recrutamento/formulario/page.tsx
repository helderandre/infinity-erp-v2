'use client'

import { useState } from 'react'
import { FileText, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SubmissionsTab } from '@/components/recrutamento/submissions-tab'
import { FormBuilder } from '@/components/recrutamento/form-builder'

export default function FormularioPage() {
  const [tab, setTab] = useState<'submissions' | 'editor'>('editor')

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0">
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Formulário de Entrada</h1>
          <p className="text-muted-foreground text-xs">Configuração e gestão do formulário de novos consultores</p>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-muted/40 border border-border/30">
          {([['editor', 'Editor', Settings2] as const, ['submissions', 'Submissões', FileText] as const]).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn('inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all',
                tab === key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              <Icon className="h-3 w-3" />{label}
            </button>
          ))}
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
