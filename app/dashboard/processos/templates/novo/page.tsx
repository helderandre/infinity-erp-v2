'use client'

import { useRouter } from 'next/navigation'
import { TemplateBuilder } from '@/components/templates/template-builder'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NovoTemplatePage() {
  const router = useRouter()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-4 shrink-0 px-4 pt-4 md:px-6 md:pt-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/processos/templates')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Template</h1>
          <p className="text-muted-foreground">
            Crie um novo template de processo documental
          </p>
        </div>
      </div>

      <TemplateBuilder mode="create" />
    </div>
  )
}
