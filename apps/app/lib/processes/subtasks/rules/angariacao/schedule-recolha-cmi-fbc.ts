import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Criar agendamento" (`9bac8825-...`) — evento
 * de calendário para o consultor levantar CMI + FBC junto do owner.
 *
 * UI delegada no `SubtaskCardScheduleEvent` legacy, que já integra com
 * o módulo de calendário + Google Calendar sync.
 */
export const scheduleRecolhaCmiFbcRule: SubtaskRule = {
  key: 'schedule_recolha_cmi_fbc',
  description:
    'Agendamento de evento de calendário para recolha de CMI e FBC com o proprietário.',
  taskKind: 'Agendamento com o consultor CMI e FBC',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '9bac8825-6fdc-4ac1-a9e1-0f3274cdd411',

  titleBuilder: () => 'Agendar recolha de CMI e FBC',

  configBuilder: () => ({ type: 'schedule_event' }),

  Component: null,
  complete: async () => ({}),
}
