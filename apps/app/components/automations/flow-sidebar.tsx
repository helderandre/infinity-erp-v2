"use client"

import { useState, useMemo } from "react"
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
  Search as SearchIcon,
  Variable,
  Globe,
  Reply,
  Bell,
  ChevronDown,
  SearchX,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type AutomationNodeType,
  type NodeCategory,
  nodeColorBgMap,
  nodeColorTextMap,
  getNodeCategory,
  nodeCategoryConfig,
} from "@/lib/types/automation-flow"
import { Input } from "@/components/ui/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface SidebarNodeItem {
  type: AutomationNodeType
  label: string
  description: string
  icon: React.ReactNode
  keywords: string[]
}

const TRIGGER_NODES: SidebarNodeItem[] = [
  {
    type: "trigger_webhook",
    label: "Webhook",
    description: "Recebe dados externos via URL",
    icon: <Webhook className="w-4 h-4" />,
    keywords: ["webhook", "api", "url", "http", "post", "receber"],
  },
  {
    type: "trigger_status",
    label: "Mudança de Estado",
    description: "Quando o estado de uma entidade muda",
    icon: <Activity className="w-4 h-4" />,
    keywords: ["estado", "status", "mudança", "trigger", "entidade", "lead", "imovel"],
  },
  {
    type: "trigger_schedule",
    label: "Agendamento",
    description: "Executar em horários definidos",
    icon: <Clock className="w-4 h-4" />,
    keywords: ["agendar", "cron", "horário", "diário", "semanal", "mensal", "tempo"],
  },
  {
    type: "trigger_manual",
    label: "Manual",
    description: "Iniciar manualmente pelo utilizador",
    icon: <Play className="w-4 h-4" />,
    keywords: ["manual", "iniciar", "botão", "executar"],
  },
]

const ACTION_NODES: SidebarNodeItem[] = [
  {
    type: "whatsapp",
    label: "WhatsApp",
    description: "Enviar mensagens WhatsApp",
    icon: <MessageCircle className="w-4 h-4" />,
    keywords: ["whatsapp", "wpp", "mensagem", "enviar", "chat"],
  },
  {
    type: "email",
    label: "Email",
    description: "Enviar email automático",
    icon: <Mail className="w-4 h-4" />,
    keywords: ["email", "correio", "enviar", "smtp", "template"],
  },
  {
    type: "notification",
    label: "Notificação",
    description: "Criar notificação no sistema",
    icon: <Bell className="w-4 h-4" />,
    keywords: ["notificação", "alerta", "aviso", "sino"],
  },
  {
    type: "supabase_query",
    label: "Consulta ao Sistema",
    description: "Consultar, criar ou actualizar dados",
    icon: <Database className="w-4 h-4" />,
    keywords: ["base dados", "consulta", "query", "supabase", "sql", "gravar", "inserir", "actualizar"],
  },
  {
    type: "http_request",
    label: "HTTP Request",
    description: "Chamar uma API externa",
    icon: <Globe className="w-4 h-4" />,
    keywords: ["http", "api", "request", "get", "post", "fetch", "url", "externo"],
  },
  {
    type: "set_variable",
    label: "Definir Variável",
    description: "Guardar um valor para usar depois",
    icon: <Variable className="w-4 h-4" />,
    keywords: ["variável", "valor", "guardar", "definir", "set"],
  },
  {
    type: "webhook_response",
    label: "Responder Webhook",
    description: "Enviar resposta ao chamador do webhook",
    icon: <Reply className="w-4 h-4" />,
    keywords: ["resposta", "response", "webhook", "retorno", "http"],
  },
]

const LOGIC_NODES: SidebarNodeItem[] = [
  {
    type: "condition",
    label: "Condição",
    description: "Decidir caminho com base numa regra",
    icon: <GitBranch className="w-4 h-4" />,
    keywords: ["condição", "if", "se", "decidir", "regra", "filtro", "branch"],
  },
  {
    type: "delay",
    label: "Aguardar",
    description: "Esperar X minutos, horas ou dias",
    icon: <Timer className="w-4 h-4" />,
    keywords: ["aguardar", "esperar", "delay", "tempo", "pausa", "minutos", "horas"],
  },
  {
    type: "task_lookup",
    label: "Buscar Lead",
    description: "Procurar ou criar um contacto",
    icon: <SearchIcon className="w-4 h-4" />,
    keywords: ["buscar", "procurar", "lead", "contacto", "lookup", "encontrar"],
  },
]

const ALL_SECTIONS: { key: NodeCategory; label: string; items: SidebarNodeItem[] }[] = [
  { key: "trigger", label: "Triggers", items: TRIGGER_NODES },
  { key: "action", label: "Acções", items: ACTION_NODES },
  { key: "logic", label: "Lógica", items: LOGIC_NODES },
]

interface FlowSidebarProps {
  className?: string
}

export function FlowSidebar({ className }: FlowSidebarProps) {
  const [search, setSearch] = useState("")
  const [collapsed, setCollapsed] = useState<Record<NodeCategory, boolean>>({
    trigger: false,
    action: false,
    logic: false,
  })

  const toggleCollapse = (key: NodeCategory) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const query = search.toLowerCase().trim()

  const filteredSections = useMemo(() => {
    if (!query) return ALL_SECTIONS

    return ALL_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.keywords.some((kw) => kw.includes(query))
      ),
    })).filter((section) => section.items.length > 0)
  }, [query])

  const totalResults = filteredSections.reduce((acc, s) => acc + s.items.length, 0)

  const onDragStart = (
    event: React.DragEvent,
    nodeType: AutomationNodeType
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType)
    event.dataTransfer.effectAllowed = "move"
  }

  const renderNodeItem = (item: SidebarNodeItem) => {
    const category = getNodeCategory(item.type)
    const catConfig = nodeCategoryConfig[category]

    return (
      <div
        key={item.type}
        draggable
        onDragStart={(e) => onDragStart(e, item.type)}
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all",
          catConfig.cardBorder,
          "hover:shadow-sm hover:bg-accent/50"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
            nodeColorBgMap[item.type]
          )}
        >
          <span className={nodeColorTextMap[item.type]}>{item.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{item.label}</p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight">
            {item.description}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "w-[260px] border-r bg-sidebar flex flex-col overflow-hidden",
        className
      )}
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2 border-b border-border/40">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nodes..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
        {query && (
          <p className="text-[10px] text-muted-foreground mt-1.5 px-0.5">
            {totalResults} resultado{totalResults !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Node sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredSections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <SearchX className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs font-medium">Nenhum node encontrado</p>
            <p className="text-[10px] mt-0.5">Tente outra pesquisa</p>
          </div>
        )}

        {filteredSections.map((section) => {
          const catConfig = nodeCategoryConfig[section.key]
          const isCollapsed = !query && collapsed[section.key]

          return (
            <Collapsible
              key={section.key}
              open={!isCollapsed}
              onOpenChange={() => !query && toggleCollapse(section.key)}
            >
              <CollapsibleTrigger
                className={cn(
                  "flex items-center gap-2 w-full mb-1.5 group",
                  query && "cursor-default"
                )}
                disabled={!!query}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold",
                    catConfig.badgeBg,
                    catConfig.badgeText
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", catConfig.badgeDot)} />
                  {section.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {section.items.length}
                </span>
                {!query && (
                  <ChevronDown
                    className={cn(
                      "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5">
                  {section.items.map(renderNodeItem)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </div>
  )
}
