import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Preencher todas as informações restantes"
 * (`fd15bd46-...`) — form de 3 secções (Dados Gerais, Localização,
 * Especificações) preenchendo `dev_properties` e `dev_property_specifications`.
 *
 * O shape inteiro do legacy é preservado no `configBuilder`; a UI
 * delega no `SubtaskCardForm` + `FormSubtaskDialog` que já sabe
 * resolver `target_entity` + `options_from_constant`.
 */
export const formPropertyCompletarDadosRule: SubtaskRule = {
  key: 'form_property_completar_dados',
  description:
    'Formulário multi-secção para completar os dados do imóvel (imóvel + specs).',
  taskKind: 'Finalizar Dados do Imóvel',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'fd15bd46-6113-4f2a-a43c-277d70e4994f',

  titleBuilder: () => 'Completar dados do imóvel',

  configBuilder: () => ({
    type: 'form',
    sections: [
      {
        title: 'Dados Gerais',
        description: '',
        order_index: 0,
        fields: [
          {
            label: 'Título do Anúncio',
            field_name: 'title',
            field_type: 'text',
            order_index: 0,
            placeholder: 'Ex: T3 renovado com terraço em Lisboa',
            target_entity: 'property',
          },
          {
            min: 0,
            label: 'Preço de Venda/Arrendamento',
            width: 'half',
            field_name: 'listing_price',
            field_type: 'currency',
            order_index: 1,
            target_entity: 'property',
          },
          {
            label: 'Tipo de Negócio',
            width: 'half',
            field_name: 'business_type',
            field_type: 'select',
            order_index: 2,
            target_entity: 'property',
            options_from_constant: 'BUSINESS_TYPES',
          },
          {
            label: 'Estado do Imóvel',
            width: 'half',
            field_name: 'property_condition',
            field_type: 'select',
            order_index: 3,
            target_entity: 'property',
            options_from_constant: 'PROPERTY_CONDITIONS',
          },
          {
            label: 'Certificado Energético',
            width: 'half',
            field_name: 'energy_certificate',
            field_type: 'select',
            order_index: 4,
            target_entity: 'property',
            options_from_constant: 'ENERGY_CERTIFICATES',
          },
        ],
      },
      {
        title: 'Localização',
        description: '',
        order_index: 1,
        fields: [
          {
            label: 'Localização do Imóvel (Mapbox)',
            field_name: 'location',
            field_type: 'address_map',
            order_index: 0,
            target_entity: 'property',
          },
        ],
      },
      {
        title: 'Secção 3',
        description: '',
        order_index: 2,
        fields: [
          {
            label: 'Tipologia',
            width: 'third',
            field_name: 'typology',
            field_type: 'select',
            order_index: 0,
            target_entity: 'property_specs',
            options_from_constant: 'TYPOLOGIES',
          },
          {
            min: 0,
            label: 'Quartos',
            width: 'third',
            field_name: 'bedrooms',
            field_type: 'number',
            order_index: 1,
            target_entity: 'property_specs',
          },
          {
            min: 0,
            label: 'Casas de Banho',
            width: 'third',
            field_name: 'bathrooms',
            field_type: 'number',
            order_index: 2,
            target_entity: 'property_specs',
          },
          {
            min: 0,
            label: 'Área Bruta (m²)',
            width: 'third',
            field_name: 'area_gross',
            field_type: 'number',
            order_index: 3,
            target_entity: 'property_specs',
          },
          {
            min: 0,
            label: 'Área Útil (m²)',
            width: 'third',
            field_name: 'area_util',
            field_type: 'number',
            order_index: 4,
            target_entity: 'property_specs',
          },
          {
            max: 2030,
            min: 1800,
            label: 'Ano de Construção',
            width: 'third',
            field_name: 'construction_year',
            field_type: 'number',
            order_index: 5,
            target_entity: 'property_specs',
          },
          {
            min: 0,
            label: 'Lugares de Estacionamento',
            width: 'half',
            field_name: 'parking_spaces',
            field_type: 'number',
            order_index: 6,
            target_entity: 'property_specs',
          },
          {
            label: 'Tem Elevador',
            width: 'half',
            field_name: 'has_elevator',
            field_type: 'checkbox',
            order_index: 7,
            target_entity: 'property_specs',
          },
          {
            label: 'Orientação Solar',
            width: 'full',
            field_name: 'solar_orientation',
            field_type: 'multiselect',
            order_index: 8,
            target_entity: 'property_specs',
            options_from_constant: 'SOLAR_ORIENTATIONS',
          },
          {
            label: 'Vistas',
            width: 'full',
            field_name: 'views',
            field_type: 'multiselect',
            order_index: 9,
            target_entity: 'property_specs',
            options_from_constant: 'VIEWS',
          },
          {
            label: 'Equipamento',
            width: 'full',
            field_name: 'equipment',
            field_type: 'multiselect',
            order_index: 10,
            target_entity: 'property_specs',
            options_from_constant: 'EQUIPMENT',
          },
          {
            label: 'Características',
            width: 'full',
            field_name: 'features',
            field_type: 'multiselect',
            order_index: 11,
            target_entity: 'property_specs',
            options_from_constant: 'FEATURES',
          },
        ],
      },
    ],
  }),

  Component: null,
  complete: async () => ({}),
}
