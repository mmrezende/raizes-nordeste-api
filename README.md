# Raízes do Nordeste API

**Instituição:** Centro Universitário Internacional UNINTER - Escola Superior Politécnica (ESP)  
**Disciplina:** Projeto Multidisciplinar - Trilha Back-End (Análise e Desenvolvimento de Sistemas)  
**Autor:** Mateus Mendonça Dias Rezende (RU: `4841127`)  
**Professora:** Prof. Me. Luciane Yanase Kanashiro  
**Ano:** 2026  
**Entrega final (PDF ABNT):** `4841127_Projeto_Back_End.PDF`

---

## Sumário

1. [Introdução e Objetivos](#1-introdução-e-objetivos)
2. [Análise do Problema e Requisitos](#2-análise-do-problema-e-requisitos)
3. [Modelagem e Arquitetura](#3-modelagem-e-arquitetura)
4. [API e Endpoints (Contratos REST)](#4-api-e-endpoints-contratos-rest)
5. [LGPD, Privacidade e Segurança no Back-End](#5-lgpd-privacidade-e-segurança-no-back-end)
6. [Entrega Técnica e Execução Local](#6-entrega-técnica-e-execução-local)
7. [Plano de Testes e Evidências](#7-plano-de-testes-e-evidências)
8. [Conclusão](#8-conclusão)
9. [Referências](#9-referências)

---

## 1. Introdução e Objetivos

A rede de lanchonetes **Raízes do Nordeste** opera no modelo de matriz e múltiplas unidades (lojas). Com a expansão para múltiplos pontos de contato - aplicativo móvel (`APP`), totens de autoatendimento (`TOTEM`), navegador (`WEB`), retirada rápida (`PICKUP`) e balcão presencial (`BALCAO`) - tornou-se necessário centralizar o catálogo, as promoções e o programa de fidelidade na matriz, mantendo o controle de estoque e a fila de preparo isolados por loja.

O objetivo deste projeto é entregar uma API REST funcional em **NestJS + TypeScript + Prisma (SQLite)** com persistência transacional real, exigência e rastreabilidade de `canalPedido`, pagamento simulado idempotente, controle de acesso por perfil e unidade (RBAC), conformidade mínima com a LGPD, auditoria automática, documentação executável via Swagger/OpenAPI e suíte reproduzível de testes automatizados e no Postman.

---

## 2. Análise do Problema e Requisitos

Documento completo de requisitos: [`docs/requirements/requirements.md`](./docs/requirements/requirements.md).

### 2.1 Requisitos Funcionais (RF)

- **Auth e Usuários (RBAC):** cadastro público de clientes (`POST /auth/register`), login JWT (`POST /auth/login`), consulta do perfil autenticado (`GET /usuarios/me`), cadastro interno (`POST /usuarios` para `ADMIN` e `GERENTE` na própria loja) e anonimização do titular (`DELETE /usuarios/me`). Perfis: `CLIENTE`, `ATENDENTE`, `COZINHA`, `GERENTE` e `ADMIN`.
- **Unidades, Produtos e Estoque:** gestão de unidades e catálogo da matriz (`ADMIN`), consulta pública de cardápio disponível por loja (`GET /unidades/:id/cardapio`) e movimentação/consulta de saldo por `(unidadeId, produtoId)` (`POST /estoque/movimentacoes`, `GET /unidades/:id/estoque`).
- **Pedidos e Multicanalidade:** criação de pedido (`POST /pedidos`) exigindo `canalPedido` (`APP`, `TOTEM`, `BALCAO`, `PICKUP`, `WEB`), cálculo de valores exclusivamente no servidor, listagem paginada com filtros (`?canalPedido=&status=&unidadeId=`), ciclo operacional (`AGUARDANDO_PAGAMENTO` -> `EM_PREPARO` -> `PRONTO` -> `ENTREGUE`, além de `PAGAMENTO_RECUSADO` e `CANCELADO`).
- **Promoções e Pagamento Mock:** cupons `PERCENTUAL` ou `VALOR_FIXO` com validação de vigência, valor mínimo, canal e unidade; cobrança simulada via interface `PaymentGateway` (`MockPaymentGateway`) com `idempotencyKey`, suporte a `simularRecusa` e retorno do payload simulado.
- **Fidelidade e Auditoria:** conta de pontos sob consentimento explícito (`1 ponto` a cada `R$ 10,00` pagos; resgate `1 ponto = R$ 0,50`) e registro automático de ações críticas em `logs_auditoria` (`GET /auditoria`).

### 2.2 Regras de Negócio Principais

- **RN01 - Canal obrigatório:** criação de pedido sem `canalPedido` válido retorna `422 ERRO_VALIDACAO`.
- **RN02 - Estoque isolado por loja:** validação, reserva e estorno ocorrem apenas no saldo `(unidadeId, produtoId)` da loja do pedido.
- **RN03 - Reserva e estorno atômico:** o saldo é abatido na criação do pedido (`RESERVA`) e devolvido (`ESTORNO`) em recusa de pagamento ou cancelamento; cancelamentos também estornam pontos acumulados (`ACUMULO`), e clientes não podem cancelar pedidos já marcados como `PRONTO`.
- **RN04 - Preço congelado em centavos:** valores monetários são armazenados como inteiros (`Int`) e gravados no item no momento da compra, sendo convertidos em reais apenas na resposta.
- **RN05 - Idempotência no pagamento:** retentativas com a mesma `idempotencyKey` devolvem `200 OK` com o pagamento original, sem cobrar, pontuar ou auditar novamente.
- **RN06 - Fidelidade sob consentimento:** sem `consentimentoAtivo = true`, não há acúmulo de pontos e resgates retornam `409 FIDELIDADE_SEM_CONSENTIMENTO`.

### 2.3 Requisitos Não Funcionais (RNF)

- **Segurança e LGPD:** senhas com `bcryptjs` (custo 10), JWT stateless validado contra usuário ativo/não anonimizado, RBAC por perfil e escopo de loja, omissão de `senhaHash` e trilha de auditoria sem dados sensíveis.
- **Consistência e Contrato REST:** transações Prisma nos fluxos críticos (incluindo atualização atômica de status no pagamento), UUIDv7 (`uuidv7`), paginação padrão (`?page=1&limit=10`), `X-Request-Id` em toda resposta e JSON único de erro via `GlobalExceptionFilter` (inclusive `P2002` -> `409 CONFLITO_UNICIDADE`).

### 2.4 Priorização e Decisões Técnicas

| Escopo | Itens | Justificativa |
|---|---|---|
| **Implementado (MVP)** | Auth/RBAC, Unidades, Produtos, Estoque por loja, Pedidos com `canalPedido`, Promoções, Ciclo de status, Pagamento mock idempotente, Fidelidade, Anonimização LGPD e Auditoria. | Fecha ponta a ponta os dois fluxos críticos (Pedido + Pagamento e Estoque por Unidade) sem dependências externas na avaliação. |
| **Planejado (Fase 2)** | Gateway real com webhooks, WebSocket/SSE para cozinha e e-mail, revogação de JWT em Redis, PostgreSQL em produção e edição/inativação de catálogo. | Portas em `src/application/ports` permitem substituir provedores externos sem alterar regras de domínio. |

| Decisão | Escolha | Justificativa |
|---|---|---|
| Back-end | NestJS 12 + TypeScript (4 camadas) | Modularização, DI nativa, validação declarativa com DTOs e Swagger integrado. |
| Banco e ORM | SQLite + Prisma 6 | Relacional completo com FKs, chaves únicas compostas e transações em arquivo local; portável para PostgreSQL. |
| Identificadores | UUIDv7 (`uuidv7`) | Evita enumeração sequencial em URLs e mantém ordenação temporal em índices B-tree. |
| Valores monetários | Inteiro em centavos (`Int`) | Elimina erros de ponto flutuante nos cálculos de desconto e pontuação. |

---

## 3. Modelagem e Arquitetura

Índice dos diagramas e arquivos-fonte: [`docs/diagrams/README.md`](./docs/diagrams/README.md).  
Os diagramas renderizados para composição do PDF final ficam em [`docs/diagrams/img/`](./docs/diagrams/img).

### 3.1 Casos de Uso e Fluxos Críticos

![Diagrama de Casos de Uso](./docs/diagrams/img/use-cases.png)

- Fonte editável: [`docs/diagrams/use-cases.puml`](./docs/diagrams/use-cases.puml) | Especificação detalhada: [`docs/requirements/use-cases.md`](./docs/requirements/use-cases.md).
- **Atores:** `Cliente` (`APP`/`WEB`/`TOTEM`/`PICKUP`), `Atendente` (`BALCAO`), `Cozinha`, `Gerente`, `Administrador` e `Gateway de Pagamento (Mock)`.
- **Features críticas detalhadas:** `UC04` (Realizar Pedido Multicanal com reserva atômica de estoque, cupom e pontos) + `UC07` (Solicitar Pagamento Mock com idempotência, aprovação/recusa e estorno) e `UC09` (Atualizar Status / Cancelar Pedido por perfil e unidade).

### 3.2 Modelo de Dados (DER)

![Diagrama Entidade-Relacionamento](./docs/diagrams/img/der.png)

- Fonte DBML: [`docs/diagrams/der.dbml`](./docs/diagrams/der.dbml) | Schema Prisma: [`prisma/schema.prisma`](./prisma/schema.prisma) | Migration: [`prisma/migrations/20261122000853_init/migration.sql`](./prisma/migrations/20261122000853_init/migration.sql).
- **12 tabelas relacionais:** `unidades`, `usuarios`, `produtos`, `estoque_unidades` (`unique(unidade_id, produto_id)`), `promocoes` (`codigo` único), `pedidos`, `itens_pedido` (`unique(pedido_id, produto_id)`), `movimentacoes_estoque`, `pagamentos` (`idempotency_key` único), `contas_fidelidade` (`usuario_id` único), `movimentacoes_fidelidade` e `logs_auditoria`.

### 3.3 Arquitetura em 4 Camadas

![Arquitetura em 4 Camadas](./docs/diagrams/img/architecture.png)

- Fonte Mermaid: [`docs/diagrams/architecture.mmd`](./docs/diagrams/architecture.mmd).

```text
├── docs/                  # Requisitos, casos de uso, LGPD, plano de testes, diagramas e relatório
├── prisma/                # Schema Prisma, migrations, seed.ts, dev.db e test-e2e.db (ignorado)
├── src/
│   ├── domain/            # Enums puros, DomainError, regras de cálculo/status e centavos
│   ├── application/       # Casos de uso por módulo, helpers compartilhados e portas
│   ├── infrastructure/    # PrismaService, env, JWT/bcryptjs, uuidv7, PrismaAuditLogger e MockPaymentGateway
│   └── api/               # Controllers, DTOs, módulos, guards, AuditInterceptor, GlobalExceptionFilter e Swagger
└── test/
    ├── unit/              # Testes unitários (7 suítes, 34 testes)
    ├── e2e/               # Testes HTTP integrados com SQLite isolado (6 suítes, 35 testes)
    └── postman/           # Coleção Postman v2.1.0 (T01-T16 + Fidelidade/LGPD)
```

### 3.4 Diagrama de Classes e Sequência

![Diagrama de Classes](./docs/diagrams/img/classes.png)

![Diagrama de Sequência - Pedido e Pagamento](./docs/diagrams/img/sequence-order-payment.png)

- Fontes: [`docs/diagrams/classes.mmd`](./docs/diagrams/classes.mmd) e [`docs/diagrams/sequence-order-payment.mmd`](./docs/diagrams/sequence-order-payment.mmd).

---

## 4. API e Endpoints (Contratos REST)

- **Padrão REST:** recursos no plural, IDs no path, paginação `?page=1&limit=10`, header `X-Request-Id` em toda resposta e Swagger gerado diretamente dos DTOs em `/docs`.
- **Padrão único de erro:** `{ error, message, details, timestamp, path, requestId }` (`401`, `403`, `404`, `409`, `422`, `500`).

### 4.1 Resumo dos Endpoints

| Módulo | Método e Rota | Auth / Perfis | Descrição |
|---|---|---|---|
| Health | `GET /health` | Público | Verifica disponibilidade da API e conexão com o banco |
| Auth | `POST /auth/register` | Público | Cadastra cliente e inicializa conta de fidelidade |
| Auth | `POST /auth/login` | Público | Autentica usuário e retorna JWT (`expiresIn` em segundos) |
| Usuários | `GET /usuarios/me` | JWT (todos) | Retorna perfil do usuário autenticado sem `senhaHash` |
| Usuários | `DELETE /usuarios/me` | JWT (todos) | Anonimiza dados pessoais do titular preservando pedidos |
| Usuários | `POST /usuarios` | JWT (`ADMIN`, `GERENTE` da loja) | Cadastra usuário interno vinculado à unidade |
| Unidades | `GET /unidades` | Público | Lista unidades ativas paginadas |
| Unidades | `POST /unidades` | JWT (`ADMIN`) | Cadastra nova unidade da rede |
| Unidades | `GET /unidades/:id/cardapio` | Público | Lista itens ativos com saldo positivo na loja |
| Unidades | `GET /unidades/:id/estoque` | JWT (`ADMIN`, equipe da loja) | Consulta saldos de estoque da unidade |
| Produtos | `GET /produtos` | Público | Lista catálogo da matriz (filtro opcional `?categoria=`) |
| Produtos | `POST /produtos` | JWT (`ADMIN`) | Cadastra novo produto no catálogo |
| Estoque | `POST /estoque/movimentacoes` | JWT (`ADMIN`, `GERENTE` da loja) | Registra `ENTRADA` ou `SAIDA` manual por unidade |
| Promoções | `GET /promocoes` | Público | Lista cupons (filtros `ativo`, `canalAplicavel`, `unidadeId`) |
| Promoções | `POST /promocoes` | JWT (`ADMIN`) | Cria campanha promocional |
| Pedidos | `POST /pedidos` | JWT (`CLIENTE`, `ATENDENTE`, `GERENTE`, `ADMIN`) | Cria pedido exigindo `canalPedido`, reserva estoque e aplica descontos |
| Pedidos | `GET /pedidos` | JWT (escopo do usuário) | Lista pedidos (filtros `?canalPedido=&status=&unidadeId=`) |
| Pedidos | `GET /pedidos/:id` | JWT (dono ou loja/`ADMIN`) | Consulta pedido por ID |
| Pedidos | `PATCH /pedidos/:id/status` | JWT (`COZINHA` -> `PRONTO`; `ATENDENTE` -> `ENTREGUE`; `GERENTE`/`ADMIN`) | Avança etapa operacional |
| Pedidos | `POST /pedidos/:id/cancelar` | JWT (dono até `EM_PREPARO`; loja/`ADMIN` até `PRONTO`) | Cancela pedido e estorna estoque e pontos |
| Pagamentos | `POST /pagamentos` | JWT (dono ou loja/`ADMIN`) | Processa pagamento mock idempotente (`201` novo, `200` retry) |
| Fidelidade | `GET /fidelidade/conta` | JWT (todos) | Consulta saldo de pontos e consentimento |
| Fidelidade | `PATCH /fidelidade/consentimento` | JWT (todos) | Ativa ou revoga consentimento LGPD |
| Fidelidade | `GET /fidelidade/movimentacoes` | JWT (todos) | Lista extrato paginado de pontos |
| Auditoria | `GET /auditoria` | JWT (`ADMIN` geral; `GERENTE` própria loja) | Consulta logs filtráveis por `entidade` e `acao` |

### 4.2 Exemplos de Contrato (Request / Response / Erro)

**`POST /auth/login` (Request e Response `200`):**

```json
// Request
{
  "email": "cliente@exemplo.com",
  "senha": "Senha@123"
}

// Response 200 OK
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "019c6199-df00-7000-8000-000000000305",
    "nome": "Maria Cliente",
    "email": "cliente@exemplo.com",
    "perfil": "CLIENTE",
    "unidadeId": null
  }
}
```

**`POST /pedidos` (Request e Response `201`) e filtro `GET /pedidos?canalPedido=TOTEM&status=AGUARDANDO_PAGAMENTO`:**

```json
// Request
{
  "unidadeId": "019c6199-df00-7000-8000-000000000101",
  "canalPedido": "TOTEM",
  "codigoPromocao": "TOTEM10",
  "pontosResgate": 5,
  "itens": [
    { "produtoId": "019c6199-df00-7000-8000-000000000201", "quantidade": 2 }
  ]
}

// Response 201 Created
{
  "id": "019c6199-df00-7a00-8f41-9c2a1b3e4f77",
  "unidadeId": "019c6199-df00-7000-8000-000000000101",
  "clienteId": "019c6199-df00-7000-8000-000000000305",
  "promocaoId": "019c6199-df00-7000-8000-000000000501",
  "canalPedido": "TOTEM",
  "status": "AGUARDANDO_PAGAMENTO",
  "subtotalCentavos": 4980,
  "subtotal": 49.8,
  "descontoPromocaoCentavos": 498,
  "descontoPromocao": 4.98,
  "pontosUtilizados": 5,
  "descontoFidelidadeCentavos": 250,
  "descontoFidelidade": 2.5,
  "valorTotalCentavos": 4232,
  "valorTotal": 42.32,
  "itens": [
    {
      "id": "019c6199-df00-7a00-8f41-9c2a1b3e4f88",
      "produtoId": "019c6199-df00-7000-8000-000000000201",
      "quantidade": 2,
      "precoUnitarioCentavos": 2490,
      "precoUnitario": 24.9,
      "subtotalCentavos": 4980,
      "subtotal": 49.8
    }
  ],
  "createdAt": "2026-02-15T14:00:00.000Z",
  "updatedAt": "2026-02-15T14:00:00.000Z"
}
```

**`POST /pagamentos` (Request e Response `201`):**

```json
// Request
{
  "pedidoId": "019c6199-df00-7a00-8f41-9c2a1b3e4f77",
  "formaPagamento": "PIX",
  "idempotencyKey": "pm-ok-1771164000000"
}

// Response 201 Created
{
  "id": "019c6199-df00-7a00-8f41-9c2a1b3e4f88",
  "pedidoId": "019c6199-df00-7a00-8f41-9c2a1b3e4f77",
  "unidadeId": "019c6199-df00-7000-8000-000000000101",
  "idempotencyKey": "pm-ok-1771164000000",
  "formaPagamento": "PIX",
  "status": "APROVADO",
  "valorCentavos": 4232,
  "valor": 42.32,
  "referenciaExterna": "MOCK-PIX-1771164000000",
  "payloadRetorno": {
    "provider": "raizes-mock-gateway",
    "aprovado": true,
    "motivo": null,
    "formaPagamento": "PIX",
    "valorCentavos": 4232,
    "idempotencyKey": "pm-ok-1771164000000",
    "referenciaExterna": "MOCK-PIX-1771164000000"
  },
  "processadoEm": "2026-02-15T14:00:00.000Z",
  "createdAt": "2026-02-15T14:00:00.000Z"
}
```

**Erro padronizado (`409 Conflict`):**

```json
{
  "error": "ESTOQUE_INSUFICIENTE",
  "message": "Estoque insuficiente na unidade selecionada.",
  "details": [
    { "field": "itens", "issue": "Bolo de Rolo Tradicional: solicitado 5, disponível 2" }
  ],
  "timestamp": "2026-02-15T14:00:00.000Z",
  "path": "/pedidos",
  "requestId": "019c6199-df00-7a00-8f41-9c2a1b3e4f99"
}
```

---

## 5. LGPD, Privacidade e Segurança no Back-End

Detalhamento completo: [`docs/lgpd/lgpd-security.md`](./docs/lgpd/lgpd-security.md).

| Dados Coletados | Finalidade | Base Legal (Art. 7º LGPD) |
|---|---|---|
| `nome`, `email`, `senhaHash`, `perfil`, `unidadeId` | Cadastro, login JWT e RBAC | Execução de contrato (V) e obrigação legal (II) |
| `pedidos` e `pagamentos` (sem dados de cartão) | Atendimento na unidade e controle financeiro | Execução de contrato (V) |
| `contas_fidelidade` (`consentimentoAtivo`, timestamps) | Acúmulo e resgate de pontos | Consentimento explícito do titular (I) |
| `logs_auditoria` (`usuarioId`, `acao`, `requestId`, `metadados`) | Rastreabilidade de operações críticas | Legítimo interesse e segurança (IX) |

- **Controles aplicados:** minimização (sem CPF, endereço residencial ou cartão), hash `bcryptjs` (custo 10), exclusão explícita de `senhaHash` via `USUARIO_SEGURO_SELECT`, validação global por `JwtAuthGuard` + `RolesGuard`, anonimização em `DELETE /usuarios/me` (substitui `nome`, `email` e `senhaHash`, revoga consentimento e invalida imediatamente tokens ainda não expirados na `JwtStrategy` com `401 NAO_AUTENTICADO`), e `AuditInterceptor` registrando apenas metadados seguros com isolamento por `unidadeId` para `GERENTE`.

---

## 6. Entrega Técnica e Execução Local

### 6.1 Links e Evidências

- **Repositório GitHub:** https://github.com/mmrezende/raizes-nordeste-api
- **URL local da API:** `http://localhost:3000`
- **Swagger / OpenAPI local:** `http://localhost:3000/docs` (configurável por `SWAGGER_PATH`)
- **Coleção Postman:** [`test/postman/raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json) ([link público](https://github.com/mmrezende/raizes-nordeste-api/blob/main/test/postman/raizes-nordeste-api.postman_collection.json))

### 6.2 Pré-requisitos e Variáveis de Ambiente

- Node.js `20.19+`, `22.12+` ou `24+ LTS` e `npm`

| Variável (`.env.example`) | Padrão | Descrição |
|---|---|---|
| `NODE_ENV` | `development` | Ambiente de execução (`production` exige `JWT_SECRET` explícito) |
| `PORT` | `3000` | Porta HTTP da API |
| `SWAGGER_PATH` | `docs` | Rota base da documentação Swagger |
| `DATABASE_URL` | `"file:./dev.db"` | Caminho do banco SQLite usado pelo Prisma |
| `JWT_SECRET` | chave de dev no `.env.example` | Segredo de assinatura JWT |
| `JWT_EXPIRES_IN_SECONDS` | `3600` | Tempo de expiração do JWT em segundos |

### 6.3 Passo a Passo de Execução

```bash
git clone https://github.com/mmrezende/raizes-nordeste-api.git
cd raizes-nordeste-api
cp .env.example .env
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

Para build e execução em produção: `npm run build && npm run start:prod`.

### 6.4 Dados Iniciais do Seed (`prisma/seed.ts`)

Todos os usuários do seed utilizam a senha `Senha@123`:

| E-mail | Perfil | Unidade | Uso principal |
|---|---|---|---|
| `admin@raizes.com` | `ADMIN` | `null` | Gestão da rede (unidades, produtos e promoções) |
| `gerente.rec@raizes.com` | `GERENTE` | `REC-01` | Estoque e auditoria da unidade Recife |
| `atendente.rec@raizes.com` | `ATENDENTE` | `REC-01` | Entrega (`PRONTO` -> `ENTREGUE`) e balcão |
| `cozinha.rec@raizes.com` | `COZINHA` | `REC-01` | Preparo (`EM_PREPARO` -> `PRONTO`) |
| `cliente@exemplo.com` | `CLIENTE` | `null` | Cliente com 20 pontos e consentimento ativo |

- Unidades: `REC-01` (`Raízes Boa Viagem`, ID `019c6199-df00-7000-8000-000000000101`) e `FOR-01` (`Raízes Meireles`).
- Cupons: `TOTEM10` (10% no `TOTEM`, mínimo R$ 20,00) e `RAIZES5` (R$ 5,00 em qualquer canal, mínimo R$ 15,00).
- O produto *Bolo de Rolo Tradicional* em `REC-01` inicia com saldo `2` para reproduzir erro `409 ESTOQUE_INSUFICIENTE`.

---

## 7. Plano de Testes e Evidências

Documento completo: [`docs/tests/test-plan.md`](./docs/tests/test-plan.md).

### 7.1 Execução Automatizada e Postman

```bash
npm run lint
npm test
npm run test:e2e
```

- **Unitários (`npm test`):** 7 suítes (34 testes) cobrindo `UuidV7Generator`, `GlobalExceptionFilter` (incluindo `P2002`), `RolesGuard`, `AuditInterceptor`, `HealthController`, `pedido-calculo.rule` e `pedido-status.rule`.
- **E2E HTTP (`npm run test:e2e`):** 6 suítes (35 testes) em banco SQLite isolado (`prisma/test-e2e.db`), preservando os dados do seed em `prisma/dev.db`.
- **Postman:** após `npm run prisma:seed && npm run start:dev`, importe [`raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json) e execute as pastas `1` a `7` em ordem (os scripts preenchem tokens, IDs e executam `pm.test`).

### 7.2 Matriz Resumida de Cenários (`T01`–`T16`: 9 Positivos e 7 Negativos)

| ID | Cenário | Endpoint | Entrada / Condição | Saída Esperada | Pasta / Evidência Postman |
|---|---|---|---|---|---|
| `T01` | Login válido | `POST /auth/login` | `cliente@exemplo.com` / `Senha@123` | `200` + `accessToken`, `expiresIn: 3600` | `1. Auth / T01` |
| `T02` | Cardápio por unidade | `GET /unidades/{id}/cardapio` | `REC-01` com seed | `200` + lista paginada | `2. Unidades / T02` |
| `T03` | Acesso sem token | `GET /unidades/{id}/estoque` | Sem header `Authorization` | `401 NAO_AUTENTICADO` | `2. Unidades / T03` |
| `T04` | Criar pedido `TOTEM` | `POST /pedidos` | `TOTEM10` + 5 pontos + 2x Tapioca | `201` + `AGUARDANDO_PAGAMENTO` | `3. Pedidos / T04` |
| `T05` | Filtrar por canal | `GET /pedidos?canalPedido=TOTEM` | Pedido `T04` criado | `200` + pedidos `TOTEM` | `3. Pedidos / T05` |
| `T06` | `canalPedido` ausente | `POST /pedidos` | Body sem `canalPedido` | `422 ERRO_VALIDACAO` | `3. Pedidos / T06` |
| `T07` | Quantidade negativa | `POST /pedidos` | `quantidade: -1` | `422 ERRO_VALIDACAO` | `3. Pedidos / T07` |
| `T08` | Produto inexistente | `POST /pedidos` | `produtoId` inexistente | `404 PRODUTO_NAO_ENCONTRADO` | `3. Pedidos / T08` |
| `T09` | Estoque insuficiente | `POST /pedidos` | 5x *Bolo de Rolo* (saldo `2`) | `409 ESTOQUE_INSUFICIENTE` | `3. Pedidos / T09` |
| `T10` | Pagamento aprovado | `POST /pagamentos` | `PIX` + `idempotencyKey` | `201 APROVADO`, `payloadRetorno`, `EM_PREPARO` | `4. Pagamentos / T10` |
| `T11` | Retentativa idempotente | `POST /pagamentos` | Mesma `idempotencyKey` de `T10` | `200` + mesmo `id`, sem novo log | `4. Pagamentos / T11` |
| `T12` | Pagamento recusado | `POST /pagamentos` | `simularRecusa: true` | `201 RECUSADO`, `PAGAMENTO_RECUSADO`, estorno | `4. Pagamentos / T12` |
| `T13` | Perfil sem permissão | `PATCH /pedidos/{id}/status` | `CLIENTE` tentando `PRONTO` | `403 ACESSO_NEGADO` | `5. Status / T13` |
| `T14` | Cozinha marca pronto | `PATCH /pedidos/{id}/status` | `cozinha.rec` -> `PRONTO` | `200` + `PRONTO` | `5. Status / T14` |
| `T15` | Atendente entrega | `PATCH /pedidos/{id}/status` | `atendente.rec` -> `ENTREGUE` | `200` + `ENTREGUE` | `5. Status / T15` |
| `T16` | Auditoria da loja | `GET /auditoria?entidade=pedidos` | `gerente.rec` autenticado | `200` + logs da loja `REC-01` | `7. Auditoria / T16` |

*(A pasta `6. Fidelidade e LGPD` complementa a coleção validando consulta de saldo, atualização de consentimento e extrato paginado de movimentações.)*

---

## 8. Conclusão

A solução entrega integralmente os fluxos críticos da rede **Raízes do Nordeste** (Pedido Multicanal -> Reserva de Estoque -> Pagamento Mock Idempotente -> Ciclo de Status e Controle de Estoque por Unidade), mantendo como escopo futuro (Fase 2) a integração com provedor real de pagamentos, mensageria assíncrona em tempo real e blocklist de JWT em Redis.

A modelagem conecta diretamente o DER (12 tabelas em `prisma/schema.prisma` e `der.dbml`), os casos de uso (`UC01`–`UC14`) e o diagrama de classes às rotas REST e serviços em 4 camadas, isolando regras puras de cálculo e transição de status em `src/domain`. O pagamento mock é desacoplado pela porta `PaymentGateway`, tratando sucesso, recusa com estorno automático de estoque e pontos, e retentativas idempotentes sem duplicar cobrança nem auditoria, com erros padronizados em `GlobalExceptionFilter`.

Por fim, os controles de segurança e LGPD (hash `bcryptjs`, JWT validado contra usuário ativo/anonimizado, RBAC por perfil e unidade, minimização, gestão de consentimento, anonimização via `DELETE /usuarios/me` e auditoria filtrada por loja) são comprovados na prática pela coleção Postman (`T01`–`T16` e pasta 6) e pelas suítes automatizadas Jest (34 testes unitários e 35 E2E passando em banco isolado).

---

## 9. Referências

- BRASIL. **Lei nº 13.709, de 14 de agosto de 2018**. Lei Geral de Proteção de Dados Pessoais (LGPD). Brasília, DF: Presidência da República, 2018.
- FOWLER, M. **UML Essencial**: um breve guia para linguagem padrão. 3. ed. Porto Alegre: Bookman, 2005.
- NESTJS. **NestJS Documentation**. Disponível em: https://docs.nestjs.com. Acesso em: nov. 2026.
- OPENAPI INITIATIVE. **OpenAPI Specification v3.0**. Disponível em: https://spec.openapis.org/oas/latest.html. Acesso em: nov. 2026.
- PRESSMAN, R. S.; MAXIM, B. R. **Engenharia de Software**: uma abordagem profissional. 9. ed. Porto Alegre: AMGH, 2021.
- PRISMA. **Prisma ORM Documentation**. Disponível em: https://www.prisma.io/docs. Acesso em: nov. 2026.
- SOMMERVILLE, I. **Engenharia de Software**. 10. ed. São Paulo: Pearson, 2018.
