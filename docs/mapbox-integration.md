# Integração Mapbox — Autocomplete de Morada e Mapa Interactivo

## Visão Geral

O sistema utiliza o Mapbox para fornecer autocomplete de moradas portuguesas e um mapa interactivo com marcador arrastável. O componente `PropertyAddressMapPicker` combina três APIs do Mapbox:

1. **SearchBox Suggest API v1** — autocomplete de moradas em tempo real
2. **SearchBox Retrieve API v1** — obter coordenadas e detalhes completos de uma sugestão
3. **Geocoding API v5** — geocodificação inversa (coordenadas → morada) ao arrastar o marcador

## Configuração

### Variável de Ambiente

```env
NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...
```

### nuxt.config.ts

```typescript
css: ['~/assets/css/main.css', 'mapbox-gl/dist/mapbox-gl.css'],

runtimeConfig: {
  public: {
    mapboxAccessToken: process.env.NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
  },
},
```

O CSS do `mapbox-gl` é importado globalmente via Nuxt para garantir que o mapa renderiza correctamente.

### Dependência

```json
{
  "mapbox-gl": "^3.18.1"
}
```

## Componente: PropertyAddressMapPicker

**Localização:** `app/components/Property/AddressMapPicker.vue`

### Props e Emits

O componente funciona como um formulário controlado via `v-model`-like pattern:

```typescript
// Props (entrada)
interface Props {
  address?: string        // Morada actual
  postalCode?: string     // Código postal
  city?: string           // Cidade
  zone?: string           // Zona / região
  latitude?: number | null
  longitude?: number | null
}

// Emits (saída — actualiza o formulário pai)
'update:address'    → string
'update:postalCode' → string
'update:city'       → string
'update:zone'       → string
'update:latitude'   → number | null
'update:longitude'  → number | null
```

### Uso no Formulário

O componente deve ser envolvido em `<ClientOnly>` pois usa APIs do browser (`window`, `document`, `mapbox-gl`):

```vue
<ClientOnly>
  <PropertyAddressMapPicker
    :address="propertyData.address_street"
    :postal-code="propertyData.postal_code"
    :city="propertyData.city"
    :zone="propertyData.zone"
    :latitude="propertyData.latitude"
    :longitude="propertyData.longitude"
    @update:address="propertyData.address_street = $event"
    @update:postal-code="propertyData.postal_code = $event"
    @update:city="propertyData.city = $event"
    @update:zone="propertyData.zone = $event"
    @update:latitude="propertyData.latitude = $event"
    @update:longitude="propertyData.longitude = $event"
  />
</ClientOnly>
```

## Fluxo de Autocomplete

```
Utilizador digita "Rua da..."
        │
        ▼
  onInput() — actualiza query, emite update:address
        │
        ▼ (debounce 300ms, mín. 2 caracteres)
  fetchSuggestions()
        │
        ▼
  GET https://api.mapbox.com/search/searchbox/v1/suggest
    ?q=Rua da...
    &access_token=...
    &language=pt
    &country=PT
    &session_token=<uuid>
    &proximity=<lng>,<lat>    ← centro actual do mapa
    &limit=5
        │
        ▼
  Popover abre com lista de sugestões (CommandList)
        │
        ▼
  Utilizador selecciona uma sugestão
        │
        ▼
  onSelectSuggestion(suggestion)
    │
    ├── 1. Preenche campos do context (código postal, cidade, zona)
    │
    └── 2. GET https://api.mapbox.com/search/searchbox/v1/retrieve/{mapbox_id}
            ?access_token=...
            &session_token=<uuid>
            &language=pt
                │
                ▼
          Obtém coordenadas [lng, lat]
                │
                ├── Emite update:latitude, update:longitude
                ├── Move marcador no mapa
                ├── Faz flyTo para as coordenadas (zoom 16)
                └── Actualiza morada completa do feature
                │
                ▼
          newSession() — gera novo UUID para próxima pesquisa
```

### Session Tokens

O Mapbox SearchBox API usa session tokens para agrupar suggest + retrieve como uma única "sessão" de billing. Cada sessão:
- Começa com um `crypto.randomUUID()`
- É reutilizada em todos os `suggest` até o utilizador seleccionar uma sugestão
- Após o `retrieve`, gera-se um novo token

## Geocodificação Inversa (Marker Drag)

Quando o utilizador arrasta o marcador no mapa:

```
marker.on('dragend')
      │
      ▼
  Obtém novas coordenadas (lngLat)
      │
      ├── Emite update:latitude, update:longitude
      │
      └── reverseGeocode(lng, lat)
              │
              ▼
        GET https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json
          ?access_token=...
          &language=pt
          &limit=5
              │
              ▼
        Extrai dos features retornados:
          - address (place_name do tipo "address")
          - postalCode (context com id "postcode")
          - city (context com id "place" ou "locality")
          - zone (context com id "region" ou "district")
              │
              ▼
        Emite todos os campos actualizados
```

## Componentes Shadcn-vue Utilizados

O autocomplete é construído combinando componentes Shadcn-vue:

### Popover (dropdown do autocomplete)

```
Popover (controla abertura/fecho via v-model:open)
├── PopoverAnchor (ancora o dropdown ao input)
│   └── Input (campo de pesquisa com ícone Search)
└── PopoverContent (dropdown com largura do trigger)
    └── Command (container de resultados)
        └── CommandList
            ├── CommandEmpty (estado vazio ou loading)
            └── CommandGroup
                └── CommandItem (cada sugestão, com ícone e texto)
```

### Padrão de uso

```vue
<Popover v-model:open="popoverOpen">

  <!-- Ancora: o input fica "preso" ao popover -->
  <PopoverAnchor as-child>
    <Input
      :model-value="query"
      @update:model-value="onInput"
      @focus="suggestions.length && (popoverOpen = true)"
    />
  </PopoverAnchor>

  <!-- Dropdown: lista de sugestões -->
  <PopoverContent
    class="w-(--reka-popover-trigger-width) p-0"
    :side-offset="4"
    align="start"
    :trap-focus="false"
    @open-auto-focus.prevent
    @close-auto-focus.prevent
  >
    <Command>
      <CommandList>
        <CommandEmpty>Sem resultados.</CommandEmpty>
        <CommandGroup>
          <CommandItem
            v-for="s in suggestions"
            :key="s.mapbox_id"
            :value="s.full_address || s.name"
            @select="onSelectSuggestion(s)"
          >
            <!-- Ícone dinâmico + nome + endereço formatado -->
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>

</Popover>
```

**Detalhes importantes:**
- `w-(--reka-popover-trigger-width)` — faz o dropdown ter a mesma largura do input
- `:trap-focus="false"` — permite que o utilizador continue a escrever no input enquanto o popover está aberto
- `@open-auto-focus.prevent` / `@close-auto-focus.prevent` — evita que o popover roube o foco do input
- `as-child` no `PopoverAnchor` — usa o elemento filho como âncora sem criar wrapper extra

### Input e Label

```vue
<Label for="address-map-search">Morada exata</Label>
<Input
  id="address-map-search"
  :model-value="query"
  placeholder="Pesquisar morada..."
  autocomplete="off"
  class="pl-8"            <!-- padding para o ícone Search -->
  @update:model-value="onInput"
/>
```

## Inicialização do Mapa

O `mapbox-gl` é importado dinamicamente (lazy) para evitar erros SSR:

```typescript
const mapboxgl = (await import('mapbox-gl')).default
mapboxgl.accessToken = token

map = new mapboxgl.Map({
  container: mapContainerRef.value,
  style: 'mapbox://styles/mapbox/streets-v12',
  center: hasCoords ? [longitude, latitude] : [-9.15, 38.72],  // default: Lisboa
  zoom: hasCoords ? 15 : 10,
})

marker = new mapboxgl.Marker({ element: customPinElement, draggable: true })
```

O mapa é inicializado no `onMounted` e destruído no `onBeforeUnmount` para evitar memory leaks.

## Dados Guardados no Backend

Os campos preenchidos pelo Mapbox são guardados em `dev_properties`:

| Campo            | Coluna DB         | Origem                          |
|------------------|-------------------|---------------------------------|
| Morada exata     | `address_street`  | Suggest/Retrieve full_address   |
| Código postal    | `postal_code`     | context.postcode.name           |
| Cidade           | `city`            | context.place.name              |
| Zona             | `zone`            | context.region.name             |
| Latitude         | `latitude`        | geometry.coordinates[1]         |
| Longitude        | `longitude`       | geometry.coordinates[0]         |

## APIs Mapbox Utilizadas

| API                       | Endpoint                                              | Uso                          |
|---------------------------|-------------------------------------------------------|------------------------------|
| SearchBox Suggest v1      | `api.mapbox.com/search/searchbox/v1/suggest`          | Autocomplete em tempo real   |
| SearchBox Retrieve v1     | `api.mapbox.com/search/searchbox/v1/retrieve/{id}`    | Detalhes + coordenadas       |
| Geocoding v5              | `api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json` | Geocodificação inversa |
| Map Tiles (GL JS)         | `mapbox://styles/mapbox/streets-v12`                  | Renderização do mapa         |
