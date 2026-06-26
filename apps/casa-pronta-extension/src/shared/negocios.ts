// Entry point único para negócios. Hoje aponta para a API real do Infinity ERP.
// Para voltar ao mock em desenvolvimento, troca por:
//   export { fetchNegocios, fetchNegocioPayload } from './mock-negocios'
export { fetchNegocios, fetchNegocioPayload, fetchRequerente } from './infinity-erp'
