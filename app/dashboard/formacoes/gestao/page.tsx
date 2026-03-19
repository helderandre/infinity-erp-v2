// @ts-nocheck
'use client'

import { Suspense, useState } from 'react'
import {
  GraduationCap, FolderOpen, Route, BarChart3,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { GestaoCursosTab } from '@/components/training/admin/gestao-cursos-tab'
import { GestaoCategoriasTab } from '@/components/training/admin/gestao-categorias-tab'
import { GestaoPercursosTab } from '@/components/training/admin/gestao-percursos-tab'
import { GestaoAdminPanel } from '@/components/training/admin/gestao-admin-panel'
import { CourseCreateDialog } from '@/components/training/admin/course-create-dialog'

const GESTAO_TABS = [
  { key: 'cursos', label: 'Cursos', icon: GraduationCap },
  { key: 'categorias', label: 'Categorias', icon: FolderOpen },
  { key: 'percursos', label: 'Percursos', icon: Route },
  { key: 'admin', label: 'Painel Admin', icon: BarChart3 },
] as const

type GestaoTabKey = (typeof GESTAO_TABS)[number]['key']

export default function GestaoFormacoesPage() {
  return (
    <Suspense fallback={<GestaoSkeleton />}>
      <GestaoContent />
    </Suspense>
  )
}

function GestaoSkeleton() {
  return (
    <div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-10 w-80 rounded-full" />
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}

function GestaoContent() {
  const [mainTab, setMainTab] = useState<GestaoTabKey>('cursos')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  return (
    <div>
      {/* ─── Hero Card ─── */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
              Gestão
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Gestão de Formações
          </h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Criar, editar e gerir cursos, categorias, percursos e analytics
          </p>
        </div>
      </div>

      {/* ─── Main Tab Navigation ─── */}
      <div className="mt-6 flex items-center gap-3">
        <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          {GESTAO_TABS.map((tab) => {
            const isActive = mainTab === tab.key
            const Icon = tab.icon
            return (
              <button
                type="button"
                key={tab.key}
                onClick={() => setMainTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="mt-6 pb-6">
        {mainTab === 'cursos' && (
          <GestaoCursosTab onCreateClick={() => setCreateDialogOpen(true)} />
        )}
        {mainTab === 'categorias' && <GestaoCategoriasTab />}
        {mainTab === 'percursos' && <GestaoPercursosTab />}
        {mainTab === 'admin' && <GestaoAdminPanel />}
      </div>

      {/* ─── Create Dialog ─── */}
      <CourseCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  )
}
