'use client'

import type { ComponentType } from 'react'
import {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineHeader,
  TimelineDescription,
  TimelineTime,
} from '@/components/ui/timeline'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  MailCheck,
  Eye,
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  Flag,
  Bot,
} from 'lucide-react'

/**
 * Timeline de actividade do processo (estilo da antiga TaskActivityTimeline):
 * quem viu, quem concluiu, quem fez o quê e quando. Aqui com dados de amostra
 * — com dados reais virá de proc_task_activities (viewed / completed /
 * email_sent / upload / doc_generated …).
 */

interface ActivityEvent {
  id: string
  icon: ComponentType<{ className?: string }>
  color: string
  /** null = sistema/IA */
  actor: string | null
  description: string
  when: string
}

const SAMPLE_EVENTS: ActivityEvent[] = [
  {
    id: '9',
    icon: FileText,
    color: 'text-violet-500',
    actor: 'Ana Silva',
    description: 'Começou a gerar o CMI (passo Geração do CMI)',
    when: 'há 2 horas',
  },
  {
    id: '8',
    icon: Eye,
    color: 'text-muted-foreground',
    actor: 'Gestão',
    description: 'Visualizou o processo',
    when: 'há 5 horas',
  },
  {
    id: '7',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    actor: 'Ana Silva',
    description: 'Concluiu o passo Recolha de Documentos',
    when: 'ontem, 16:40',
  },
  {
    id: '6',
    icon: Sparkles,
    color: 'text-sky-500',
    actor: null,
    description: 'IA extraiu os dados dos documentos e preencheu o imóvel',
    when: 'ontem, 16:38',
  },
  {
    id: '5',
    icon: Upload,
    color: 'text-blue-500',
    actor: 'Ana Silva',
    description: 'Carregou 5 documentos do imóvel e do proprietário',
    when: 'ontem, 16:30',
  },
  {
    id: '4',
    icon: Eye,
    color: 'text-muted-foreground',
    actor: 'João Costa',
    description: 'Visualizou o passo Recolha de Documentos',
    when: 'há 2 dias',
  },
  {
    id: '3',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    actor: 'Ana Silva',
    description: 'Concluiu o passo Pedido de Documentação',
    when: 'há 4 dias',
  },
  {
    id: '2',
    icon: MailCheck,
    color: 'text-blue-500',
    actor: 'Ana Silva',
    description: 'Enviou o email de pedido de documentação ao cliente',
    when: 'há 5 dias, 09:12',
  },
  {
    id: '1',
    icon: Flag,
    color: 'text-emerald-500',
    actor: null,
    description: 'Processo de angariação iniciado',
    when: 'há 5 dias, 09:00',
  },
]

export function ProcessActivityTimeline({
  events = SAMPLE_EVENTS,
}: {
  events?: ActivityEvent[]
}) {
  return (
    <Timeline orientation="vertical">
      {events.map((ev, i) => {
        const Icon = ev.icon
        return (
          <TimelineItem key={ev.id}>
            <TimelineDot className={ev.color}>
              <Icon className="h-3 w-3" />
            </TimelineDot>
            {i < events.length - 1 && <TimelineConnector />}
            <TimelineContent>
              <TimelineHeader>
                <div className="flex items-center gap-2">
                  {ev.actor ? (
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px]">
                        {ev.actor[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-3 w-3 text-muted-foreground" />
                    </span>
                  )}
                  <span className="text-sm font-medium">
                    {ev.actor ?? 'Sistema'}
                  </span>
                </div>
                <TimelineDescription>{ev.description}</TimelineDescription>
              </TimelineHeader>
              <TimelineTime>{ev.when}</TimelineTime>
            </TimelineContent>
          </TimelineItem>
        )
      })}
    </Timeline>
  )
}
