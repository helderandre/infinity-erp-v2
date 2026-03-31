'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OwnerForm } from '@/components/owners/owner-form'
import {
  ArrowLeft,
  UserCircle,
  Building2,
  Home,
  Mail,
  Phone,
  MapPin,
  FileText,
  Pencil,
} from 'lucide-react'
import {
  formatDate,
  formatCurrency,
  PERSON_TYPES,
  MARITAL_STATUS,
  PROPERTY_STATUS,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
} from '@/lib/constants'
import { toast } from 'sonner'
import type { OwnerWithProperties } from '@/types/owner'

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  if (!value || value === '—') return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

export default function OwnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [owner, setOwner] = useState<OwnerWithProperties | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dados')

  const loadOwner = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/owners/${id}`)
      if (!res.ok) throw new Error('Erro ao carregar proprietário')
      const data = await res.json()
      setOwner(data)
    } catch {
      toast.error('Erro ao carregar proprietário')
      router.push('/dashboard/proprietarios')
    } finally {
      setIsLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    loadOwner()
  }, [loadOwner])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!owner) return null

  const isSingular = owner.person_type === 'singular'
  const properties = owner.property_owners?.filter((po) => po.dev_properties) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/proprietarios')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted p-2">
              {isSingular ? (
                <UserCircle className="h-6 w-6 text-muted-foreground" />
              ) : (
                <Building2 className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {owner.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">
                  {PERSON_TYPES[owner.person_type as keyof typeof PERSON_TYPES] ||
                    owner.person_type}
                </Badge>
                {owner.nif && (
                  <span className="font-mono">NIF: {owner.nif}</span>
                )}
                {properties.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Home className="h-3.5 w-3.5" />
                    {properties.length} imóvel(eis)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setActiveTab('editar')}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="imoveis">
            Imóveis ({properties.length})
          </TabsTrigger>
          <TabsTrigger value="editar">Editar</TabsTrigger>
        </TabsList>

        {/* Tab: Dados */}
        <TabsContent value="dados" className="space-y-4">
          {/* Contacto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacto</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <DetailRow
                label="Email"
                value={
                  owner.email ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {owner.email}
                    </span>
                  ) : null
                }
              />
              <DetailRow
                label="Telefone"
                value={
                  owner.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {owner.phone}
                    </span>
                  ) : null
                }
              />
              <DetailRow label="NIF" value={owner.nif} />
              <DetailRow
                label="Morada"
                value={
                  owner.address ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {[owner.address, owner.postal_code, owner.city]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  ) : null
                }
              />
            </CardContent>
          </Card>

          {/* Dados Pessoais / Empresa */}
          {isSingular ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dados Pessoais</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <DetailRow
                    label="Data de Nascimento"
                    value={formatDate(owner.birth_date)}
                  />
                  <DetailRow label="Nacionalidade" value={owner.nationality} />
                  <DetailRow label="Naturalidade" value={owner.naturality} />
                  <DetailRow
                    label="Estado Civil"
                    value={
                      owner.marital_status
                        ? MARITAL_STATUS[
                            owner.marital_status as keyof typeof MARITAL_STATUS
                          ] || owner.marital_status
                        : null
                    }
                  />
                  <DetailRow
                    label="Regime Matrimonial"
                    value={owner.marital_regime}
                  />
                  <DetailRow label="Profissão" value={owner.profession} />
                  <DetailRow
                    label="Última Profissão"
                    value={owner.last_profession}
                  />
                  <DetailRow
                    label="Residente em Portugal"
                    value={
                      owner.is_portugal_resident === null
                        ? null
                        : owner.is_portugal_resident
                          ? 'Sim'
                          : 'Não'
                    }
                  />
                  {!owner.is_portugal_resident && (
                    <DetailRow
                      label="País de Residência"
                      value={owner.residence_country}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Documento de Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <DetailRow
                    label="Tipo"
                    value={owner.id_doc_type}
                  />
                  <DetailRow
                    label="Número"
                    value={owner.id_doc_number}
                  />
                  <DetailRow
                    label="Validade"
                    value={formatDate(owner.id_doc_expiry)}
                  />
                  <DetailRow
                    label="Emitido por"
                    value={owner.id_doc_issued_by}
                  />
                </CardContent>
              </Card>

              {(owner.is_pep || owner.funds_origin?.length) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      PEP / Compliance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <DetailRow
                      label="Pessoa Politicamente Exposta"
                      value={owner.is_pep ? 'Sim' : 'Não'}
                    />
                    {owner.is_pep && (
                      <DetailRow
                        label="Cargo PEP"
                        value={owner.pep_position}
                      />
                    )}
                    {owner.funds_origin && owner.funds_origin.length > 0 && (
                      <DetailRow
                        label="Origem dos Fundos"
                        value={owner.funds_origin.join(', ')}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Representante Legal
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <DetailRow
                    label="Nome"
                    value={owner.legal_representative_name}
                  />
                  <DetailRow
                    label="NIF"
                    value={owner.legal_representative_nif}
                  />
                  <DetailRow
                    label="Documento"
                    value={owner.legal_rep_id_doc}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dados da Empresa</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <DetailRow
                    label="Objecto Social"
                    value={owner.company_object}
                  />
                  <DetailRow
                    label="Natureza Jurídica"
                    value={owner.legal_nature}
                  />
                  <DetailRow
                    label="País de Constituição"
                    value={owner.country_of_incorporation}
                  />
                  <DetailRow label="Código CAE" value={owner.cae_code} />
                  <DetailRow label="Código RCBE" value={owner.rcbe_code} />
                  <DetailRow
                    label="Sucursais"
                    value={owner.company_branches}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {/* Observações */}
          {owner.observations && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {owner.observations}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Metadados */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-6 text-xs text-muted-foreground">
                <span>Criado: {formatDate(owner.created_at)}</span>
                <span>Actualizado: {formatDate(owner.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Imóveis */}
        <TabsContent value="imoveis" className="space-y-4">
          {properties.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Home className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum imóvel associado a este proprietário.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Imóveis Associados
                </CardTitle>
                <CardDescription>
                  {properties.length} imóvel(eis) associado(s) a este
                  proprietário
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Negócio</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>% Propriedade</TableHead>
                      <TableHead>Contacto Principal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties.map((po) => {
                      const p = po.dev_properties!
                      const statusConfig =
                        PROPERTY_STATUS[
                          p.status as keyof typeof PROPERTY_STATUS
                        ]
                      return (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(`/dashboard/imoveis/${p.slug || p.id}`)
                          }
                        >
                          <TableCell className="font-medium">
                            {p.title || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {PROPERTY_TYPES[
                              p.property_type as keyof typeof PROPERTY_TYPES
                            ] || p.property_type || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {BUSINESS_TYPES[
                              p.business_type as keyof typeof BUSINESS_TYPES
                            ] || p.business_type || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.city || '—'}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(p.listing_price)}
                          </TableCell>
                          <TableCell>
                            {statusConfig ? (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${statusConfig.dot}`}
                                />
                                {statusConfig.label}
                              </span>
                            ) : (
                              p.status || '—'
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {po.ownership_percentage != null
                              ? `${po.ownership_percentage}%`
                              : '100%'}
                          </TableCell>
                          <TableCell className="text-center">
                            {po.is_main_contact ? (
                              <Badge variant="default" className="text-xs">
                                Sim
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">
                                Não
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Editar */}
        <TabsContent value="editar">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Editar Proprietário</CardTitle>
              <CardDescription>
                Actualize os dados do proprietário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OwnerForm
                owner={owner}
                onSuccess={(updated) => {
                  setOwner((prev) =>
                    prev ? { ...prev, ...updated } : prev
                  )
                  setActiveTab('dados')
                  toast.success('Proprietário actualizado com sucesso')
                }}
                onCancel={() => setActiveTab('dados')}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
