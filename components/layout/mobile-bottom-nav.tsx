'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ContactRound, Briefcase, Euro, Landmark,
  GraduationCap, Store, Megaphone, Bot, MessageCircle, Infinity,
} from 'lucide-react'
import {
  meuEspacoItems, comunicacaoItems, crmItems, negocioItems, infinityItems,
  financeiroItems, creditoItems, recrutamentoItems, lojaItems,
  digitalItems, automationItems,
} from '@/components/layout/app-sidebar'
import type { LucideIcon } from 'lucide-react'

// ─── Section definitions (mirrors sidebar groups) ───────────────────────────

interface Section {
  key: string
  label: string
  icon: LucideIcon
  items: { title: string; icon: any; href: string }[]
  prefixes: string[] // path prefixes that belong to this section
}

const SECTIONS: Section[] = [
  { key: 'meu_espaco', label: 'Espaço', icon: LayoutDashboard, items: meuEspacoItems, prefixes: ['/dashboard/calendario', '/dashboard/objetivos'] },
  { key: 'comunicacao', label: 'Comunic.', icon: MessageCircle, items: comunicacaoItems, prefixes: ['/dashboard/whatsapp', '/dashboard/email', '/dashboard/automacao/fluxos'] },
  { key: 'infinity', label: 'Infinity', icon: Infinity, items: infinityItems, prefixes: ['/dashboard/consultores', '/dashboard/parceiros', '/dashboard/formacoes', '/dashboard/acessos'] },
  { key: 'crm', label: 'CRM', icon: ContactRound, items: crmItems, prefixes: ['/dashboard/crm', '/dashboard/leads', '/dashboard/acompanhamentos'] },
  { key: 'negocio', label: 'Negócio', icon: Briefcase, items: negocioItems, prefixes: ['/dashboard/imoveis', '/dashboard/processos'] },
  { key: 'financeiro', label: 'Financeiro', icon: Euro, items: financeiroItems, prefixes: ['/dashboard/comissoes'] },
  { key: 'credito', label: 'Crédito', icon: Landmark, items: creditoItems, prefixes: ['/dashboard/credito'] },
  { key: 'recrutamento', label: 'Recrut.', icon: GraduationCap, items: recrutamentoItems, prefixes: ['/dashboard/recrutamento'] },
  { key: 'loja', label: 'Loja', icon: Store, items: lojaItems, prefixes: ['/dashboard/marketing', '/dashboard/encomendas'] },
  { key: 'digital', label: 'Digital', icon: Megaphone, items: digitalItems, prefixes: ['/dashboard/meta-ads', '/dashboard/instagram'] },
  { key: 'automacao', label: 'Automação', icon: Bot, items: automationItems, prefixes: ['/dashboard/automacao'] },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function MobileBottomNav() {
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement>(null)
  const [sectionPopupOpen, setSectionPopupOpen] = useState(false)
  const [bubbleStyle, setBubbleStyle] = useState({ left: 0, width: 0 })

  // Detect current section from pathname
  const currentSectionKey = useMemo(() => {
    if (!pathname) return 'meu_espaco'
    for (const section of SECTIONS) {
      if (section.prefixes.some(p => pathname.startsWith(p))) return section.key
    }
    return 'meu_espaco'
  }, [pathname])

  const [selectedSectionKey, setSelectedSectionKey] = useState(currentSectionKey)

  // Sync selected section when navigating
  useEffect(() => { setSelectedSectionKey(currentSectionKey) }, [currentSectionKey])

  const currentSection = SECTIONS.find(s => s.key === selectedSectionKey) || SECTIONS[0]
  const SectionIcon = currentSection.icon

  // Active item index within the current section
  const activeItemIndex = useMemo(() => {
    let bestIdx = -1
    let bestLen = 0
    currentSection.items.forEach((item, idx) => {
      const href = item.href.split('?')[0]
      if (pathname?.startsWith(href) && href.length > bestLen) {
        bestLen = href.length
        bestIdx = idx
      }
    })
    // Also check exact /dashboard match for meu_espaco
    if (currentSection.key === 'meu_espaco' && pathname === '/dashboard') bestIdx = 0
    return bestIdx
  }, [pathname, currentSection])

  // Update bubble position
  useEffect(() => {
    if (!navRef.current) return
    const buttons = navRef.current.querySelectorAll<HTMLElement>('[data-nav-item]')
    const activeBtn = buttons[activeItemIndex]
    if (activeBtn) {
      const navRect = navRef.current.getBoundingClientRect()
      const btnRect = activeBtn.getBoundingClientRect()
      setBubbleStyle({
        left: btnRect.left - navRect.left,
        width: btnRect.width,
      })
    } else {
      setBubbleStyle({ left: 0, width: 0 })
    }
  }, [activeItemIndex, currentSection])

  const handleSectionSelect = useCallback((key: string) => {
    setSelectedSectionKey(key)
    setSectionPopupOpen(false)
  }, [])

  if (!pathname?.startsWith('/dashboard')) return null

  // Limit items shown (max 4 + the section button = 5 slots)
  const visibleItems = currentSection.items.slice(0, 4)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden overflow-visible">
      {/* Section picker popup */}
      {sectionPopupOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setSectionPopupOpen(false)} />
          {/* Popup */}
          <div className="absolute bottom-full left-2 right-2 mb-2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="bg-card/95 backdrop-blur-xl rounded-2xl border border-border/30 shadow-2xl p-2 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-4 gap-1">
                {SECTIONS.map(s => {
                  const Icon = s.icon
                  const isActive = s.key === selectedSectionKey
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleSectionSelect(s.key)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl p-2.5 transition-colors',
                        isActive
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'text-muted-foreground hover:bg-muted/50 active:bg-muted'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[9px] font-medium leading-tight text-center">{s.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div className="relative z-10 bg-background/90 backdrop-blur-xl border-t border-border/30 px-1 pb-[env(safe-area-inset-bottom)]">
        <div ref={navRef} className="relative flex items-center py-1.5">
          {/* Sliding bubble indicator — white with shadow */}
          {activeItemIndex >= 0 && bubbleStyle.width > 0 && (
            <div
              className="absolute top-1 rounded-2xl bg-white dark:bg-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out"
              style={{
                left: bubbleStyle.left,
                width: bubbleStyle.width,
                height: 'calc(100% - 8px)',
              }}
            />
          )}

          {/* Section switcher button (always first, on the left) */}
          <button
            onClick={() => setSectionPopupOpen(v => !v)}
            className={cn(
              'relative z-10 flex flex-col items-center gap-0.5 px-2.5 py-1.5 shrink-0',
              sectionPopupOpen ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <div className={cn(
              'h-7 w-7 rounded-xl flex items-center justify-center transition-colors duration-200',
              'bg-neutral-900 dark:bg-white'
            )}>
              <SectionIcon className="h-3.5 w-3.5 text-white dark:text-neutral-900" />
            </div>
            <span className="text-[8px] font-semibold truncate max-w-[48px]">{currentSection.label}</span>
          </button>

          {/* Page items */}
          {visibleItems.map((item, idx) => {
            const Icon = item.icon
            const isActive = idx === activeItemIndex
            return (
              <Link
                key={`${item.href}-${idx}`}
                href={item.href}
                data-nav-item
                className={cn(
                  'relative z-10 flex flex-1 flex-col items-center gap-0.5 px-1 py-1.5 rounded-2xl transition-colors duration-300 min-w-0',
                  isActive
                    ? 'text-neutral-900 dark:text-white'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[8px] font-medium truncate max-w-[52px]">{item.title}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
