"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function TermsPage() {
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Termos e Condições de Utilização</h1>
          <p className="text-white/70 text-lg">www.infinitygroup.pt</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 max-w-4xl">
        <div className="prose prose-lg max-w-none">
          {/* Section 1 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">1. Disposições Gerais</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Os presentes Termos e Condições regulam o acesso e a utilização do website www.infinitygroup.pt (doravante designado por "Website"), propriedade da <strong>Lecoqimmo - Mediação Imobiliária, Unipessoal Lda</strong> (doravante designada por "Lecoqimmo"), com NIPC 514828528 e sede em Avenida da Liberdade, Nº 129 B, 1250-140 Lisboa.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo exerce a atividade de mediação imobiliária ao abrigo da <strong>Licença AMI n.º 4719</strong>, titulada pela <strong>Convictus Mediação Imobiliária, Lda</strong> (NIPC 505239485).
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Ao aceder e utilizar o Website, o utilizador declara que leu, compreendeu e aceitou integralmente os presentes Termos e Condições. Caso não concorde com os mesmos, deverá abster-se de utilizar o Website.
            </p>
            <p className="text-gray-700 leading-relaxed">
              A Lecoqimmo reserva-se o direito de alterar ou atualizar os presentes Termos e Condições a qualquer momento, sem aviso prévio. As alterações entram em vigor a partir da data da sua publicação no Website. Recomenda-se a consulta regular desta página.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">2. Objeto do Website</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O Website destina-se à divulgação de informação sobre os serviços de mediação imobiliária prestados pela Lecoqimmo, à apresentação do seu portfólio de imóveis e à disponibilização de meios de contacto para potenciais clientes e parceiros.
            </p>
            <p className="text-gray-700 leading-relaxed">
              O Website não constitui, por si só, qualquer oferta contratual vinculativa, servindo apenas como plataforma informativa e de contacto.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">3. Informação sobre Imóveis</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              As informações relativas aos imóveis apresentados no Website, incluindo descrições, características, áreas, preços e fotografias, são fornecidas de boa-fé e com base nas informações disponibilizadas pelos respetivos proprietários ou por fontes externas parceiras.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo empenha-se em garantir a exatidão e atualização das informações publicadas, contudo não garante que as mesmas estejam isentas de erros, omissões ou desatualizações. As informações apresentadas têm caráter meramente indicativo e não vinculativo.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A confirmação de todas as características e condições dos imóveis deverá ser efetuada junto da Lecoqimmo antes de qualquer tomada de decisão ou celebração de negócio.
            </p>
            <p className="text-gray-700 leading-relaxed">
              As fotografias, plantas, vídeos e imagens virtuais (incluindo renders e tours virtuais) apresentados no Website são meramente ilustrativos e podem não corresponder integralmente ao estado atual dos imóveis.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">4. Conteúdos de Terceiros e Fontes Externas</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O Website pode incluir anúncios de imóveis provenientes de fontes externas, parceiros ou da rede imobiliária à qual a Lecoqimmo está associada. Nestes casos, a Lecoqimmo atua como intermediária na divulgação da informação, não sendo responsável pela veracidade, exatidão ou atualidade dos dados fornecidos por terceiros.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo não se responsabiliza por informações publicadas por parceiros ou fontes externas, embora tome diligências razoáveis para verificar a qualidade e fiabilidade das mesmas.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Os imóveis apresentados no Website podem estar sujeitos a condições de comercialização definidas por terceiros, incluindo os respetivos proprietários e a entidade titular da Licença AMI ao abrigo da qual a Lecoqimmo opera.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">5. Links para Websites de Terceiros</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O Website pode conter links ou referências para websites de terceiros. Estes links são disponibilizados apenas por conveniência e para fins informativos, não implicando qualquer relação de parceria, associação, patrocínio ou endosso por parte da Lecoqimmo.
            </p>
            <p className="text-gray-700 leading-relaxed">
              A Lecoqimmo não exerce qualquer controlo sobre os conteúdos, políticas de privacidade ou práticas de websites de terceiros, não sendo responsável pelos mesmos. O acesso a esses websites é feito por conta e risco do utilizador.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">6. Propriedade Intelectual</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Todos os conteúdos do Website, incluindo mas não se limitando a textos, imagens, fotografias, gráficos, logótipos, ícones, vídeos, software, bases de dados e design, estão protegidos por direitos de propriedade intelectual e industrial, sendo propriedade da Lecoqimmo, da entidade titular da Licença AMI ou de terceiros que autorizaram a sua utilização.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              É expressamente proibida a reprodução, distribuição, transformação, comunicação pública, disponibilização ou qualquer outra forma de exploração, total ou parcial, dos conteúdos do Website sem a autorização prévia e expressa por escrito da Lecoqimmo ou do respetivo titular dos direitos.
            </p>
            <p className="text-gray-700 leading-relaxed">
              O utilizador pode visualizar e imprimir os conteúdos do Website exclusivamente para uso pessoal e não comercial, desde que respeite os direitos de propriedade intelectual e industrial aplicáveis.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">7. Utilização do Website</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O utilizador compromete-se a utilizar o Website de forma diligente, lícita e em conformidade com a legislação aplicável, a moral e os bons costumes, bem como com os presentes Termos e Condições.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed font-semibold">
              É expressamente proibido ao utilizador:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Utilizar o Website para fins ilícitos, fraudulentos ou que atentem contra os direitos de terceiros;</li>
              <li>Introduzir ou difundir vírus informáticos, malware ou qualquer outro código malicioso que possa danificar, inutilizar ou sobrecarregar o Website ou os seus sistemas;</li>
              <li>Tentar aceder a áreas restritas do Website ou aos sistemas informáticos da Lecoqimmo sem autorização;</li>
              <li>Reproduzir, copiar ou distribuir conteúdos do Website sem autorização prévia;</li>
              <li>Utilizar ferramentas automatizadas (bots, scrapers) para recolher dados do Website;</li>
              <li>Enviar comunicações não solicitadas (spam) através dos formulários de contacto.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">8. Formulário de Contacto</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O Website disponibiliza um formulário de contacto que permite aos utilizadores enviar mensagens à Lecoqimmo, recolhendo os seguintes dados: nome, endereço de email, número de telefone e mensagem.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Os dados fornecidos através do formulário de contacto serão utilizados exclusivamente para responder às solicitações dos utilizadores e para fins relacionados com a atividade de mediação imobiliária. O tratamento destes dados é regido pela Política de Privacidade, disponível no Website.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">9. Disponibilidade do Website</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo não garante a disponibilidade permanente ou ininterrupta do Website, podendo este ser temporariamente suspenso por motivos de manutenção, atualização, melhoria ou por razões de força maior.
            </p>
            <p className="text-gray-700 leading-relaxed">
              A Lecoqimmo reserva-se o direito de modificar, suspender ou descontinuar, temporária ou permanentemente, qualquer funcionalidade ou conteúdo do Website, sem necessidade de aviso prévio.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">10. Limitação de Responsabilidade</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O Website e os seus conteúdos são disponibilizados "tal como estão" e "conforme disponíveis", sem garantias de qualquer natureza, expressas ou implícitas.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed font-semibold">
              A Lecoqimmo não será responsável por:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Quaisquer danos diretos, indiretos, incidentais, consequenciais ou punitivos decorrentes do acesso ou utilização do Website;</li>
              <li>Erros, omissões ou desatualizações nas informações publicadas no Website, incluindo informações sobre imóveis provenientes de fontes externas ou parceiros;</li>
              <li>A indisponibilidade temporária ou permanente do Website;</li>
              <li>Danos causados por vírus ou outros elementos nocivos que possam afetar o equipamento informático do utilizador em consequência do acesso ao Website;</li>
              <li>Atos ou omissões de terceiros, incluindo proprietários de imóveis, parceiros e a entidade titular da Licença AMI.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">11. Relação com a Entidade Titular da Licença AMI</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo opera no âmbito da rede e sob a Licença AMI n.º 4719 da Convictus Mediação Imobiliária, Lda. O presente Website é propriedade exclusiva da Lecoqimmo e não representa, vincula ou substitui a Convictus Mediação Imobiliária, Lda.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Os conteúdos publicados neste Website são da responsabilidade da Lecoqimmo enquanto operadora do mesmo, sem prejuízo das obrigações legais e regulamentares que recaem sobre a entidade titular da Licença AMI no âmbito da atividade de mediação imobiliária.
            </p>
          </section>

          {/* Section 12 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">12. Legislação Aplicável e Foro Competente</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Os presentes Termos e Condições são regidos pela legislação portuguesa.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Para a resolução de quaisquer litígios emergentes da utilização do Website ou da interpretação dos presentes Termos e Condições, será competente o foro da Comarca de Lisboa, com expressa renúncia a qualquer outro.
            </p>
          </section>

          {/* Section 13 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">13. Contacto</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Para quaisquer questões relacionadas com os presentes Termos e Condições, o utilizador pode contactar a Lecoqimmo através dos seguintes meios:
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
              Última atualização: Fevereiro de 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}