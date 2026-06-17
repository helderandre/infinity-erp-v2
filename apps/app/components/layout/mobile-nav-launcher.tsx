'use client'

/**
 * MobileNavLauncher
 * ─────────────────
 * Botão de lupa (mobile) que vive ao lado do <SidebarTrigger> no header.
 * Ao tocar, abre suavemente um overlay full-screen com TODAS as páginas do
 * ERP visíveis ao utilizador, ordenadas ALFABETICAMENTE (não por secção),
 * dispostas ao longo de uma curva tipo "roda" — inspirado no design de
 * referência. A pessoa faz scroll cima/baixo; o item mais próximo do centro
 * fica em destaque (pill + ícone colorido). Tocar num item navega e fecha.
 *
 * As páginas são derivadas dos mesmos arrays exportados pelo <AppSidebar>,
 * por isso o gating de permissões/gestão mantém-se sincronizado com o sidebar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import {
  meuEspacoItems, comunicacaoItems, crmItems, negocioItems,
  financeiroItems, infinityItems, marketingItems, estudioItems,
  recrutamentoItems, creditoItems, automationItems, techItems, bottomItems,
} from '@/components/layout/app-sidebar'

// Cada entrada recebe uma cor estável (por índice na lista ordenada) para
// recriar o visual multicolor do design de referência. As classes são
// literais para o Tailwind as detectar no build.
const PALETTE = [
  { icon: 'text-emerald-500', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/30' },
  { icon: 'text-sky-500', bg: 'bg-sky-500/15', ring: 'ring-sky-500/30' },
  { icon: 'text-orange-500', bg: 'bg-orange-500/15', ring: 'ring-orange-500/30' },
  { icon: 'text-rose-500', bg: 'bg-rose-500/15', ring: 'ring-rose-500/30' },
  { icon: 'text-fuchsia-500', bg: 'bg-fuchsia-500/15', ring: 'ring-fuchsia-500/30' },
  { icon: 'text-violet-500', bg: 'bg-violet-500/15', ring: 'ring-violet-500/30' },
  { icon: 'text-amber-500', bg: 'bg-amber-500/15', ring: 'ring-amber-500/30' },
  { icon: 'text-cyan-500', bg: 'bg-cyan-500/15', ring: 'ring-cyan-500/30' },
  { icon: 'text-indigo-500', bg: 'bg-indigo-500/15', ring: 'ring-indigo-500/30' },
  { icon: 'text-pink-500', bg: 'bg-pink-500/15', ring: 'ring-pink-500/30' },
] as const

type NavEntry = { title: string; icon: any; href: string }

export function MobileNavLauncher() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useUser()

  const [mounted, setMounted] = useState(false) // está no DOM
  const [visible, setVisible] = useState(false) // transição (opacity/scale)
  const [activeIndex, setActiveIndex] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const rafRef = useRef<number | null>(null)
  const activeIndexRef = useRef(0)

  // ─── Lista de páginas (alfabética, com permissões) ───────
  const entries = useMemo<NavEntry[]>(() => {
    // Verificação ESTRITA de permissões a partir do role já resolvido — NÃO
    // usa o `hasPermission` do hook (que devolve `true` de forma optimista
    // enquanto `loading`), para o menu nunca mostrar páginas a que o
    // utilizador não tem acesso. Admin/Broker têm todos os módulos a `true`
    // em `user.role.permissions`, por isso continuam a ver tudo. Espelha
    // exactamente o gating do <AppSidebar>.
    const perms = (user?.role?.permissions ?? {}) as Record<string, boolean>
    const can = (p?: string) => !p || perms[p] === true
    const isManagement = isManagementRole(user?.role_names ?? [])

    const out: NavEntry[] = []
    const push = (
      items: Array<{ title: string; icon: any; href: string; permission?: string; managementOnly?: boolean }>,
      gate = true,
    ) => {
      if (!gate) return
      for (const it of items) {
        if (it.managementOnly && !isManagement) continue
        if (it.permission && !can(it.permission)) continue
        out.push({ title: it.title, icon: it.icon, href: it.href })
      }
    }

    push(meuEspacoItems)
    push(comunicacaoItems)
    push(crmItems)
    push(negocioItems)
    push(financeiroItems)
    push(infinityItems)
    push(marketingItems)
    push(recrutamentoItems, can('recruitment'))
    push(estudioItems, isManagement && can('marketing'))
    push([...techItems, ...automationItems], can('settings'))
    push(creditoItems, can('credit'))
    push(bottomItems)

    // dedup por href (mantém destinos distintos)
    const seen = new Set<string>()
    const deduped = out.filter((e) => (seen.has(e.href) ? false : (seen.add(e.href), true)))
    deduped.sort((a, b) => a.title.localeCompare(b.title, 'pt'))
    return deduped
  }, [user])

  // Índice da rota actual (longest-prefix match) para centrar ao abrir.
  const initialIndex = useMemo(() => {
    let best = 0
    let bestLen = -1
    entries.forEach((e, i) => {
      const match =
        e.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname === e.href || pathname?.startsWith(`${e.href}/`)
      if (match && e.href.length > bestLen) {
        bestLen = e.href.length
        best = i
      }
    })
    return best
  }, [entries, pathname])

  // ─── Curvatura: transforma cada item em função da distância ao centro ──
  const applyCurve = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const cRect = container.getBoundingClientRect()
    const centerY = cRect.top + cRect.height / 2
    const half = cRect.height / 2 || 1
    const depth = Math.min(72, cRect.width * 0.18)

    let nearest = 0
    let nearestAbs = Infinity
    const els = itemRefs.current
    for (let i = 0; i < els.length; i++) {
      const el = els[i]
      if (!el) continue
      const r = el.getBoundingClientRect()
      const mid = r.top + r.height / 2
      let t = (mid - centerY) / half
      if (t > 1) t = 1
      else if (t < -1) t = -1
      const abs = Math.abs(t)
      // Centro puxado para a esquerda, extremos ancorados à direita (bojo).
      const shift = -depth * (1 - abs * abs)
      const scale = 1 - 0.1 * abs
      // Falloff suave: extremos mantêm-se bem legíveis (não desaparecem).
      const opacity = Math.max(0.55, 1 - 0.45 * abs)
      el.style.transform = `translateX(${shift.toFixed(1)}px) scale(${scale.toFixed(3)})`
      el.style.opacity = opacity.toFixed(3)
      if (abs < nearestAbs) {
        nearestAbs = abs
        nearest = i
      }
    }
    if (nearest !== activeIndexRef.current) {
      activeIndexRef.current = nearest
      setActiveIndex(nearest)
    }
  }, [])

  const open = useCallback(() => setMounted(true), [])
  const close = useCallback(() => setVisible(false), [])

  // Lock do scroll do body + Escape enquanto montado.
  useEffect(() => {
    if (!mounted) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [mounted, close])

  // Ao montar: centra na rota actual, aplica curva, e dispara a transição.
  useEffect(() => {
    if (!mounted) return
    const container = scrollRef.current
    const el = itemRefs.current[initialIndex]
    if (container && el) {
      container.scrollTop =
        el.offsetTop + el.clientHeight / 2 - container.clientHeight / 2
    }
    activeIndexRef.current = initialIndex
    setActiveIndex(initialIndex)
    applyCurve()
    const raf = requestAnimationFrame(() => {
      setVisible(true)
      applyCurve()
    })
    return () => cancelAnimationFrame(raf)
  }, [mounted, initialIndex, applyCurve])

  // Listeners de scroll/resize (rAF-throttled).
  useEffect(() => {
    if (!mounted) return
    const c = scrollRef.current
    if (!c) return
    const onScroll = () => {
      if (rafRef.current != null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        applyCurve()
      })
    }
    c.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', applyCurve)
    return () => {
      c.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', applyCurve)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [mounted, applyCurve])

  const handleOverlayTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target === e.currentTarget && e.propertyName === 'opacity' && !visible) {
      setMounted(false)
    }
  }

  const go = (href: string) => {
    close()
    router.push(href)
  }

  return (
    <>
      {/* Botão de lupa — só mobile, espelha o SearchCommand do desktop. */}
      <button
        type="button"
        onClick={open}
        aria-label="Pesquisar e navegar"
        className="sm:hidden inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <Search className="size-[18px]" />
      </button>

      {mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navegação"
          onTransitionEnd={handleOverlayTransitionEnd}
          className={cn(
            'fixed inset-0 z-[100] transition-opacity duration-300 ease-out',
            // Superfície OPACA, branca/cinza moderna (como a referência).
            // `bg-zinc-100` garante cobertura total mesmo que o gradient falhe.
            'bg-zinc-100 bg-gradient-to-b from-zinc-50 via-zinc-100 to-zinc-200',
            'dark:bg-zinc-950 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950',
            visible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {/* Brilho superior subtil para profundidade tipo "liquid glass". */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/70 to-transparent dark:from-white/5"
          />

          {/* Fechar */}
          <button
            type="button"
            onClick={close}
            aria-label="Fechar"
            className="absolute right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 inline-flex size-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground backdrop-blur transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>

          {/* Spine curvo decorativo + handle (lado direito) */}
          <svg
            className="pointer-events-none absolute inset-y-0 right-5 h-full w-16 text-border"
            viewBox="0 0 100 1000"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 88 0 Q 8 500 88 1000"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 h-2.5 w-11 -translate-y-1/2 rounded-full bg-foreground/80"
          />

          <div
            className={cn(
              'h-full w-full transition-transform duration-300 ease-out',
              visible ? 'scale-100' : 'scale-[0.97]',
            )}
          >
            <div
              ref={scrollRef}
              className="relative h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain pr-[26%] select-none touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                paddingTop: 'calc(50svh - 2.5rem)',
                paddingBottom: 'calc(50svh - 2.5rem)',
              }}
            >
              {entries.map((entry, i) => {
                const isActive = i === activeIndex
                const color = PALETTE[i % PALETTE.length]
                const Icon = entry.icon
                return (
                  <button
                    key={entry.href}
                    ref={(el) => {
                      itemRefs.current[i] = el
                    }}
                    type="button"
                    onClick={() => go(entry.href)}
                    style={{ willChange: 'transform, opacity' }}
                    className="flex min-h-[5rem] w-full snap-center items-center justify-end gap-3 outline-none"
                  >
                    <span
                      className={cn(
                        'whitespace-nowrap transition-all duration-200',
                        isActive
                          ? 'rounded-full border border-white/50 bg-background/70 px-4 py-1.5 text-[15px] font-semibold text-foreground shadow-md backdrop-blur-md dark:border-white/10'
                          : 'text-lg font-medium text-foreground/80',
                      )}
                    >
                      {entry.title}
                    </span>
                    <span
                      className={cn(
                        'flex size-14 shrink-0 items-center justify-center rounded-[1.35rem] border backdrop-blur-md transition-colors duration-200',
                        isActive
                          ? cn(color.bg, 'border-white/40 ring-1 shadow-md', color.ring, 'dark:border-white/10')
                          : 'border-white/40 bg-background/40 shadow-sm dark:border-white/10',
                      )}
                    >
                      <Icon className={cn('size-6', color.icon)} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
