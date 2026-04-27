/**
 * Definição declarativa do inquérito de satisfação. Partilhada entre
 * a página pública (`/inquerito/[token]`) e o futuro componente de
 * visualização de respostas no detalhe do deal.
 */

export type SurveyChoice = { value: string; label: string }
export type SurveyChoiceQuestion = {
  field: string
  label: string
  type: 'choice'
  required: boolean
  choices: SurveyChoice[]
}
export type SurveyTextQuestion = {
  field: string
  label: string
  type: 'text'
  required: boolean
  placeholder?: string
  helper?: string
}

export type SurveyQuestion = SurveyChoiceQuestion | SurveyTextQuestion

export const SATISFACTION_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    field: 'q1_consultor_ajuda',
    label: 'O seu consultor(a) prestou toda a ajuda necessária ao longo do processo?',
    type: 'choice',
    required: true,
    choices: [
      { value: 'sim_absolutamente', label: 'Sim, absolutamente' },
      { value: 'sim_maioria_vezes', label: 'Sim, na maioria das vezes' },
      { value: 'parcialmente', label: 'Parcialmente' },
      { value: 'nao', label: 'Não' },
    ],
  },
  {
    field: 'q2_profissionalismo',
    label: 'Como avalia o profissionalismo da equipa da Infinity Group durante o processo de compra/venda?',
    type: 'choice',
    required: true,
    choices: [
      { value: 'excelente', label: 'Excelente' },
      { value: 'bom', label: 'Bom' },
      { value: 'satisfatorio', label: 'Satisfatório' },
      { value: 'insatisfatorio', label: 'Insatisfatório' },
    ],
  },
  {
    field: 'q3_acompanhamento',
    label: 'Sentiu-se acompanhado(a) e informado(a) em todas as fases do processo?',
    type: 'choice',
    required: true,
    choices: [
      { value: 'sim', label: 'Sim' },
      { value: 'parcialmente', label: 'Parcialmente' },
      { value: 'nao', label: 'Não' },
    ],
  },
  {
    field: 'q4_tempo_resposta',
    label: 'O tempo de resposta da equipa às suas dúvidas e necessidades foi adequado?',
    type: 'choice',
    required: true,
    choices: [
      { value: 'muito_rapido', label: 'Muito rápido' },
      { value: 'razoavel', label: 'Razoável' },
      { value: 'demorado', label: 'Demorado' },
      { value: 'muito_demorado', label: 'Muito demorado' },
    ],
  },
  {
    field: 'q5_transparencia',
    label: 'O processo de compra/venda foi conduzido com transparência e clareza?',
    type: 'choice',
    required: true,
    choices: [
      { value: 'sim_completamente', label: 'Sim, completamente' },
      { value: 'sim_grande_parte', label: 'Sim, em grande parte' },
      { value: 'parcialmente', label: 'Parcialmente' },
      { value: 'nao', label: 'Não' },
    ],
  },
  {
    field: 'q6_experiencia_global',
    label: 'Como classificaria a sua experiência global com a Infinity Group?',
    type: 'choice',
    required: true,
    choices: [
      { value: 'excelente', label: 'Excelente' },
      { value: 'boa', label: 'Boa' },
      { value: 'razoavel', label: 'Razoável' },
      { value: 'ma', label: 'Má' },
    ],
  },
  {
    field: 'q7_recomendaria',
    label: 'Recomendaria os serviços da Infinity Group a amigos ou familiares?',
    type: 'choice',
    required: true,
    choices: [
      { value: 'sim_com_certeza', label: 'Sim, com certeza' },
      { value: 'talvez', label: 'Talvez' },
      { value: 'provavelmente_nao', label: 'Provavelmente não' },
    ],
  },
  {
    field: 'q8_referencia',
    label: 'Conhece alguém que esteja a pensar comprar ou vender casa e a quem poderíamos ajudar?',
    type: 'text',
    required: false,
    helper: 'Se sim, indique por favor o nome e contacto (opcional):',
  },
  {
    field: 'q9_comentarios',
    label: 'Gostaria de deixar algum comentário ou sugestão para que possamos melhorar os nossos serviços?',
    type: 'text',
    required: false,
  },
]

/**
 * Considera uma resposta "Promotora" (boa) para gating do CTA Google review.
 * Apenas mostramos o CTA quando a experiência global E a recomendação são
 * positivas — evita pedir review pública a clientes insatisfeitos.
 */
export function isPromoter(answers: { q6_experiencia_global?: string | null; q7_recomendaria?: string | null }): boolean {
  const goodGlobal = answers.q6_experiencia_global === 'excelente' || answers.q6_experiencia_global === 'boa'
  const wouldRecommend = answers.q7_recomendaria === 'sim_com_certeza'
  return goodGlobal && wouldRecommend
}
