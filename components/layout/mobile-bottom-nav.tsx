'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  prefixes: string[]
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

  // Publish the rendered nav height as a CSS variable so full-bleed pages
  // (like /dashboard/whatsapp) can reserve the exact space.
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

  const currentSectionKey = useMemo(() => {
    if (!pathname) return 'meu_espaco'
    for (const section of SECTIONS) {
      if (section.prefixes.some(p => pathname.startsWith(p))) return section.key
    }
    return 'meu_espaco'
  }, [pathname])

  const [selectedSectionKey, setSelectedSectionKey] = useState(currentSectionKey)
  useEffect(() => { setSelectedSectionKey(currentSectionKey) }, [currentSectionKey])

  const currentSection = SECTIONS.find(s => s.key === selectedSectionKey) || SECTIONS[0]
  const SectionIcon = currentSection.icon

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
    if (currentSection.key === 'meu_espaco' && pathname === '/dashboard') bestIdx = 0
    return bestIdx
  }, [pathname, currentSection])

  // Read latest selected key inside the ref callback without rebinding it.
  const selectedKeyRef = useRef(selectedSectionKey)
  selectedKeyRef.current = selectedSectionKey

  // Ref callback that centers the selected section as soon as the strip
  // mounts — synchronously, during the commit phase, BEFORE Framer Motion's
  // layout measurements run. A useEffect would fire after Framer measures,
  // leaving the fly animation pointed at the pre-scroll position.
  const stripRefCallback = useCallback((node: HTMLDivElement | null) => {
    const wasNull = stripRef.current === null
    stripRef.current = node
    if (node && wasNull) {
      const el = node.querySelector<HTMLElement>(`[data-section-key="${selectedKeyRef.current}"]`)
      if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' })
    }
  }, [])

  if (!pathname?.startsWith('/dashboard')) return null

  const visibleItems = currentSection.items.slice(0, 4)

  return (
    <div
      ref={rootRef}
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden overflow-visible px-3 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2"
    >
      {sectionPopupOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSectionPopupOpen(false)} />
      )}

      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative z-50 w-fit max-w-full mx-auto flex items-center gap-1 p-1 rounded-full bg-neutral-900/75 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
      >
        {!sectionPopupOpen && (
          <motion.button
            layoutId="section-bubble"
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            onClick={() => setSectionPopupOpen(true)}
            aria-label={currentSection.label}
            title={currentSection.label}
            className="shrink-0 h-11 w-11 rounded-full bg-white flex items-center justify-center shadow-sm"
          >
            <SectionIcon className="h-[18px] w-[18px] text-neutral-900" />
          </motion.button>
        )}

        {sectionPopupOpen ? (
          <div
            ref={stripRefCallback}
            className="w-[240px] flex items-center gap-1 overflow-x-auto snap-x snap-mandatory [padding-inline:100px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%-14px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%-14px),transparent_100%)]"
            style={{ scrollbarWidth: 'none' }}
          >
            {SECTIONS.map(s => {
              const Icon = s.icon
              const isSelected = s.key === selectedSectionKey
              const handleTap = () => {
                if (s.key === selectedSectionKey) {
                  // Tapped the already-selected section → just close; bubble
                  // flies back to the left with current icon.
                  setSectionPopupOpen(false)
                  return
                }
                // Two-phase update: first let the bubble become the tapped
                // section's pill (via layoutId transfer within the open strip),
                // then close the picker on the next frame so the bubble flies
                // from the tapped position to the left.
                setSelectedSectionKey(s.key)
                requestAnimationFrame(() => {
                  setSectionPopupOpen(false)
                  const href = s.items[0]?.href
                  if (href) router.push(href)
                })
              }
              const commonClass = cn(
                'shrink-0 snap-center inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-xs font-medium whitespace-nowrap',
                isSelected
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'bg-white/15 text-white/80 transition-colors duration-200 active:scale-95',
              )
              if (isSelected) {
                return (
                  <motion.button
                    key={s.key}
                    layoutId="section-bubble"
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    data-section-key={s.key}
                    onClick={handleTap}
                    aria-label={s.label}
                    title={s.label}
                    className={commonClass}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{s.label}</span>
                  </motion.button>
                )
              }
              return (
                <button
                  key={s.key}
                  data-section-key={s.key}
                  onClick={handleTap}
                  aria-label={s.label}
                  title={s.label}
                  className={commonClass}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{s.label}</span>
                </button>
              )
            })}
          </div>
        ) : (
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
        )}
      </motion.div>
    </div>
  )
}
