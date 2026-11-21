# Plano de Testes — Rede "Raízes do Nordeste"

Este documento descreve os cenários mínimos obrigatórios de validação da API REST, refletidos diretamente na coleção executável Postman em [`test/postman/raizes-nordeste-api.postman_collection.json`](../../test/postman/raizes-nordeste-api.postman_collection.json) e complementados pelas suítes automatizadas Jest (`npm test` e `npm run test:e2e`).

---

## 1. Pré-requisitos e Ordem de Execução no Postman

1. Subir a API localmente com o seed aplicado (`npm run prisma:seed && npm run start:dev`).
2. Importar o arquivo [`test/postman/raizes-nordeste-api.postman_collection.json`](../../test/postman/raizes-nordeste-api.postman_collection.json) no Postman.
3. Executar as pastas na ordem numérica (`1` → `7`). Os scripts da coleção capturam automaticamente os tokens JWT (`clienteToken`, `cozinhaToken`, `atendenteToken`, `gerenteToken`), os IDs de pedidos criados (`pedidoId`, `pedidoRecusaId`) e geram chaves de idempotência únicas por execução.

---

## 2. Cenários de Teste (10 Positivos + 6 Negativos = 16 Cenários)

| ID | Cenário | Endpoint | Pré-condição | Entrada (resumo) | Esperado (Status + Trecho Response) | Evidência (Nome na Coleção Postman) |
|---|---|---|---|---|---|---|
| **T01** | Login válido de cliente | `POST /auth/login` | Seed aplicado (`cliente@exemplo.com`) | `{ "email": "cliente@exemplo.com", "senha": "Senha@123" }` | `200` + `accessToken`, `tokenType: "Bearer"`, `user.perfil: "CLIENTE"` | `1. Auth / T01 - Login cliente válido` |
| **T02** | Consulta pública de cardápio por unidade | `GET /unidades/{id}/cardapio` | Seed com produtos e estoque em `REC-01` | Path `unidadeRecifeId`, Query `page=1&limit=10` | `200` + `data[]` com `preco` e `quantidadeDisponivel`, `meta` | `2. Unidades e Cardápio / T02 - Consultar cardápio da unidade REC-01` |
| **T03** | Acesso a rota protegida sem token | `GET /unidades/{id}/estoque` | API em execução | Sem header `Authorization` | `401` + `error: "NAO_AUTENTICADO"`, `requestId` | `2. Unidades e Cardápio / T03 - Consultar estoque sem token (401)` |
| **T04** | Criar pedido válido no canal `TOTEM` com cupom e resgate | `POST /pedidos` | `T01` executado; `TOTEM10` vigente; 20 pts fidelidade | `unidadeId`, `canalPedido: "TOTEM"`, `codigoPromocao: "TOTEM10"`, `pontosResgate: 5`, 2x Tapioca | `201` + `status: "AGUARDANDO_PAGAMENTO"`, `canalPedido: "TOTEM"`, `valorTotalCentavos: 4232` | `3. Pedidos e Multicanalidade / T04 - Criar pedido TOTEM com cupom e pontos` |
| **T05** | Filtrar pedidos por canal e status | `GET /pedidos` | `T04` executado (`clienteToken`) | Query `?canalPedido=TOTEM&status=AGUARDANDO_PAGAMENTO` | `200` + `data[]` contendo pedidos `TOTEM` | `3. Pedidos e Multicanalidade / T05 - Filtrar pedidos por canalPedido=TOTEM` |
| **T06** | Campo obrigatório `canalPedido` ausente | `POST /pedidos` | `T01` executado (`clienteToken`) | Body sem `canalPedido` | `422` + `error: "ERRO_VALIDACAO"`, `details[]` | `3. Pedidos e Multicanalidade / T06 - Criar pedido sem canalPedido (422)` |
| **T07** | Tipo/valor inválido (quantidade negativa) | `POST /pedidos` | `T01` executado (`clienteToken`) | `canalPedido: "APP"`, `itens: [{ produtoId, quantidade: -1 }]` | `422` + `error: "ERRO_VALIDACAO"`, `details[]` | `3. Pedidos e Multicanalidade / T07 - Criar pedido com quantidade negativa (422)` |
| **T08** | Pedido com produto inexistente | `POST /pedidos` | `T01` executado (`clienteToken`) | `produtoId` UUIDv7 inexistente | `404` + `error: "PRODUTO_NAO_ENCONTRADO"` | `3. Pedidos e Multicanalidade / T08 - Criar pedido com produto inexistente (404)` |
| **T09** | Pedido com estoque insuficiente | `POST /pedidos` | Seed `Bolo de Rolo` com saldo `2` em `REC-01` | `produtoBoloRoloId`, `quantidade: 5` | `409` + `error: "ESTOQUE_INSUFICIENTE"`, `details[]` com disponível | `3. Pedidos e Multicanalidade / T09 - Criar pedido com estoque insuficiente (409)` |
| **T10** | Pagamento mock aprovado e acúmulo de pontos | `POST /pagamentos` | `T04` executado (`pedidoId` criado) | `{ pedidoId, formaPagamento: "PIX", idempotencyKey }` | `201` + `status: "APROVADO"`, `referenciaExterna`, pedido vai para `EM_PREPARO` | `4. Pagamentos Mock / T10 - Processar pagamento aprovado` |
| **T11** | Retentativa idempotente de pagamento | `POST /pagamentos` | `T10` executado (`idempotencyAprovadoKey`) | Mesma `idempotencyKey` de `T10` | `200` + mesmo `id` de pagamento, sem cobrança ou acúmulo duplicado | `4. Pagamentos Mock / T11 - Reenviar pagamento idempotente (200)` |
| **T12** | Pagamento mock recusado com estorno | `POST /pagamentos` | Novo pedido `APP` criado (`pedidoRecusaId`) | `{ pedidoId: pedidoRecusaId, formaPagamento: "CARTAO_CREDITO", simularRecusa: true }` | `201` + `status: "RECUSADO"`, pedido passa a `PAGAMENTO_RECUSADO` e estoque/pontos estornam | `4. Pagamentos Mock / T12 - Processar pagamento recusado com estorno` |
| **T13** | Acesso com perfil sem permissão (Cliente mudando status) | `PATCH /pedidos/{id}/status` | `T10` executado (`clienteToken`) | `{ "status": "PRONTO" }` | `403` + `error: "ACESSO_NEGADO"` | `5. Ciclo de Status / T13 - Cliente tenta atualizar status (403)` |
| **T14** | Cozinha avança pedido para `PRONTO` | `PATCH /pedidos/{id}/status` | `T10` executado + login `cozinha.rec@raizes.com` | `{ "status": "PRONTO" }` | `200` + `status: "PRONTO"` | `5. Ciclo de Status / T14 - Cozinha marca pedido como PRONTO` |
| **T15** | Atendente finaliza pedido como `ENTREGUE` | `PATCH /pedidos/{id}/status` | `T14` executado + login `atendente.rec@raizes.com` | `{ "status": "ENTREGUE" }` | `200` + `status: "ENTREGUE"` | `5. Ciclo de Status / T15 - Atendente marca pedido como ENTREGUE` |
| **T16** | Consulta de trilha de auditoria (`GERENTE`) | `GET /auditoria` | `T04`, `T14`, `T15` executados + login `gerente.rec@raizes.com` | Query `?page=1&limit=10&entidade=pedidos` | `200` + `data[]` contendo ações `PEDIDO_CRIADO` e `PEDIDO_STATUS_ATUALIZADO` | `7. Auditoria / T16 - Consultar logs de auditoria de pedidos` |

---

## 3. Cobertura Automatizada Adicional

Além da coleção Postman, todas as regras de negócio, fluxos de erro, consentimento e anonimização LGPD (`DELETE /usuarios/me`) são executados automaticamente pelo Jest:

- **Unitários (`npm test`):** `UuidV7Generator`, `GlobalExceptionFilter`, `RolesGuard`, `AuditInterceptor`, `HealthController`, `pedido-calculo.rule` e `pedido-status.rule`.
- **E2E HTTP (`npm run test:e2e`):** `health`, `auth`, `catalog-stock`, `orders-promotions`, `payments-lifecycle` e `loyalty-lgpd-audit`.
