"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Mail, MessageSquareText, Plus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const FIXED_EVENTS = [
  { key: "aniversario_contacto", label: "Aniversário" },
  { key: "natal", label: "Natal" },
  { key: "ano_novo", label: "Ano Novo" },
] as const

interface EmailTemplate {
  id: string
  name: string
  category: string
  scope: string
  scope_id: string | null
  is_active: boolean
  is_system: boolean
}

interface WppTemplate {
  id: string
  name: string
  category: string | null
  scope: string
  scope_id: string | null
  is_active: boolean
  is_system: boolean
}

interface Props {
  userId: string
}

export function MyTemplatesTab({ userId }: Props) {
  const [emailTpls, setEmailTpls] = useState<EmailTemplate[]>([])
  const [wppTpls, setWppTpls] = useState<WppTemplate[]>([])
  const [isLoading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [emailRes, wppRes] = await Promise.all([
        fetch(`/api/automacao/email-templates?scope=consultant`),
        fetch(`/api/automacao/templates-wpp?scope=consultant`),
      ])
      const emailJson = await emailRes.json()
      const wppJson = await wppRes.json()
      setEmailTpls(emailJson.templates ?? [])
      setWppTpls(wppJson.templates ?? [])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  function findMine(channel: "email" | "whatsapp", category: string) {
    const source = channel === "email" ? emailTpls : wppTpls
    return source.find((t) => t.category === category && t.scope === "consultant" && t.scope_id === userId)
  }

  if (isLoading) {
    return <Skeleton className="h-64" />
  }

  return (
    <div className="space-y-4">
      {/* Quick-create shortcut */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Templates próprios</h3>
          <p className="text-xs text-muted-foreground">
            Sobrepõem-se aos globais quando activos. Se não houver, a cascata cai no template global.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Criar novo template
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Canal e evento</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </div>
            {FIXED_EVENTS.map((evt) => (
              <DropdownMenuItem key={`email-${evt.key}`} asChild>
                <Link href={`/dashboard/templates-email/novo?scope=consultant&category=${evt.key}`}>
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Email — {evt.label}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              WhatsApp
            </div>
            {FIXED_EVENTS.map((evt) => (
              <DropdownMenuItem key={`wpp-${evt.key}`} asChild>
                <Link href={`/dashboard/automacao/templates-wpp/editor?scope=consultant&category=${evt.key}`}>
                  <MessageSquareText className="mr-2 h-3.5 w-3.5" />
                  WhatsApp — {evt.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Matrix 3 eventos × 2 canais */}
      <div className="grid gap-4 md:grid-cols-3">
        {FIXED_EVENTS.map((evt) => {
          const email = findMine("email", evt.key)
          const wpp = findMine("whatsapp", evt.key)
          return (
            <Card key={evt.key}>
              <CardHeader>
                <CardTitle className="text-base">{evt.label}</CardTitle>
                <CardDescription className="text-xs">
                  Templates próprios sobrepõem-se aos globais.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div className="flex items-center gap-2 text-sm">
                      {email ? (
                        <>
                          <Badge variant="outline">Meu</Badge>
                          <span className="truncate">{email.name}</span>
                        </>
                      ) : (
                        <Badge variant="secondary">Usa global</Badge>
                      )}
                    </div>
                  </div>
                  <Button asChild size="sm" variant={email ? "outline" : "secondary"}>
                    <Link
                      href={
                        email
                          ? `/dashboard/templates-email/${email.id}`
                          : `/dashboard/templates-email/novo?scope=consultant&category=${evt.key}`
                      }
                    >
                      {email ? "Editar" : "Criar o meu"}
                    </Link>
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">WhatsApp</div>
                    <div className="flex items-center gap-2 text-sm">
                      {wpp ? (
                        <>
                          <Badge variant="outline">Meu</Badge>
                          <span className="truncate">{wpp.name}</span>
                        </>
                      ) : (
                        <Badge variant="secondary">Usa global</Badge>
                      )}
                    </div>
                  </div>
                  <Button asChild size="sm" variant={wpp ? "outline" : "secondary"}>
                    <Link
                      href={
                        wpp
                          ? `/dashboard/automacao/templates-wpp/editor?id=${wpp.id}`
                          : `/dashboard/automacao/templates-wpp/editor?scope=consultant&category=${evt.key}`
                      }
                    >
                      {wpp ? "Editar" : "Criar o meu"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
