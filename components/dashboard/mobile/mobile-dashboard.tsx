'use client'

import { useEffect, useState } from 'react'
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import type { UserWithRole } from '@/hooks/use-user'
import type { AgentDashboard } from '@/types/financial'
import { getAgentDashboard } from '@/app/dashboard/comissoes/actions'
import { WelcomeCard } from './welcome-card'
import { ContactosCard } from './contactos-card'
import { TodayCard } from './today-card'
import { AngariacoesFaturacaoCard } from './angariacoes-faturacao-card'
import { MargemCard } from './margem-card'

interface MobileDashboardProps {
  user: UserWithRole
}

export function MobileDashboard({ user }: MobileDashboardProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)

  const [agentData, setAgentData] = useState<AgentDashboard | null>(null)
  const [agentLoading, setAgentLoading] = useState(true)

  useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  useEffect(() => {
    let cancelled = false
    getAgentDashboard(user.id)
      .then((res) => {
        if (cancelled) return
        if (!res.error) {
          const { error: _err, ...rest } = res
          setAgentData(rest as AgentDashboard)
        }
      })
      .catch((err) => {
        console.error('getAgentDashboard failed:', err)
      })
      .finally(() => {
        if (!cancelled) setAgentLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <Carousel
        setApi={setApi}
        opts={{ align: 'start', loop: false, containScroll: 'trimSnaps' }}
        className="w-full"
      >
        <CarouselContent>
          <CarouselItem className="basis-full">
            <WelcomeCard user={user} />
          </CarouselItem>
          <CarouselItem className="basis-full">
            <ContactosCard userId={user.id} fillViewport />
          </CarouselItem>
          <CarouselItem className="basis-full">
            <TodayCard userId={user.id} fillViewport />
          </CarouselItem>
          <CarouselItem className="basis-full">
            <AngariacoesFaturacaoCard
              data={agentData}
              loading={agentLoading}
              fillViewport
            />
          </CarouselItem>
          <CarouselItem className="basis-full">
            <MargemCard
              data={agentData}
              loading={agentLoading}
              fillViewport
            />
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para cartão ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === current
                  ? 'w-5 bg-foreground'
                  : 'w-1.5 bg-muted-foreground/30',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
