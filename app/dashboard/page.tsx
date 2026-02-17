import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Users, Zap, FileStack } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

async function DashboardStats() {
  const supabase = await createClient()

  // Buscar estatísticas em paralelo
  const [
    { count: totalProperties },
    { count: activeProperties },
    { count: totalLeads },
    { count: totalConsultants },
  ] = await Promise.all([
    supabase.from('dev_properties').select('*', { count: 'exact', head: true }),
    supabase
      .from('dev_properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase
      .from('dev_users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
  ])

  const stats = [
    {
      title: 'Total de Imóveis',
      value: totalProperties || 0,
      icon: Building2,
      description: `${activeProperties || 0} activos`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Leads Activos',
      value: totalLeads || 0,
      icon: Zap,
      description: 'Total de leads',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Consultores',
      value: totalConsultants || 0,
      icon: Users,
      description: 'Activos',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      title: 'Processos',
      value: 0,
      icon: FileStack,
      description: 'Em andamento',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-[60px] mb-2" />
            <Skeleton className="h-3 w-[80px]" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema ERP Infinity
        </p>
      </div>

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhuma actividade recente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tarefas Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhuma tarefa pendente
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
