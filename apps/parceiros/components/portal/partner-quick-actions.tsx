'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ContactRound, UserPlus, Briefcase, ChevronRight } from 'lucide-react'
// Exact main-app sheet primitives + creation dialogs (resolved via @/ -> apps/app).
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { LeadEntryDialog } from '@/components/leads/lead-entry-dialog'
import { ContactDialog } from '@/components/leads/contact-dialog'
import { NewNegocioDialog } from '@/components/crm/new-negocio-dialog'

// Mirrors the design of the main app's QuickActions sheet, scoped to the three
// partner actions. The reused dialogs already carry the consultant-attribution
// (assigned_consultant_id) and referral commission % (referral_pct) fields.
export function PartnerQuickActions() {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [leadOpen, setLeadOpen] = useState(false)
  const [contactoOpen, setContactoOpen] = useState(false)
  const [negocioOpen, setNegocioOpen] = useState(false)

  const rows = [
    {
      key: 'lead', icon: UserPlus, tint: 'bg-sky-100 text-sky-700',
      label: 'Novo Lead', description: 'Referenciar e atribuir a um consultor (com % de comissão)',
      onClick: () => { setSheetOpen(false); setLeadOpen(true) },
    },
    {
      key: 'contacto', icon: ContactRound, tint: 'bg-violet-100 text-violet-700',
      label: 'Novo Contacto', description: 'Adicionar um contacto',
      onClick: () => { setSheetOpen(false); setContactoOpen(true) },
    },
    {
      key: 'oportunidade', icon: Briefcase, tint: 'bg-emerald-100 text-emerald-700',
      label: 'Nova Oportunidade', description: 'Criar um negócio a partir de um lead',
      onClick: () => { setSheetOpen(false); setNegocioOpen(true) },
    },
  ]

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        aria-label="Adicionar"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-800"
      >
        <Plus className="h-[18px] w-[18px]" />
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className={cn(
            'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
            'w-full sm:max-w-[440px] rounded-l-3xl',
          )}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5" />
              Ações rápidas
            </SheetTitle>
            <SheetDescription className="sr-only">Cria um lead, contacto ou oportunidade</SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
            <section className="space-y-2">
              <p className="px-1 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">Adicionar</p>
              <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden divide-y divide-border/40">
                {rows.map((row) => {
                  const Icon = row.icon
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={row.onClick}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left group"
                    >
                      <span className={cn('shrink-0 h-9 w-9 rounded-xl flex items-center justify-center', row.tint)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium leading-tight">{row.label}</span>
                        <span className="hidden sm:block text-[11px] text-muted-foreground/80 truncate mt-0.5">{row.description}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-foreground transition-colors" />
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <LeadEntryDialog open={leadOpen} onOpenChange={setLeadOpen} onComplete={() => setLeadOpen(false)} />
      <ContactDialog open={contactoOpen} onOpenChange={setContactoOpen} onComplete={() => setContactoOpen(false)} />
      <NewNegocioDialog
        open={negocioOpen}
        onOpenChange={setNegocioOpen}
        onCreated={() => { setNegocioOpen(false); router.push('/oportunidades') }}
      />
    </>
  )
}
