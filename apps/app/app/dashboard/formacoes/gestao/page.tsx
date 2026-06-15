// @ts-nocheck
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, FolderOpen, BarChart3, ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { GestaoCursosTab } from '@/components/training/admin/gestao-cursos-tab'
import { GestaoCategoriasTab } from '@/components/training/admin/gestao-categorias-tab'
import { GestaoAdminPanel } from '@/components/training/admin/gestao-admin-panel'
import { CourseCreateDialog } from '@/components/training/admin/course-create-dialog'

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
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}

function GestaoContent() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { user, loading } = useUser()
  const isManagement = isManagementRole(user?.role_names ?? [])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [categoriasOpen, setCategoriasOpen] = useState(false)

  // Guard: consultor (não-gestão) não pode aceder à gestão.
  // Redirecciona silenciosamente para o catálogo.
  useEffect(() => {
    if (!loading && !isManagement) {
      router.replace('/dashboard/formacoes')
    }
  }, [loading, isManagement, router])

  if (loading || !isManagement) {
    return <GestaoSkeleton />
  }

  const sheetContentClass = cn(
    'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0 border-border/40 shadow-2xl',
    isMobile
      ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
      : 'w-full sm:rounded-l-3xl',
  )

  return (
    <div>
      {/* ─── Hero Card ─── */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-neutral-400 hover:text-white hover:bg-white/10"
              onClick={() => router.push('/dashboard/formacoes')}
              title="Voltar às Formações"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <GraduationCap className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
              Gestão
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Gestão de Formações
          </h2>
        </div>

        {/* Top-right actions — abrem em sheet, não em tab */}
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20 hover:text-white"
            onClick={() => setAdminOpen(true)}
            title="Painel Admin"
          >
            <BarChart3 className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Painel Admin</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20 hover:text-white"
            onClick={() => setCategoriasOpen(true)}
            title="Categorias"
          >
            <FolderOpen className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Categorias</span>
          </Button>
        </div>
      </div>

      {/* ─── Content: apenas a lista de Cursos ─── */}
      <div className="mt-6 pb-6">
        <GestaoCursosTab onCreateClick={() => setCreateDialogOpen(true)} />
      </div>

      {/* ─── Create Dialog ─── */}
      <CourseCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {/* ─── Painel Admin (sheet) ─── */}
      <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(sheetContentClass, !isMobile && 'data-[side=right]:sm:max-w-3xl')}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
          )}
          <SheetHeader className={cn('px-6 pb-4 border-b border-border/40 shrink-0', isMobile ? 'pt-8' : 'pt-6')}>
            <SheetTitle className="flex items-center gap-2 text-base pr-8">
              <BarChart3 className="h-5 w-5" />
              Painel Admin
            </SheetTitle>
            <SheetDescription className="text-[12px]">
              Reports, comentários, downloads e progresso dos utilizadores.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            <GestaoAdminPanel />
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── Categorias (sheet) ─── */}
      <Sheet open={categoriasOpen} onOpenChange={setCategoriasOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(sheetContentClass, !isMobile && 'data-[side=right]:sm:max-w-2xl')}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
          )}
          <SheetHeader className={cn('px-6 pb-4 border-b border-border/40 shrink-0', isMobile ? 'pt-8' : 'pt-6')}>
            <SheetTitle className="flex items-center gap-2 text-base pr-8">
              <FolderOpen className="h-5 w-5" />
              Categorias
            </SheetTitle>
            <SheetDescription className="text-[12px]">
              Gerir as categorias das formações.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            <GestaoCategoriasTab />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
