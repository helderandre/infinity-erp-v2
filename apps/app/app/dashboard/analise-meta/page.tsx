import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AnaliseMetaIndex() {
  redirect('/dashboard/analise-meta/pedidos')
}
