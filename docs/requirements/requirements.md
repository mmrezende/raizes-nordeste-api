# Análise e Requisitos - Rede "Raízes do Nordeste"

## 1. Contexto e Objetivo

A rede **Raízes do Nordeste** trabalha no modelo de matriz e múltiplas lojas (unidades). A matriz define o catálogo de produtos, as campanhas promocionais e os perfis de acesso, enquanto cada loja controla seu saldo de estoque e a fila de preparo.

A API REST unifica os pedidos de cinco canais (`APP`, `TOTEM`, `BALCAO`, `PICKUP` e `WEB`), exigindo `canalPedido` na origem, reservando estoque exclusivamente na unidade escolhida, integrando um gateway simulado de pagamento com chave de idempotência e mantendo um programa de fidelidade com consentimento explícito e trilha de auditoria.

## 2. Requisitos Funcionais

### Auth e Usuários (RBAC)
- Cadastro público de clientes (`POST /auth/register`), autenticação com emissão de token JWT (`POST /auth/login`) e consulta ao perfil autenticado (`GET /usuarios/me`).
- Cadastro de equipe interna (`POST /usuarios`) restrito a `ADMIN` e `GERENTE` (o gerente só pode cadastrar `ATENDENTE` e `COZINHA` na própria unidade).
- Perfis suportados: `CLIENTE`, `ATENDENTE`, `COZINHA`, `GERENTE` e `ADMIN`. Funcionários de loja ficam vinculados a uma `unidadeId`; `CLIENTE` e `ADMIN` permanecem com `unidadeId = null`.
- Anonimização do titular autenticado (`DELETE /usuarios/me`) preservando o histórico de pedidos.

### Unidades, Produtos e Estoque
- Cadastro (`ADMIN`) e listagem paginada de unidades ativas (`GET /unidades`).
- Cadastro (`ADMIN`) e listagem paginada de produtos da matriz (`GET /produtos`), com preço único em centavos (`precoCentavos`) e filtro opcional por categoria.
- Consulta pública de cardápio por loja (`GET /unidades/:id/cardapio`), exibindo apenas produtos ativos com `disponivelVenda = true` e saldo positivo.
- Movimentação manual de estoque (`ENTRADA` e `SAIDA`) e consulta de saldos por unidade (`GET /unidades/:id/estoque`), restrita a `ADMIN` ou equipe da própria loja.

### Pedidos e Multicanalidade
- Criação de pedido vinculada à unidade e ao cliente, exigindo `canalPedido` (`APP`, `TOTEM`, `BALCAO`, `PICKUP`, `WEB`, retornando `422` quando ausente ou inválido).
- Cálculo de subtotal, desconto de promoção, resgate de pontos e total feito apenas no servidor.
- Listagem paginada com filtros por `canalPedido`, `status` e `unidadeId`, respeitando o escopo do usuário autenticado.
- Ciclo de vida controlado por perfil: `AGUARDANDO_PAGAMENTO` -> `EM_PREPARO` (após aprovação do pagamento) -> `PRONTO` (`COZINHA`/`GERENTE`/`ADMIN`) -> `ENTREGUE` (`ATENDENTE`/`GERENTE`/`ADMIN`), além de `PAGAMENTO_RECUSADO` e `CANCELADO`.

### Promoções e Pagamento Simulado
- Cadastro (`ADMIN`) e listagem pública de cupons (`PERCENTUAL` ou `VALOR_FIXO`), validando vigência, status ativo, valor mínimo e restrições opcionais por canal ou unidade.
- Processamento de pagamento desacoplado via interface `PaymentGateway` com implementação `MockPaymentGateway`, registrando status (`PENDENTE`, `APROVADO`, `RECUSADO`), referência externa e payload simulado.
- Idempotência via `idempotencyKey`: retentativas retornam o pagamento já gravado (`200 OK`) sem cobrar ou pontuar de novo; conflito de chave entre pedidos retorna `409`.

### Fidelidade, LGPD e Auditoria
- Consulta de saldo (`GET /fidelidade/conta`), histórico paginado (`GET /fidelidade/movimentacoes`) e gestão explícita de consentimento (`PATCH /fidelidade/consentimento`).
- Acúmulo após pagamento aprovado (`1` ponto a cada `R$ 10,00` no valor final) e resgate como desconto na criação do pedido (`1` ponto = `R$ 0,50`), ambos condicionados a `consentimentoAtivo = true`.
- Registro automático de ações sensíveis via `AuditInterceptor` em `logs_auditoria` e consulta filtrável em `GET /auditoria` (`ADMIN` vê toda a rede; `GERENTE` vê apenas eventos da própria loja).

## 3. Regras de Negócio

- **RN01 - Canal obrigatório:** pedidos sem `canalPedido` válido são rejeitados com `422 ERRO_VALIDACAO`.
- **RN02 - Estoque isolado por loja:** validação, reserva e estorno ocorrem somente no registro `(unidadeId, produtoId)` da unidade do pedido.
- **RN03 - Reserva e estorno:** o estoque é abatido na mesma transação de criação do pedido (`RESERVA`) e devolvido (`ESTORNO`) se o pagamento for recusado ou o pedido for cancelado antes da entrega.
- **RN04 - Preço congelado em centavos:** cada item grava `precoUnitarioCentavos` da compra; valores monetários ficam em `Int` no banco e são convertidos para reais apenas na serialização de saída.
- **RN05 - Idempotência no pagamento:** chamadas repetidas com a mesma `idempotencyKey` devolvem `200 OK` com o pagamento original, sem alterar saldo de pontos nem registrar log duplicado.
- **RN06 - Fidelidade condicionada ao consentimento:** sem `consentimentoAtivo = true`, não há acúmulo de pontos e qualquer tentativa de resgate retorna `409 FIDELIDADE_SEM_CONSENTIMENTO`.

## 4. Requisitos Não Funcionais

- **Segurança:** senhas com `bcryptjs` (custo 10), autenticação JWT stateless, RBAC global com `JwtAuthGuard` e `RolesGuard`, omissão de `senhaHash` nas respostas e filtro de metadados no `AuditInterceptor`.
- **Consistência:** criação de pedido, reserva de estoque e processamento de pagamento/estorno rodam em transações Prisma; listagens são paginadas (`page`, `limit`) e as chaves primárias usam UUIDv7 gerado na aplicação (com `@default(uuid(7))` no schema como fallback).
- **Contrato REST:** recursos no plural, IDs no path, status codes `200`, `201`, `401`, `403`, `404`, `409`, `422`, header `X-Request-Id` em toda resposta e JSON de erro único via `GlobalExceptionFilter`.
- **Documentação executável:** Swagger em `/docs` gerado dos DTOs reais e banco SQLite local com migrations e seed.

## 5. Escopo Atual vs. Fase 2

| Escopo | Itens | Motivo |
|---|---|---|
| Implementado (MVP) | Auth/RBAC, Unidades, Produtos, Estoque por loja, Pedidos com `canalPedido`, Promoções, Pagamento mock idempotente, Fidelidade, Anonimização LGPD e Auditoria. | Cobre os fluxos essenciais da rede com regras transacionais reais e execução local em SQLite. |
| Planejado (Fase 2) | Gateway real com webhooks, notificações assíncronas (WebSocket/SSE para cozinha e e-mail), revogação imediata de JWT em Redis, PostgreSQL em produção e edição/inativação de catálogo. | O uso de portas na aplicação (`PaymentGateway`, `AuditLogger`, `PasswordHasher`, `IdGenerator`) permite trocar provedores sem alterar as regras de cálculo e status. |

## 6. Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---|---|---|
| Back-end | NestJS 12 + TypeScript em 4 camadas | Organização modular, DI nativa, validação declarativa com DTOs e Swagger integrado, mantendo regras de domínio puras fora do HTTP/ORM. |
| Persistência | SQLite + Prisma 6 | Relacional completo com FKs, chaves únicas compostas e transações em arquivo local; portável para PostgreSQL ajustando `provider` e `DATABASE_URL`. |
| Identificadores | UUIDv7 | Evita enumeração sequencial nas rotas e preserva ordenação temporal nos índices B-tree. |
| Valores monetários | Inteiros em centavos (`Int`) | Evita erros de arredondamento de ponto flutuante nos cálculos de desconto. |
| Reserva de estoque | Baixa na criação + estorno na falha/cancelamento | Impede venda duplicada do último item sem deixar saldo bloqueado em recusas ou cancelamentos. |
| Fidelidade | Saldo consolidado + histórico | Evita somar todo o histórico a cada pedido, mantendo rastreabilidade das movimentações na mesma transação. |
