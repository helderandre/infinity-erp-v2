"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function LegalNoticePage() {
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Aviso Legal</h1>
          <p className="text-white/70 text-lg">www.infinitygroup.pt</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 max-w-4xl">
        <div className="prose prose-lg max-w-none">
          {/* Section 1 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">1. Identificação do Titular do Website</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O presente website (www.infinitygroup.pt) é propriedade e operado por <strong>Lecoqimmo - Mediação Imobiliária, Unipessoal Lda</strong>, sociedade comercial unipessoal por quotas, com sede em Avenida da Liberdade, Nº 129 B, 1250-140 Lisboa, registada na Conservatória do Registo Comercial sob o número único de matrícula e de pessoa coletiva (NIPC) 514828528.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Gerente:</strong> Filipe Pereira
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">2. Atividade de Mediação Imobiliária e Licença AMI</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo exerce a sua atividade de mediação imobiliária ao abrigo da <strong>Licença AMI n.º 4719</strong>, titulada pela <strong>Convictus Mediação Imobiliária, Lda</strong>, com NIPC 505239485 e sede em Av. Forças Armadas, Nº 22C, 1600-082 Lisboa.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A atividade de mediação imobiliária é exercida nos termos da Lei n.º 15/2013, de 8 de fevereiro (alterada pela Lei n.º 42/2017, de 14 de junho), que estabelece o regime jurídico a que fica sujeita a atividade de mediação imobiliária.
            </p>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A atividade de mediação imobiliária consiste na procura, por parte das empresas, em nome dos seus clientes, de destinatários para a realização de negócios que visem a constituição ou aquisição de direitos reais sobre bens imóveis, bem como a permuta, o trespasse ou o arrendamento dos mesmos e a cessão de posições em contratos que tenham por objeto bens imóveis.
            </p>
            <p className="text-gray-700 leading-relaxed">
              A Lecoqimmo <strong>não exerce a atividade de intermediação de crédito</strong>.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">3. Contactos</h2>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-[rgb(9,9,9)]">3.1. Lecoqimmo (Titular do Website)</h3>
              <ul className="list-none pl-0 mb-4 text-gray-700 space-y-2">
                <li><strong>Morada:</strong> Avenida da Liberdade, Nº 129 B, 1250-140 Lisboa</li>
                <li><strong>Email:</strong> assistente.filipe.pereira@remax.pt</li>
                <li><strong>Telefone:</strong> +351 910 523 200</li>
                <li><strong>Website:</strong> <a href="https://www.infinitygroup.pt" className="text-[rgb(9,9,9)] hover:underline">www.infinitygroup.pt</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3 text-[rgb(9,9,9)]">3.2. Titular da Licença AMI</h3>
              <ul className="list-none pl-0 mb-4 text-gray-700 space-y-2">
                <li><strong>Entidade:</strong> Convictus Mediação Imobiliária, Lda</li>
                <li><strong>Licença AMI:</strong> 4719</li>
                <li><strong>NIPC:</strong> 505239485</li>
                <li><strong>Morada:</strong> Av. Forças Armadas, Nº 22C, 1600-082 Lisboa</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">4. Supervisão e Regulação</h2>
            <p className="text-gray-700 leading-relaxed">
              A atividade de mediação imobiliária exercida ao abrigo da Licença AMI referida é supervisionada pelo <strong>IMPIC - Instituto dos Mercados Públicos, do Imobiliário e da Construção, I.P.</strong>, com sede na Av. Júlio Dinis, 11, 1069-010 Lisboa (<a href="https://www.impic.pt" target="_blank" rel="noopener noreferrer" className="text-[rgb(9,9,9)] hover:underline">www.impic.pt</a>).
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">5. Livro de Reclamações</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo dispõe de Livro de Reclamações em formato físico na sua sede e estabelecimentos, nos termos do Decreto-Lei n.º 156/2005, de 15 de setembro.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Os consumidores podem igualmente apresentar as suas reclamações através do Livro de Reclamações Eletrónico, disponível em <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noopener noreferrer" className="text-[rgb(9,9,9)] hover:underline">www.livroreclamacoes.pt</a>.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">6. Resolução Alternativa de Litígios</h2>
            <p className="text-gray-700 leading-relaxed">
              Em caso de litígio, o consumidor pode recorrer às entidades de resolução alternativa de litígios de consumo (RAL), nos termos da Lei n.º 144/2015, de 8 de setembro. Para mais informações, consulte o Portal do Consumidor em <a href="https://www.consumidor.pt" target="_blank" rel="noopener noreferrer" className="text-[rgb(9,9,9)] hover:underline">www.consumidor.pt</a>.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">7. Legislação Aplicável</h2>
            <p className="text-gray-700 leading-relaxed">
              O presente Aviso Legal e toda a utilização do website regem-se pela legislação portuguesa.
            </p>
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