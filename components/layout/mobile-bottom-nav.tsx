'use client'

import { usePathname, useRouter } from 'next/navigation'
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
  marketingItems, automationItems,
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
  { key: 'comunicacao', label: 'Comunic.', icon: MessageCircle, items: comunicacaoItems, prefixes: ['/dashboard/comunicacao', '/dashboard/whatsapp', '/dashboard/email', '/dashboard/automacao/fluxos'] },
  { key: 'infinity', label: 'Infinity', icon: Infinity, items: infinityItems, prefixes: ['/dashboard/consultores', '/dashboard/parceiros', '/dashboard/formacoes', '/dashboard/acessos'] },
  { key: 'crm', label: 'CRM', icon: ContactRound, items: crmItems, prefixes: ['/dashboard/crm', '/dashboard/leads', '/dashboard/acompanhamentos'] },
  { key: 'negocio', label: 'Negócio', icon: Briefcase, items: negocioItems, prefixes: ['/dashboard/imoveis', '/dashboard/processos'] },
  { key: 'financeiro', label: 'Financeiro', icon: Euro, items: financeiroItems, prefixes: ['/dashboard/comissoes'] },
  { key: 'credito', label: 'Crédito', icon: Landmark, items: creditoItems, prefixes: ['/dashboard/credito'] },
  { key: 'recrutamento', label: 'Recrut.', icon: GraduationCap, items: recrutamentoItems, prefixes: ['/dashboard/recrutamento'] },
  { key: 'loja', label: 'Loja', icon: Store, items: lojaItems, prefixes: ['/dashboard/marketing', '/dashboard/encomendas'] },
  { key: 'marketing', label: 'Marketing', icon: Megaphone, items: marketingItems, prefixes: ['/dashboard/crm/analytics', '/dashboard/crm/campanhas', '/dashboard/meta-ads', '/dashboard/instagram', '/dashboard/marketing/redes-sociais'] },
  { key: 'automacao', label: 'Automação', icon: Bot, items: automationItems, prefixes: ['/dashboard/automacao'] },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const [sectionPopupOpen, setSectionPopupOpen] = useState(false)

  // Publish the actual rendered nav height as a CSS variable so full-bleed
  // pages (like /dashboard/whatsapp) can reserve the exact space and sit
  // flush against the nav with no white gap.
  useEffect(() => {
    if (!rootRef.current) return
    const el = rootRef.current
    const apply = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--mobile-nav-height', `${h}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      document.documentElement.style.removeProperty('--mobile-nav-height')
    }
  }, [])

  // Detect current section from pathname
  const currentSectionKey = useMemo(() => {
    if (!pathname) return 'meu_espaco'
    for (const section of SECTIONS) {
      if (section.prefixes.some(p => pathname.startsWith(p))) return section.key
    }
    return 'meu_espaco'
  }, [pathname])

  const [selectedSectionKey, setSelectedSectionKey] = useState(currentSectionKey)
  // `centeredKey` = whichever item is currently under the strip's center cursor
  // (scroll-driven, pending). Commits to `selectedSectionKey` only on tap.
  const [centeredKey, setCenteredKey] = useState(currentSectionKey)

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

  // On open: reset the centered cursor to the committed section and scroll it
  // into the middle of the strip. Deps only on sectionPopupOpen so state
  // updates during scroll don't re-trigger scrollIntoView.
  useEffect(() => {
    if (!sectionPopupOpen || !stripRef.current) return
    setCenteredKey(selectedSectionKey)
    const el = stripRef.current.querySelector<HTMLElement>(`[data-section-key="${selectedSectionKey}"]`)
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionPopupOpen])

  // Roulette cursor: debounced scroll handler updates `centeredKey` (pending
  // highlight) once the strip settles. Commit happens on tap, not here.
  useEffect(() => {
    if (!sectionPopupOpen) return
    const strip = stripRef.current
    if (!strip) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const update = () => {
      const rect = strip.getBoundingClientRect()
      const center = rect.left + rect.width / 2
      let closest: string | null = null
      let min = Infinity
      strip.querySelectorAll<HTMLElement>('[data-section-key]').forEach(btn => {
        const r = btn.getBoundingClientRect()
        const d = Math.abs(r.left + r.width / 2 - center)
        if (d < min) { min = d; closest = btn.dataset.sectionKey || null }
      })
      if (closest) setCenteredKey(closest)
    }
    const onScroll = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(update, 80)
    }
    strip.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      strip.removeEventListener('scroll', onScroll)
      if (timer) clearTimeout(timer)
    }
  }, [sectionPopupOpen])

  if (!pathname?.startsWith('/dashboard')) return null

  // Limit items shown (max 4 + the section button = 5 slots)
  const visibleItems = currentSection.items.slice(0, 4)

  return (
    <div
      ref={rootRef}
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden overflow-visible px-3 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2"
    >
      {/* Section picker — horizontal scrollable strip attached above the nav */}
      {sectionPopupOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setSectionPopupOpen(false)} />
          {/* Strip — roulette: scroll to position, tap to commit */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 w-[288px] max-w-[calc(100%-1.5rem)] animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="bg-neutral-900/90 backdrop-blur-xl rounded-3xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.45)] overflow-hidden">
              <div
                ref={stripRef}
                className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory py-2 [padding-inline:calc((100%-54px)/2)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent_0,black_32px,black_calc(100%-32px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_32px,black_calc(100%-32px),transparent_100%)]"
                style={{ scrollbarWidth: 'none' }}
              >
                {SECTIONS.map(s => {
                  const Icon = s.icon
                  const isSelected = s.key === selectedSectionKey
                  const isCentered = s.key === centeredKey
                  return (
                    <button
                      key={s.key}
                      data-section-key={s.key}
                      onClick={() => {
                        setSelectedSectionKey(s.key)
                        setSectionPopupOpen(false)
                        const href = s.items[0]?.href
                        if (href) router.push(href)
                      }}
                      className="shrink-0 snap-center flex flex-col items-center gap-1 w-[54px] active:scale-95"
                    >
                      <div
                        className={cn(
                          'h-9 w-9 rounded-full flex items-center justify-center transition-[transform,background-color,color,box-shadow] duration-200 ease-out',
                          isCentered && 'scale-[1.15] shadow-[0_4px_14px_rgba(0,0,0,0.4)]',
                          isSelected
                            ? 'bg-white text-neutral-900'
                            : isCentered
                              ? 'bg-white/55 text-white'
                              : 'bg-white/15 text-white/70',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-medium leading-tight text-center transition-[color,opacity] duration-200',
                          isCentered ? 'text-white' : 'text-white/50',
                        )}
                      >
                        {s.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom pill — glassmorphic black, shrinks to content */}
      <div className="relative z-10 w-fit max-w-full mx-auto flex items-center gap-1 p-1 rounded-full bg-neutral-900/75 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
        {/* Section circle (left) */}
        <button
          onClick={() => setSectionPopupOpen(v => !v)}
          aria-label={currentSection.label}
          title={currentSection.label}
          className="shrink-0 h-11 w-11 rounded-full bg-white flex items-center justify-center shadow-sm transition-transform active:scale-95"
        >
          <SectionIcon className="h-[18px] w-[18px] text-neutral-900" />
        </button>

        {/* Page items */}
        <div className="flex items-center gap-1">
          {visibleItems.map((item, idx) => {
            const Icon = item.icon
            const isActive = idx === activeItemIndex
            return (
              <Link
                key={`${item.href}-${idx}`}
                href={item.href}
                aria-label={item.title}
                title={item.title}
                onClick={() => setSectionPopupOpen(false)}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 h-11 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                  isActive
                    ? 'px-4 bg-white text-neutral-900 shadow-sm'
                    : 'w-11 text-white/75 hover:text-white active:bg-white/10',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className={cn(isActive ? 'inline' : 'hidden')}>{item.title}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
