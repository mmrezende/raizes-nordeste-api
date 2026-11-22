# Plano de Testes - Rede "Raízes do Nordeste"

Este documento descreve os cenários obrigatórios de validação da API, refletidos na coleção Postman [`test/postman/raizes-nordeste-api.postman_collection.json`](../../test/postman/raizes-nordeste-api.postman_collection.json) e nas suítes automatizadas Jest (`npm test` e `npm run test:e2e`).

## 1. Execução no Postman

1. Inicie a API localmente com o seed aplicado (`npm run prisma:seed && npm run start:dev`).
2. Importe `test/postman/raizes-nordeste-api.postman_collection.json` no Postman.
3. Execute as pastas na ordem numérica (`1` a `7`). Os scripts salvam automaticamente os tokens JWT (`clienteToken`, `cozinhaToken`, `atendenteToken`, `gerenteToken`), os IDs de pedidos (`pedidoId`, `pedidoRecusaId`) e as chaves de idempotência.

## 2. Matriz de Cenários (10 Positivos e 6 Negativos)

| ID | Cenário | Endpoint | Pré-condição | Entrada (resumo) | Saída Esperada | Evidência (Postman) |
|---|---|---|---|---|---|---|
| `T01` | Login válido de cliente | `POST /auth/login` | Seed aplicado (`cliente@exemplo.com`) | `{ "email": "cliente@exemplo.com", "senha": "Senha@123" }` | `200` + `accessToken`, `tokenType: "Bearer"`, `user.perfil: "CLIENTE"` | `1. Auth / T01 - Login cliente válido` |
| `T02` | Consulta pública de cardápio | `GET /unidades/{id}/cardapio` | Seed com produtos e estoque em `REC-01` | Path `unidadeRecifeId`, Query `page=1&limit=10` | `200` + `data[]` com `preco` e `quantidadeDisponivel`, `meta` | `2. Unidades e Cardápio / T02 - Consultar cardápio da unidade REC-01` |
| `T03` | Acesso a rota protegida sem token | `GET /unidades/{id}/estoque` | API em execução | Sem header `Authorization` | `401` + `error: "NAO_AUTENTICADO"`, `requestId` | `2. Unidades e Cardápio / T03 - Consultar estoque sem token (401)` |
| `T04` | Criar pedido `TOTEM` com cupom e pontos | `POST /pedidos` | `T01` executado; `TOTEM10` vigente; 20 pts | `unidadeId`, `canalPedido: "TOTEM"`, `codigoPromocao: "TOTEM10"`, `pontosResgate: 5`, 2x Tapioca | `201` + `status: "AGUARDANDO_PAGAMENTO"`, `canalPedido: "TOTEM"`, `valorTotalCentavos: 4232` | `3. Pedidos e Multicanalidade / T04 - Criar pedido TOTEM com cupom e pontos` |
| `T05` | Filtrar pedidos por canal e status | `GET /pedidos` | `T04` executado (`clienteToken`) | Query `?canalPedido=TOTEM&status=AGUARDANDO_PAGAMENTO` | `200` + `data[]` contendo pedidos `TOTEM` | `3. Pedidos e Multicanalidade / T05 - Filtrar pedidos por canalPedido=TOTEM` |
| `T06` | Campo `canalPedido` ausente | `POST /pedidos` | `T01` executado (`clienteToken`) | Body sem `canalPedido` | `422` + `error: "ERRO_VALIDACAO"`, `details[]` | `3. Pedidos e Multicanalidade / T06 - Criar pedido sem canalPedido (422)` |
| `T07` | Quantidade negativa | `POST /pedidos` | `T01` executado (`clienteToken`) | `canalPedido: "APP"`, `itens: [{ produtoId, quantidade: -1 }]` | `422` + `error: "ERRO_VALIDACAO"`, `details[]` | `3. Pedidos e Multicanalidade / T07 - Criar pedido com quantidade negativa (422)` |
| `T08` | Pedido com produto inexistente | `POST /pedidos` | `T01` executado (`clienteToken`) | `produtoId` UUIDv7 inexistente | `404` + `error: "PRODUTO_NAO_ENCONTRADO"` | `3. Pedidos e Multicanalidade / T08 - Criar pedido com produto inexistente (404)` |
| `T09` | Pedido com estoque insuficiente | `POST /pedidos` | Seed *Bolo de Rolo* com saldo `2` em `REC-01` | `produtoBoloRoloId`, `quantidade: 5` | `409` + `error: "ESTOQUE_INSUFICIENTE"`, `details[]` | `3. Pedidos e Multicanalidade / T09 - Criar pedido com estoque insuficiente (409)` |
| `T10` | Pagamento mock aprovado e pontos | `POST /pagamentos` | `T04` executado (`pedidoId`) | `{ pedidoId, formaPagamento: "PIX", idempotencyKey }` | `201` + `status: "APROVADO"`, `referenciaExterna`, pedido `EM_PREPARO` | `4. Pagamentos Mock / T10 - Processar pagamento aprovado` |
| `T11` | Retentativa idempotente | `POST /pagamentos` | `T10` executado (`idempotencyAprovadoKey`) | Mesma `idempotencyKey` de `T10` | `200` + mesmo `id` de pagamento, sem cobrança nem log duplicado | `4. Pagamentos Mock / T11 - Reenviar pagamento idempotente (200)` |
| `T12` | Pagamento recusado com estorno | `POST /pagamentos` | Novo pedido `APP` criado (`pedidoRecusaId`) | `{ pedidoId: pedidoRecusaId, formaPagamento: "CARTAO_CREDITO", simularRecusa: true }` | `201` + `status: "RECUSADO"`, pedido `PAGAMENTO_RECUSADO`, estoque/pontos estornados | `4. Pagamentos Mock / T12 - Processar pagamento recusado com estorno` |
| `T13` | Perfil sem permissão alterando status | `PATCH /pedidos/{id}/status` | `T10` executado (`clienteToken`) | `{ "status": "PRONTO" }` | `403` + `error: "ACESSO_NEGADO"` | `5. Ciclo de Status / T13 - Cliente tenta atualizar status (403)` |
| `T14` | Cozinha avança pedido para `PRONTO` | `PATCH /pedidos/{id}/status` | `T10` + login `cozinha.rec@raizes.com` | `{ "status": "PRONTO" }` | `200` + `status: "PRONTO"` | `5. Ciclo de Status / T14 - Cozinha marca pedido como PRONTO` |
| `T15` | Atendente finaliza como `ENTREGUE` | `PATCH /pedidos/{id}/status` | `T14` + login `atendente.rec@raizes.com` | `{ "status": "ENTREGUE" }` | `200` + `status: "ENTREGUE"` | `5. Ciclo de Status / T15 - Atendente marca pedido como ENTREGUE` |
| `T16` | Consulta de auditoria (`GERENTE`) | `GET /auditoria` | `T04`, `T14`, `T15` + login `gerente.rec@raizes.com` | Query `?page=1&limit=10&entidade=pedidos` | `200` + `data[]` da unidade `REC-01` com `PEDIDO_CRIADO` e `PEDIDO_STATUS_ATUALIZADO` | `7. Auditoria / T16 - Consultar logs de auditoria de pedidos` |

## 3. Cobertura Automatizada (Jest)

- **Unitários (`npm test`):** 7 suítes (30 testes) cobrindo `UuidV7Generator`, `GlobalExceptionFilter`, `RolesGuard`, `AuditInterceptor`, `HealthController`, `pedido-calculo.rule` e `pedido-status.rule`.
- **E2E HTTP (`npm run test:e2e`):** 6 suítes (34 testes) cobrindo `health`, `auth`, `catalog-stock`, `orders-promotions`, `payments-lifecycle` e `loyalty-lgpd-audit` (incluindo consentimento, anonimização, bloqueio de pedido pós-anonimização, idempotência sem log duplicado e isolamento de auditoria por loja).
