import { redirect } from 'next/navigation'

// "Por consultor" foi movido para uma sub-tab dentro de Conta Corrente.
export default function PorConsultorRedirect() {
  redirect('/dashboard/financeiro/conta-corrente?view=geral')
}
