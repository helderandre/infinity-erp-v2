import { createClient } from '@infinity/lib/supabase/server'
import { PageHero } from '@portal/components/portal/page-hero'
import { Card, CardContent, CardHeader, CardTitle } from '@infinity/ui/card'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-6">
      <PageHero title="Perfil" subtitle="Os seus dados de parceiro" />
      <Card className="max-w-xl">
        <CardHeader><CardTitle>Conta</CardTitle></CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Email</dt>
              <dd className="font-medium text-neutral-900">{user?.email}</dd>
            </div>
            {/* TODO: editable profile fields (nome, NIF, IBAN, contacto) + save. */}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
