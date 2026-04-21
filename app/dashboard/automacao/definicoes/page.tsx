"use client"

import Link from "next/link"
import { ArrowRight, Braces, FileCode2, Mail, MessageSquareText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const SETTINGS_ITEMS = [
  {
    title: "Templates de Email",
    description: "Gerir biblioteca de emails reutilizáveis em automatismos e campanhas.",
    icon: Mail,
    href: "/dashboard/templates-email",
  },
  {
    title: "Templates de Documentos",
    description: "Modelos de documentos com variáveis para geração automática.",
    icon: FileCode2,
    href: "/dashboard/templates-documentos",
  },
  {
    title: "Variáveis de Template",
    description: "Catálogo de variáveis disponíveis nos templates.",
    icon: Braces,
    href: "/dashboard/templates-variaveis",
  },
  {
    title: "Templates WhatsApp",
    description: "Mensagens WhatsApp aprovadas para envio automático.",
    icon: MessageSquareText,
    href: "/dashboard/automacao/templates-wpp",
  },
] as const

export default function AutomacaoDefinicoesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Definições</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bibliotecas e variáveis usadas pelos automatismos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {SETTINGS_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="group">
              <Card className="h-full transition-all hover:border-foreground/20 hover:shadow-sm">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                  <div className="rounded-lg border bg-muted/40 p-2">
                    <Icon className="h-5 w-5 text-foreground/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold flex items-center justify-between gap-2">
                      <span>{item.title}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
