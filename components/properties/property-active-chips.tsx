'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PROPERTY_STATUS,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
} from '@/lib/constants'

interface ActiveChipsProps {
  search: string
  onClearSearch: () => void
  selectedStatuses: string[]
  defaultStatuses: string[]
  onStatusesChange: (next: string[]) => void
  selectedPropertyTypes: string[]
  onPropertyTypesChange: (v: string[]) => void
  selectedBusinessTypes: string[]
  onBusinessTypesChange: (v: string[]) => void
  selectedConditions: string[]
  onConditionsChange: (v: string[]) => void
  consultants: { id: string; commercial_name: string }[]
  selectedConsultants: string[]
  onConsultantsChange: (v: string[]) => void
  priceMin: string
  priceMax: string
  onPriceMinChange: (v: string) => void
  onPriceMaxChange: (v: string) => void
  bedroomsMin: string
  onBedroomsMinChange: (v: string) => void
  bathroomsMin: string
  onBathroomsMinChange: (v: string) => void
  areaUtilMin: string
  areaUtilMax: string
  onAreaUtilMinChange: (v: string) => void
  onAreaUtilMaxChange: (v: string) => void
  yearMin: string
  yearMax: string
  onYearMinChange: (v: string) => void
  onYearMaxChange: (v: string) => void
  hasElevator: boolean
  onHasElevatorChange: (v: boolean) => void
  hasPool: boolean
  onHasPoolChange: (v: boolean) => void
  parkingMin: string
  onParkingMinChange: (v: string) => void
  zone: string
  onZoneChange: (v: string) => void
  addressParish: string
  onAddressParishChange: (v: string) => void
  selectedEnergyCertificates: string[]
  onEnergyCertificatesChange: (v: string[]) => void
  // Management
  missingCover: boolean
  onMissingCoverChange: (v: boolean) => void
  missingOwners: boolean
  onMissingOwnersChange: (v: boolean) => void
  contractExpiringDays: string
  onContractExpiringDaysChange: (v: string) => void
  onClearAll: () => void
}

function Chip({ label, onRemove }: { label: React.ReactNode; onRemove: () => void }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-0.5 text-[11px] font-medium border',
        'bg-muted/60 text-foreground border-border/50',
      )}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-foreground/10 transition-colors"
        aria-label="Remover filtro"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}

function shortPrice(v: string): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M€`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`
  return `${n}€`
}

export function PropertyActiveChips(props: ActiveChipsProps) {
  const {
    search, onClearSearch,
    selectedStatuses, defaultStatuses, onStatusesChange,
    selectedPropertyTypes, onPropertyTypesChange,
    selectedBusinessTypes, onBusinessTypesChange,
    selectedConditions, onConditionsChange,
    consultants, selectedConsultants, onConsultantsChange,
    priceMin, priceMax, onPriceMinChange, onPriceMaxChange,
    bedroomsMin, onBedroomsMinChange,
    bathroomsMin, onBathroomsMinChange,
    areaUtilMin, areaUtilMax, onAreaUtilMinChange, onAreaUtilMaxChange,
    yearMin, yearMax, onYearMinChange, onYearMaxChange,
    hasElevator, onHasElevatorChange,
    hasPool, onHasPoolChange,
    parkingMin, onParkingMinChange,
    zone, onZoneChange,
    addressParish, onAddressParishChange,
    selectedEnergyCertificates, onEnergyCertificatesChange,
    missingCover, onMissingCoverChange,
    missingOwners, onMissingOwnersChange,
    contractExpiringDays, onContractExpiringDaysChange,
    onClearAll,
  } = props

  const chips: React.ReactNode[] = []

  if (search) {
    chips.push(<Chip key="search" label={<>Pesquisa: <span className="font-semibold">"{search}"</span></>} onRemove={onClearSearch} />)
  }

  // Status: skip when the selection equals the default baseline.
  const hasNonDefaultStatus =
    selectedStatuses.length !== defaultStatuses.length ||
    selectedStatuses.some((s) => !defaultStatuses.includes(s))
  if (hasNonDefaultStatus) {
    selectedStatuses.forEach((s) => {
      const meta = PROPERTY_STATUS[s as keyof typeof PROPERTY_STATUS]
      chips.push(
        <Chip key={`status-${s}`}
          label={<>Estado: {meta?.label ?? s}</>}
          onRemove={() => onStatusesChange(selectedStatuses.filter((x) => x !== s))}
        />,
      )
    })
  }

  selectedPropertyTypes.forEach((t) => {
    chips.push(
      <Chip key={`ptype-${t}`}
        label={<>Tipo: {PROPERTY_TYPES[t as keyof typeof PROPERTY_TYPES] ?? t}</>}
        onRemove={() => onPropertyTypesChange(selectedPropertyTypes.filter((x) => x !== t))}
      />,
    )
  })

  selectedBusinessTypes.forEach((b) => {
    chips.push(
      <Chip key={`btype-${b}`}
        label={<>Negócio: {BUSINESS_TYPES[b as keyof typeof BUSINESS_TYPES] ?? b}</>}
        onRemove={() => onBusinessTypesChange(selectedBusinessTypes.filter((x) => x !== b))}
      />,
    )
  })

  selectedConditions.forEach((c) => {
    chips.push(
      <Chip key={`cond-${c}`}
        label={<>Condição: {PROPERTY_CONDITIONS[c as keyof typeof PROPERTY_CONDITIONS] ?? c}</>}
        onRemove={() => onConditionsChange(selectedConditions.filter((x) => x !== c))}
      />,
    )
  })

  selectedConsultants.forEach((id) => {
    const c = consultants.find((x) => x.id === id)
    chips.push(
      <Chip key={`consultor-${id}`}
        label={<>Consultor: {c?.commercial_name ?? '—'}</>}
        onRemove={() => onConsultantsChange(selectedConsultants.filter((x) => x !== id))}
      />,
    )
  })

  if (priceMin || priceMax) {
    chips.push(
      <Chip key="price"
        label={<>Preço: {priceMin ? `≥${shortPrice(priceMin)}` : '−'} · {priceMax ? `≤${shortPrice(priceMax)}` : '−'}</>}
        onRemove={() => { onPriceMinChange(''); onPriceMaxChange('') }}
      />,
    )
  }

  if (bedroomsMin) {
    chips.push(<Chip key="beds" label={<>Tipologia: T{bedroomsMin}+</>} onRemove={() => onBedroomsMinChange('')} />)
  }
  if (bathroomsMin) {
    chips.push(<Chip key="baths" label={<>Casas-de-banho: {bathroomsMin}+</>} onRemove={() => onBathroomsMinChange('')} />)
  }

  if (areaUtilMin || areaUtilMax) {
    chips.push(
      <Chip key="area"
        label={<>Área útil: {areaUtilMin || '−'} · {areaUtilMax || '−'} m²</>}
        onRemove={() => { onAreaUtilMinChange(''); onAreaUtilMaxChange('') }}
      />,
    )
  }

  if (yearMin || yearMax) {
    chips.push(
      <Chip key="year"
        label={<>Ano: {yearMin || '−'} · {yearMax || '−'}</>}
        onRemove={() => { onYearMinChange(''); onYearMaxChange('') }}
      />,
    )
  }

  if (hasElevator) {
    chips.push(<Chip key="elev" label={<>Elevador</>} onRemove={() => onHasElevatorChange(false)} />)
  }
  if (hasPool) {
    chips.push(<Chip key="pool" label={<>Piscina</>} onRemove={() => onHasPoolChange(false)} />)
  }
  if (parkingMin) {
    chips.push(<Chip key="parking" label={<>Estacionamento: {parkingMin}+</>} onRemove={() => onParkingMinChange('')} />)
  }

  if (zone) {
    chips.push(<Chip key="zone" label={<>Zona: {zone}</>} onRemove={() => onZoneChange('')} />)
  }
  if (addressParish) {
    chips.push(<Chip key="parish" label={<>Freguesia: {addressParish}</>} onRemove={() => onAddressParishChange('')} />)
  }

  selectedEnergyCertificates.forEach((c) => {
    chips.push(
      <Chip key={`energy-${c}`}
        label={<>Cert.: {ENERGY_CERTIFICATES[c as keyof typeof ENERGY_CERTIFICATES] ?? c}</>}
        onRemove={() => onEnergyCertificatesChange(selectedEnergyCertificates.filter((x) => x !== c))}
      />,
    )
  })

  if (missingCover) {
    chips.push(<Chip key="missing-cover" label={<>Sem capa</>} onRemove={() => onMissingCoverChange(false)} />)
  }
  if (missingOwners) {
    chips.push(<Chip key="missing-owners" label={<>Sem proprietários</>} onRemove={() => onMissingOwnersChange(false)} />)
  }
  if (contractExpiringDays) {
    chips.push(<Chip key="contract-exp" label={<>Contrato a expirar: {contractExpiringDays}d</>} onRemove={() => onContractExpiringDaysChange('')} />)
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline px-1.5"
        >
          Limpar tudo
        </button>
      )}
    </div>
  )
}
