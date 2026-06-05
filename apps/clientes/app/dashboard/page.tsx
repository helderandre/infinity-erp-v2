import { createClient } from '@infinity/lib/supabase/server'
import { canAccessSurface } from '@infinity/lib/auth/roles'
import { Card, CardContent, CardHeader, CardTitle } from '@infinity/ui/card'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user?.id ?? '')

  // PostgREST embed can surface as object or array depending on typing; normalise both.
  const roles = (roleRows ?? []).flatMap((r: { roles: unknown }) => {
    const rel = r?.roles as { name?: string | null } | { name?: string | null }[] | null
    if (Array.isArray(rel)) return rel.map((x) => x?.name ?? null)
    return [rel?.name ?? null]
  })

  if (!canAccessSurface('clientes', roles)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sem acesso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              A sua conta não tem acesso ao portal de clientes. Contacte a Infinity Group.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const cards = [
    { title: 'Os meus imóveis', desc: 'Imóveis em angariação ou aquisição.' },
    { title: 'Documentos', desc: 'Documentos a submeter e já validados.' },
    { title: 'Processos', desc: 'Estado dos seus processos em curso.' },
  ]

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Portal de Clientes</h1>
        <p className="text-sm text-slate-500">Bem-vindo, {user?.email}</p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
