"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-[rgb(9,9,9)] text-white py-16 md:py-24 -mt-[calc(4rem+0.5rem)] md:-mt-[calc(5rem+0.5rem)] pt-[calc(4rem+0.5rem+4rem)] md:pt-[calc(5rem+0.5rem+6rem)]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span>Voltar à Página Inicial</span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Política de Privacidade</h1>
          <p className="text-white/70 text-lg">www.infinitygroup.pt</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 max-w-4xl">
        <div className="prose prose-lg max-w-none">
          {/* Section 1 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">1. Introdução</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A <strong>Lecoqimmo - Mediação Imobiliária, Unipessoal Lda</strong> (doravante designada por "Lecoqimmo"), com NIPC 514828528 e sede em Avenida da Liberdade, Nº 129 B, 1250-140 Lisboa, é a entidade responsável pelo tratamento dos dados pessoais recolhidos através do website www.infinitygroup.pt.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo exerce a atividade de mediação imobiliária ao abrigo da <strong>Licença AMI n.º 4719</strong>, titulada pela <strong>Convictus Mediação Imobiliária, Lda</strong> (NIPC 505239485).
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo está empenhada em proteger a privacidade e os dados pessoais dos utilizadores do seu Website, em cumprimento do Regulamento (UE) 2016/679 do Parlamento Europeu e do Conselho, de 27 de abril de 2016 (Regulamento Geral sobre a Proteção de Dados - RGPD), e da Lei n.º 58/2019, de 8 de agosto (Lei de Execução Nacional do RGPD).
            </p>
            <p className="text-gray-700 leading-relaxed">
              A presente Política de Privacidade explica como recolhemos, utilizamos, armazenamos e protegemos os dados pessoais dos utilizadores.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">2. Responsável pelo Tratamento de Dados</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A entidade responsável pelo tratamento dos dados pessoais recolhidos através deste Website é:
            </p>
            <ul className="list-none pl-0 mb-4 text-gray-700 space-y-2">
              <li><strong>NIPC:</strong> 514828528</li>
              <li><strong>Morada:</strong> Avenida da Liberdade, Nº 129 B, 1250-140 Lisboa</li>
              <li><strong>Email para questões de proteção de dados:</strong> assistente.filipe.pereira@remax.pt</li>
              <li><strong>Telefone:</strong> +351 910 523 200</li>
            </ul>
            <p className="text-gray-700 leading-relaxed italic bg-gray-50 p-4 rounded-lg">
              <strong>Nota:</strong> A Lecoqimmo opera ao abrigo da Licença AMI n.º 4719 da Convictus Mediação Imobiliária, Lda. No entanto, a responsabilidade pelo tratamento dos dados pessoais recolhidos através deste Website é exclusivamente da Lecoqimmo.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">3. Dados Pessoais Recolhidos</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo recolhe dados pessoais através dos formulários de contacto e de pedido de informação disponíveis no Website. Os dados fornecidos diretamente pelo utilizador são os seguintes:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Nome completo;</li>
              <li>Endereço de correio eletrónico (email);</li>
              <li>Número de telefone;</li>
              <li>Conteúdo da mensagem enviada pelo utilizador;</li>
              <li>Quando aplicável, a referência do imóvel ou do consultor sobre o qual o utilizador solicita informação.</li>
            </ul>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Adicionalmente, por razões técnicas e de segurança, são processados automaticamente alguns dados, designadamente o <strong>endereço IP</strong> do utilizador. Este processamento destina-se à prevenção de abusos e de submissões automatizadas (spam), através do serviço <strong>Cloudflare Turnstile</strong>, e à aplicação de limites de frequência de pedidos, com fundamento no interesse legítimo da Lecoqimmo em proteger o Website e os seus sistemas (artigo 6.º, n.º 1, alínea f) do RGPD).
            </p>
            <p className="text-gray-700 leading-relaxed">
              O Website <strong>não utiliza cookies de rastreamento, de análise estatística ou de publicidade</strong>. Utiliza apenas tecnologias estritamente necessárias e funcionais (armazenamento local do navegador) para guardar preferências do utilizador, conforme descrito na{' '}
              <a href="/cookies" className="text-[rgb(9,9,9)] hover:underline font-semibold">Política de Cookies</a>.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">4. Finalidades do Tratamento</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Os dados pessoais recolhidos são tratados para as seguintes finalidades:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Responder às solicitações, questões ou pedidos de informação enviados pelos utilizadores através do formulário de contacto;</li>
              <li>Prestar esclarecimentos sobre os serviços de mediação imobiliária e os imóveis disponíveis;</li>
              <li>Estabelecer e manter contacto com potenciais clientes no âmbito da atividade de mediação imobiliária;</li>
              <li>Cumprir obrigações legais aplicáveis à atividade da Lecoqimmo.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">5. Base Jurídica do Tratamento</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O tratamento dos dados pessoais baseia-se nas seguintes bases jurídicas, nos termos do artigo 6.º do RGPD:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Execução de diligências pré-contratuais (artigo 6.º, n.º 1, alínea b)):</strong> para responder ao pedido de informação iniciado pelo utilizador e adotar as diligências solicitadas com vista à eventual celebração de um contrato de mediação imobiliária;</li>
              <li><strong>Interesse legítimo (artigo 6.º, n.º 1, alínea f)):</strong> para dar resposta adequada às solicitações recebidas, para o normal exercício da atividade empresarial e para garantir a segurança do Website (incluindo a prevenção de spam e abusos);</li>
              <li><strong>Consentimento do titular (artigo 6.º, n.º 1, alínea a)):</strong> exclusivamente quando o utilizador opte expressamente por receber comunicações de marketing ou de promoção de imóveis e serviços. Este consentimento é facultativo e pode ser retirado a qualquer momento, sem afetar a resposta ao pedido inicialmente formulado.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">6. Partilha de Dados com Terceiros</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              No âmbito da sua atividade de mediação imobiliária, a Lecoqimmo poderá, quando necessário e estritamente para as finalidades descritas, partilhar dados pessoais com:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Entidade titular da Licença AMI:</strong> a Convictus Mediação Imobiliária, Lda, no âmbito da relação operacional e para cumprimento das obrigações regulamentares associadas à atividade de mediação imobiliária;</li>
              <li><strong>Rede RE/MAX:</strong> a Lecoqimmo opera no âmbito da rede RE/MAX. Os dados de contacto poderão ser tratados nos sistemas de gestão (CRM) associados a esta rede, para efeitos de acompanhamento do pedido e da relação de mediação imobiliária;</li>
              <li><strong>Proprietários de imóveis:</strong> quando o contacto do utilizador esteja relacionado com um imóvel específico, para efeitos de agendamento de visitas ou negociação;</li>
              <li><strong>Entidades reguladoras ou autoridades competentes:</strong> quando legalmente obrigada a fazê-lo;</li>
              <li><strong>Subcontratantes (prestadores de serviços) que atuam em nome da Lecoqimmo</strong>, vinculados por contrato a obrigações de confidencialidade e proteção de dados, nomeadamente:
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Supabase</strong> — alojamento da base de dados onde os pedidos são armazenados (dados alojados em centro de dados na União Europeia, região da Alemanha — <em>eu-central-1</em>);</li>
                  <li><strong>Cloudflare</strong> — alojamento, distribuição (CDN) e proteção do Website contra abusos e submissões automatizadas (Turnstile).</li>
                </ul>
              </li>
            </ul>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo não vende, cede ou transfere dados pessoais a terceiros para fins de marketing ou publicidade.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Os dados pessoais recolhidos através do Website são armazenados em servidores localizados na <strong>União Europeia</strong>. Alguns dos subcontratantes acima indicados são sociedades sediadas fora do Espaço Económico Europeu (nomeadamente nos Estados Unidos da América), pelo que poderá ocorrer acesso a dados a partir de país terceiro. Nesses casos, tais transferências realizam-se ao abrigo de <strong>garantias adequadas</strong> nos termos do Capítulo V do RGPD, designadamente as Cláusulas Contratuais-Tipo da Comissão Europeia e/ou a certificação no <strong>EU-U.S. Data Privacy Framework</strong>.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">7. Prazo de Conservação dos Dados</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Os dados pessoais recolhidos através do formulário de contacto são conservados pelo período de <strong>2 (dois) anos</strong> após o último contacto com o utilizador, salvo se existir uma obrigação legal que imponha um prazo de conservação superior.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Findo o prazo de conservação, os dados pessoais serão eliminados de forma segura ou anonimizados de forma irreversível.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Se o contacto evoluir para uma relação contratual, os dados serão conservados durante o período necessário para a execução do contrato e pelo prazo legalmente exigido para efeitos fiscais e de cumprimento de obrigações legais.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">8. Direitos dos Titulares dos Dados</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Nos termos do RGPD, os titulares dos dados pessoais gozam dos seguintes direitos:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Direito de acesso (artigo 15.º):</strong> obter confirmação de que os seus dados são tratados e aceder aos mesmos;</li>
              <li><strong>Direito de retificação (artigo 16.º):</strong> solicitar a correção de dados inexatos ou o completamento de dados incompletos;</li>
              <li><strong>Direito ao apagamento (artigo 17.º):</strong> solicitar a eliminação dos seus dados pessoais, quando aplicável;</li>
              <li><strong>Direito à limitação do tratamento (artigo 18.º):</strong> solicitar a limitação do tratamento dos seus dados em determinadas circunstâncias;</li>
              <li><strong>Direito de portabilidade (artigo 20.º):</strong> receber os seus dados num formato estruturado, de uso corrente e de leitura automática;</li>
              <li><strong>Direito de oposição (artigo 21.º):</strong> opor-se ao tratamento dos seus dados em determinadas circunstâncias;</li>
              <li><strong>Direito de retirar o consentimento:</strong> retirar o consentimento a qualquer momento, sem comprometer a licitude do tratamento efetuado com base no consentimento previamente dado.</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Para exercer qualquer um destes direitos, o titular dos dados pode contactar a Lecoqimmo através do email <strong>assistente.filipe.pereira@remax.pt</strong> ou por correio postal para a morada da sede. A Lecoqimmo responderá no prazo máximo de 30 dias.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">9. Direito de Reclamação</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Sem prejuízo de qualquer outro recurso administrativo ou judicial, o titular dos dados tem o direito de apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD), a autoridade de controlo competente em Portugal:
            </p>
            <ul className="list-none pl-0 mb-4 text-gray-700 space-y-2">
              <li><strong>CNPD - Comissão Nacional de Proteção de Dados</strong></li>
              <li><strong>Morada:</strong> Av. D. Carlos I, 134, 1.º, 1200-651 Lisboa</li>
              <li><strong>Website:</strong> <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer" className="text-[rgb(9,9,9)] hover:underline">www.cnpd.pt</a></li>
              <li><strong>Email:</strong> geral@cnpd.pt</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">10. Medidas de Segurança</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo adota medidas técnicas e organizativas adequadas para proteger os dados pessoais contra o acesso não autorizado, perda, destruição, alteração ou divulgação acidental ou ilícita, nomeadamente:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Utilização de protocolo HTTPS (SSL/TLS) para encriptação da comunicação entre o navegador do utilizador e o servidor do Website;</li>
              <li>Acesso restrito aos dados pessoais, limitado a colaboradores autorizados e estritamente necessário para o desempenho das suas funções;</li>
              <li>Procedimentos internos de gestão e proteção de dados pessoais;</li>
              <li>Armazenamento seguro dos dados em sistemas protegidos.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">11. Dados de Menores</h2>
            <p className="text-gray-700 leading-relaxed">
              O Website e os serviços da Lecoqimmo não se destinam a menores de 18 anos. A Lecoqimmo não recolhe conscientemente dados pessoais de menores. Caso tenha conhecimento de que foram recolhidos dados de um menor, a Lecoqimmo procederá à sua eliminação imediata.
            </p>
          </section>

          {/* Section 12 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">12. Alterações à Política de Privacidade</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo reserva-se o direito de atualizar ou modificar a presente Política de Privacidade a qualquer momento. Quaisquer alterações serão publicadas nesta página, com indicação da data da última atualização.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Recomenda-se aos utilizadores a consulta regular desta Política de Privacidade para se manterem informados sobre as práticas de proteção de dados da Lecoqimmo.
            </p>
          </section>

          {/* Section 13 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">13. Contacto</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Para quaisquer questões, esclarecimentos ou exercício de direitos relacionados com a proteção de dados pessoais, os utilizadores podem contactar a Lecoqimmo através de:
            </p>
            <ul className="list-none pl-0 mb-4 text-gray-700 space-y-2">
              <li><strong>Email:</strong> assistente.filipe.pereira@remax.pt</li>
              <li><strong>Telefone:</strong> +351 910 523 200</li>
              <li><strong>Morada:</strong> Avenida da Liberdade, Nº 129 B, 1250-140 Lisboa</li>
            </ul>
          </section>

          {/* Last Update */}
          <div className="mt-16 pt-8 border-t border-gray-200">
            <p className="text-gray-500 text-sm">
              Última atualização: Junho de 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}