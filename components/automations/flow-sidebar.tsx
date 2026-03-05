"use client"

import {
  Webhook,
  Activity,
  Clock,
  Play,
  MessageCircle,
  Mail,
  Timer,
  GitBranch,
  Database,
  Search,
  Variable,
  Globe,
  Reply,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type AutomationNodeType,
  nodeColorBgMap,
  nodeColorTextMap,
  nodeSidebarMap,
} from "@/lib/types/automation-flow"

interface SidebarNodeItem {
  type: AutomationNodeType
  label: string
  description: string
  icon: React.ReactNode
}

const TRIGGER_NODES: SidebarNodeItem[] = [
  {
    type: "trigger_webhook",
    label: "Webhook",
    description: "Recebe dados externos",
    icon: <Webhook className="w-4 h-4" />,
  },
  {
    type: "trigger_status",
    label: "Mudança de Estado",
    description: "Quando o estado muda",
    icon: <Activity className="w-4 h-4" />,
  },
  {
    type: "trigger_schedule",
    label: "Agendamento",
    description: "Executar em horários",
    icon: <Clock className="w-4 h-4" />,
  },
  {
    type: "trigger_manual",
    label: "Manual",
    description: "Iniciar manualmente",
    icon: <Play className="w-4 h-4" />,
  },
]

const ACTION_NODES: SidebarNodeItem[] = [
  {
    type: "whatsapp",
    label: "WhatsApp",
    description: "Enviar mensagens",
    icon: <MessageCircle className="w-4 h-4" />,
  },
  {
    type: "email",
    label: "Email",
    description: "Enviar email",
    icon: <Mail className="w-4 h-4" />,
  },
  {
    type: "delay",
    label: "Aguardar",
    description: "Esperar X tempo",
    icon: <Timer className="w-4 h-4" />,
  },
  {
    type: "condition",
    label: "Condição",
    description: "Decidir caminho",
    icon: <GitBranch className="w-4 h-4" />,
  },
  {
    type: "supabase_query",
    label: "Consulta Banco",
    description: "Consultar ou gravar dados",
    icon: <Database className="w-4 h-4" />,
  },
  {
    type: "task_lookup",
    label: "Buscar Lead",
    description: "Procurar contacto",
    icon: <Search className="w-4 h-4" />,
  },
  {
    type: "set_variable",
    label: "Definir Variável",
    description: "Guardar valor",
    icon: <Variable className="w-4 h-4" />,
  },
  {
    type: "http_request",
    label: "HTTP Request",
    description: "Chamar API externa",
    icon: <Globe className="w-4 h-4" />,
  },
  {
    type: "webhook_response",
    label: "Responder Webhook",
    description: "Responder ao chamador",
    icon: <Reply className="w-4 h-4" />,
  },
  {
    type: "notification",
    label: "Notificação",
    description: "Criar notificação",
    icon: <Bell className="w-4 h-4" />,
  },
]

interface FlowSidebarProps {
  className?: string
}

export function FlowSidebar({ className }: FlowSidebarProps) {
  const onDragStart = (
    event: React.DragEvent,
    nodeType: AutomationNodeType
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType)
    event.dataTransfer.effectAllowed = "move"
  }

  const renderNodeItem = (item: SidebarNodeItem) => (
    <div
      key={item.type}
      draggable
      onDragStart={(e) => onDragStart(e, item.type)}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-md border cursor-grab active:cursor-grabbing transition-all",
        nodeSidebarMap[item.type]
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-md shrink-0",
          nodeColorBgMap[item.type]
        )}
      >
        <span className={nodeColorTextMap[item.type]}>{item.icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{item.label}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {item.description}
        </p>
      </div>
    </div>
  )

  return (
    <div
      className={cn(
        "w-[200px] border-r bg-sidebar p-3 overflow-y-auto flex flex-col gap-4",
        className
      )}
    >
      <div>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Gatilhos
        </h3>
        <div className="space-y-1.5">
          {TRIGGER_NODES.map(renderNodeItem)}
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Acções
        </h3>
        <div className="space-y-1.5">
          {ACTION_NODES.map(renderNodeItem)}
        </div>
      </div>
    </div>
  )
}
