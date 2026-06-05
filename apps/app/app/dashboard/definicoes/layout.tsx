// O gate de `settings` foi descido para as páginas que realmente o
// exigem (index + integrações). A configuração de email pessoal
// (`/dashboard/definicoes/email`) é per-consultor — usa
// `consultant_email_accounts` scoped ao próprio — e fica acessível a
// qualquer utilizador autenticado.
export default function DefinicoesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
