# Raízes do Nordeste API — Projeto Back-End

API REST multicanal desenvolvida para o **Projeto Multidisciplinar — Trilha Back-End** (Rede **"Raízes do Nordeste"**). Unifica o recebimento e acompanhamento de pedidos nos cinco canais da rede (`APP`, `TOTEM`, `BALCAO`, `PICKUP` e `WEB`), com controle de estoque isolado por loja, aplicação de promoções, integração desacoplada de pagamento simulado (mock) idempotente, programa de fidelidade sob consentimento LGPD, anonimização de titulares e trilha de auditoria.

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

A rede fictícia de lanchonetes **Raízes do Nordeste** atua no modelo de **matriz e múltiplas unidades (lojas)**. Com a abertura de novos canais digitais e presenciais — aplicativo móvel (`APP`), totens de autoatendimento (`TOTEM`), pedido via navegador (`WEB`), retirada rápida (`PICKUP`) e balcão presencial (`BALCAO`) — surgiu a necessidade de centralizar regras comerciais na matriz sem perder a autonomia operacional de cada unidade.

**Objetivo da solução:** projetar e implementar uma API REST executável e testável que garanta:
- Rastreabilidade operacional por canal de origem (`canalPedido`) na criação e na consulta de pedidos;
- Controle rigoroso de estoque por loja sem venda duplicada em horários de pico;
- Desacoplamento da camada de pagamento externo por meio de gateway simulado (mock) com suporte a chave de idempotência (`idempotencyKey`);
- Programa de fidelidade baseado em consentimento explícito e controles mínimos de privacidade conforme a LGPD;
- Contratos REST previsíveis documentados via OpenAPI/Swagger (`/docs`) e evidenciados por coleção Postman e testes automatizados.

---

## 2. Análise do Problema e Requisitos

Documento completo: [`docs/requirements/requirements.md`](./docs/requirements/requirements.md).

### 2.1 Requisitos Funcionais (por módulo)

- **Auth e Perfis (RBAC):** cadastro público de clientes (`POST /auth/register`), login com JWT (`POST /auth/login`) e cadastro administrativo de equipe (`POST /usuarios`). Perfis suportados: `CLIENTE`, `ATENDENTE`, `COZINHA`, `GERENTE` e `ADMIN`. Funcionários de loja ficam vinculados a uma `unidadeId` específica e operam restritos a ela; `CLIENTE` e `ADMIN` possuem `unidadeId = null`.
- **Unidades, Cardápio e Estoque:** gestão de unidades da rede, catálogo único de produtos na matriz (`precoCentavos`), consulta pública de cardápio por loja (`GET /unidades/:id/cardapio`) e movimentações auditadas de estoque (`ENTRADA`, `SAIDA`, `RESERVA`, `ESTORNO`) por `(unidadeId, produtoId)`.
- **Pedidos e Multicanalidade:** criação de pedido exigindo `canalPedido` (`APP`, `TOTEM`, `BALCAO`, `PICKUP`, `WEB`), cálculo exclusivo no servidor (itens, promoções e resgate de pontos), listagem paginada com filtros (`?canalPedido=TOTEM&status=AGUARDANDO_PAGAMENTO&unidadeId=...`), ciclo de status (`AGUARDANDO_PAGAMENTO → EM_PREPARO → PRONTO → ENTREGUE`, além de `PAGAMENTO_RECUSADO` e `CANCELADO`).
- **Promoções e Campanhas:** cadastro de cupons por código único (`PERCENTUAL` ou `VALOR_FIXO`), validando vigência, valor mínimo e restrições opcionais por canal ou unidade.
- **Pagamento Mock Idempotente:** processamento simulado desacoplado (`POST /pagamentos`) com retorno determinístico (`APROVADO` ou `RECUSADO` via `simularRecusa`), chave `idempotencyKey` para retentativas seguras e estorno automático de estoque/pontos quando recusado.
- **Fidelidade e LGPD:** adesão/revogação de consentimento com data e hora, acúmulo automático após pagamento aprovado (`1 ponto` a cada `R$ 10,00` pagos), resgate direto como desconto na criação de pedidos futuros (`1 ponto = R$ 0,50`) e anonimização do titular (`DELETE /usuarios/me`) preservando histórico operacional.
- **Auditoria:** gravação automática em `logs_auditoria` das ações críticas e consulta filtrável por `GERENTE` e `ADMIN` (`GET /auditoria`).

### 2.2 Regras de Negócio Principais

- **RN01 — Canal obrigatório:** criação de pedido sem `canalPedido` válido retorna `422 ERRO_VALIDACAO`.
- **RN02 — Estoque isolado por unidade:** validação e reserva ocorrem exclusivamente no estoque da unidade selecionada.
- **RN03 — Reserva e reversão atômica:** a criação do pedido abate o estoque na mesma transação (`RESERVA`); recusa de pagamento ou cancelamento antes da entrega devolve os itens (`ESTORNO`).
- **RN04 — Preço congelado em centavos:** cada `ItemPedido` grava o `precoUnitarioCentavos` vigente no momento da compra; todos os valores monetários são persistidos como inteiros em centavos e convertidos em decimal apenas nos DTOs de resposta.
- **RN05 — Idempotência no pagamento:** chamadas repetidas com a mesma `idempotencyKey` retornam o pagamento já processado (`200 OK`) sem duplicar cobrança ou pontuação.
- **RN06 — Fidelidade sob consentimento:** sem `consentimentoAtivo = true`, o pedido não acumula pontos e qualquer tentativa de resgate retorna `409 FIDELIDADE_SEM_CONSENTIMENTO`.

### 2.3 Requisitos Não Funcionais

- **Segurança e Privacidade:** hash de senhas via `bcryptjs`, autenticação stateless com JWT, RBAC por rota/unidade, omissão de `senhaHash` em respostas/logs e anonimização de dados pessoais.
- **Consistência e Desempenho:** operações críticas em transações do banco, índices em consultas de canal/status/cliente/auditoria, paginação padrão (`?page=1&limit=10`) e chaves primárias **UUIDv7** geradas na aplicação com ordenação cronológica.
- **Contrato REST e Resiliência:** URLs no plural, IDs no path, status codes coerentes (`200`, `201`, `401`, `403`, `404`, `409`, `422`), `requestId` em toda resposta e JSON de erro único pelo `GlobalExceptionFilter`.

### 2.4 Priorização (MVP vs. Fase 2) e Decisões Técnicas

| Escopo | O que compõe | Justificativa |
|---|---|---|
| **Implementado (MVP completo)** | Auth/RBAC, Unidades, Produtos, Estoque por loja, Pedidos com `canalPedido`, Promoções, Ciclo de status, Pagamento Mock idempotente, Fidelidade (saldo + histórico + LGPD) e Auditoria. | Fecha ponta a ponta os fluxos críticos da rede com regras reais de estoque/desconto e execução 100% local via SQLite sem depender de infraestrutura externa na correção. |
| **Planejado (Fase 2)** | Gateway real (Pix/cartão com webhooks), mensageria assíncrona (WebSocket/SSE para painel da cozinha e e-mail), blocklist de JWT em Redis, PostgreSQL em produção e promoções empilháveis. | A separação por portas e adapters permite trocar provedor de pagamento, banco e notificações sem alterar as regras de domínio nem quebrar contratos REST. |

| Decisão Técnica | Escolha Adotada | Trade-off Prático |
|---|---|---|
| **Stack Back-end** | NestJS 12 + TypeScript | Injeção de dependência, validação declarativa e geração OpenAPI integradas, mantendo domínio isolado do HTTP e do ORM. |
| **Banco e ORM** | SQLite + Prisma 6 | Banco relacional completo (PKs, FKs, constraints únicas e transações) em arquivo local sem exigir Docker; portável para PostgreSQL alterando `provider` e `DATABASE_URL`. |
| **Identificadores** | **UUIDv7** (RFC 9562) | Evita enumeração sequencial em URLs e mantém ordenação temporal nos índices B-tree, tirando a geração de ID da dependência do banco. |
| **Valores Monetários** | Inteiro em centavos (`Int`) | Elimina imprecisão de ponto flutuante no SQLite; conversão para reais realizada apenas na serialização da API. |
| **Reserva de Estoque** | Baixa na criação + estorno na falha/cancelamento | Evita vender o último item duas vezes em horários de pico sem deixar saldo preso caso o pagamento seja recusado. |

---

## 3. Modelagem e Arquitetura

Índice de diagramas editáveis/exportáveis: [`docs/diagrams/README.md`](./docs/diagrams/README.md).

### 3.1 Diagrama de Casos de Uso e Features Críticas

- Diagrama UML: [`docs/diagrams/use-cases.puml`](./docs/diagrams/use-cases.puml)
- Especificação detalhada (`UC01`–`UC14` e fluxos críticos): [`docs/requirements/use-cases.md`](./docs/requirements/use-cases.md)
- **Atores contemplados:** Cliente (`APP`/`WEB`/`TOTEM`/`PICKUP`), Atendente (`BALCAO`), Cozinha, Gerente / Administrador e Gateway de Pagamento (Mock).
- **Features críticas detalhadas:**
  1. `UC04 + UC07` — Criação do pedido multicanal com reserva de estoque, cupom/fidelidade e processamento no gateway mock (sucesso, recusa com estorno e idempotência).
  2. `UC09` — Atualização controlada de status (`EM_PREPARO → PRONTO → ENTREGUE`) e cancelamento antes da entrega com estorno de estoque e pontos.

### 3.2 Modelo de Dados (DER)

- Modelo lógico/físico: [`docs/diagrams/der.dbml`](./docs/diagrams/der.dbml)
- Schema executável espelhado 1:1: [`prisma/schema.prisma`](./prisma/schema.prisma)

Principais entidades (`12` tabelas e `8` enums): `unidades`, `usuarios`, `produtos`, `estoque_unidades` (chave única composta `(unidade_id, produto_id)`), `movimentacoes_estoque`, `promocoes` (`codigo` único), `pedidos` (`canal_pedido` obrigatório e indexado por `(unidade_id, status)`, `(canal_pedido, status)` e `(cliente_id, created_at)`), `itens_pedido` (único `(pedido_id, produto_id)`), `pagamentos` (`idempotency_key` única), `contas_fidelidade` (relação `1:1` com `usuarios`), `movimentacoes_fidelidade` e `logs_auditoria`.

### 3.3 Diagrama de Classes e Sequência do Fluxo Crítico

- **Classes de Domínio:** [`docs/diagrams/classes.mmd`](./docs/diagrams/classes.mmd) — representa entidades, enums, regras de cálculo/transição e vínculo de autoria com `LogAuditoria`.
- **Sequência (Pedido → Pagamento Mock → Status/Estorno):** [`docs/diagrams/sequence-order-payment.mmd`](./docs/diagrams/sequence-order-payment.mmd) — ilustra a geração de UUIDv7 na API, reserva transacional de estoque, chamada ao gateway mock, atualização de status, acúmulo/estorno de fidelidade e registro de auditoria.

### 3.4 Arquitetura em 4 Camadas

- Diagrama de arquitetura: [`docs/diagrams/architecture.mmd`](./docs/diagrams/architecture.mmd)

```text
├── docs/                  # Requisitos, casos de uso, diagramas, LGPD e plano de testes
├── prisma/                # Schema Prisma, migrations e seed idempotente (SQLite)
├── src/
│   ├── domain/            # Enums, erros tipados, utilitários e regras puras (cálculo/status)
│   ├── application/       # Casos de uso (services) e portas (IdGenerator, Hasher, Logger, PaymentGateway)
│   ├── infrastructure/    # Prisma ORM, JWT/bcryptjs, UUIDv7, interceptor/logger auditoria e MockPaymentGateway
│   └── api/               # Controllers REST, DTOs, guards RBAC, ExceptionFilter, RequestId e Swagger
└── test/
    ├── unit/              # Testes unitários (regras puras de domínio, guards, filtros e interceptors)
    ├── e2e/               # Testes HTTP ponta a ponta com banco SQLite real
    └── postman/           # Coleção Postman v2.1.0 (.json)
```

---

## 4. API e Endpoints (Contratos REST)

### 4.1 Padrões de Contrato e Erro Único

- **Rotas:** recursos no plural (`/unidades`, `/produtos`, `/pedidos`), identificação via UUIDv7 no path (`/pedidos/:id`) e paginação padrão (`?page=1&limit=10`) retornando `{ data, meta: { page, limit, total, totalPages } }`.
- **Erro padronizado:** toda exceção passa pelo `GlobalExceptionFilter` e retorna a mesma estrutura com `X-Request-Id` rastreável:

```json
{
  "error": "ESTOQUE_INSUFICIENTE",
  "message": "Estoque insuficiente na unidade selecionada.",
  "details": [
    { "field": "itens", "issue": "Bolo de Rolo Tradicional: solicitado 5, disponível 2" }
  ],
  "timestamp": "2026-11-22T02:00:00.000Z",
  "path": "/pedidos",
  "requestId": "0193514c-8d12-7a00-8f41-9c2a1b3e4f99"
}
```

### 4.2 Catálogo de Endpoints Implementados

| Recurso | Método e Rota | Auth / Perfis | Descrição | Status Codes |
|---|---|---|---|---|
| **Health** | `GET /health` | Público | Verifica disponibilidade da API e conexão com o SQLite | `200` |
| **Auth** | `POST /auth/register` | Público | Cadastra cliente e inicializa conta de fidelidade | `201`, `409`, `422` |
| **Auth** | `POST /auth/login` | Público | Autentica usuário e emite token JWT (`expiresIn` em ms) | `200`, `401`, `422` |
| **Usuários** | `GET /usuarios/me` | JWT (todos) | Retorna dados do usuário autenticado (sem `senhaHash`) | `200`, `401`, `404` |
| **Usuários** | `POST /usuarios` | JWT (`ADMIN`, `GERENTE`) | Cadastra usuário interno (`GERENTE` restrito à própria loja) | `201`, `401`, `403`, `404`, `409`, `422` |
| **Usuários** | `DELETE /usuarios/me` | JWT (todos) | Anonimiza dados pessoais do titular (LGPD) preservando pedidos | `200`, `401`, `404` |
| **Unidades** | `POST /unidades` | JWT (`ADMIN`) | Cadastra nova unidade com código único (ex.: `REC-01`) | `201`, `401`, `403`, `409`, `422` |
| **Unidades** | `GET /unidades` | Público | Lista unidades ativas paginadas | `200` |
| **Unidades** | `GET /unidades/:id/cardapio` | Público | Consulta cardápio disponível para venda na unidade | `200`, `404` |
| **Unidades** | `GET /unidades/:id/estoque` | JWT (`ADMIN`, equipe da loja) | Lista saldos de estoque da unidade | `200`, `401`, `403`, `404` |
| **Produtos** | `POST /produtos` | JWT (`ADMIN`) | Cadastra produto no catálogo da matriz (`precoCentavos`) | `201`, `401`, `403`, `422` |
| **Produtos** | `GET /produtos` | Público | Lista catálogo paginado com filtro opcional `?categoria=` | `200` |
| **Estoque** | `POST /estoque/movimentacoes` | JWT (`ADMIN`, `GERENTE` loja) | Registra `ENTRADA` ou `SAIDA` manual no estoque da loja | `201`, `401`, `403`, `404`, `409`, `422` |
| **Promoções** | `POST /promocoes` | JWT (`ADMIN`) | Cadastra cupom promocional (`PERCENTUAL` / `VALOR_FIXO`) | `201`, `401`, `403`, `404`, `409`, `422` |
| **Promoções** | `GET /promocoes` | Público | Lista promoções paginadas (`?ativo=&canalAplicavel=&unidadeId=`) | `200` |
| **Pedidos** | `POST /pedidos` | JWT (`CLIENTE`, `ATENDENTE`, `GERENTE`, `ADMIN`) | Cria pedido multicanal com reserva de estoque, cupom e pontos | `201`, `401`, `403`, `404`, `409`, `422` |
| **Pedidos** | `GET /pedidos` | JWT (escopo cliente/unidade/admin) | Lista pedidos paginados (`?canalPedido=&status=&unidadeId=`) | `200`, `401`, `403` |
| **Pedidos** | `GET /pedidos/:id` | JWT (dono, equipe loja ou `ADMIN`) | Consulta detalhes e itens de um pedido | `200`, `401`, `403`, `404` |
| **Pedidos** | `PATCH /pedidos/:id/status` | JWT (`COZINHA`, `ATENDENTE`, `GERENTE`, `ADMIN`) | Avança `EM_PREPARO → PRONTO` (`COZINHA`) e `PRONTO → ENTREGUE` (`ATENDENTE`) | `200`, `401`, `403`, `404`, `409`, `422` |
| **Pedidos** | `POST /pedidos/:id/cancelar` | JWT (dono, equipe loja ou `ADMIN`) | Cancela pedido antes da entrega com estorno de estoque e pontos | `200`, `401`, `403`, `404`, `409` |
| **Pagamentos** | `POST /pagamentos` | JWT (dono, equipe loja ou `ADMIN`) | Processa pagamento mock idempotente (`APROVADO` / `RECUSADO`) | `201`, `200`, `401`, `403`, `404`, `409`, `422` |
| **Fidelidade** | `GET /fidelidade/conta` | JWT (todos) | Consulta saldo de pontos e timestamps de consentimento LGPD | `200`, `401` |
| **Fidelidade** | `PATCH /fidelidade/consentimento` | JWT (todos) | Ativa ou revoga consentimento explícito LGPD | `200`, `401`, `422` |
| **Fidelidade** | `GET /fidelidade/movimentacoes` | JWT (todos) | Lista histórico paginado de `ACUMULO`, `RESGATE` e `ESTORNO` | `200`, `401` |
| **Auditoria** | `GET /auditoria` | JWT (`ADMIN`, `GERENTE`) | Consulta trilha paginada e filtrável (`?entidade=&acao=`) | `200`, `401`, `403` |

### 4.3 Exemplos de Contratos JSON (Fluxo Crítico)

#### `POST /pedidos` — Criar pedido multicanal (Request e Response `201`)
```json
// Request
{
  "unidadeId": "0193514c-8d12-7000-8000-000000000101",
  "canalPedido": "TOTEM",
  "codigoPromocao": "TOTEM10",
  "pontosResgate": 5,
  "itens": [
    { "produtoId": "0193514c-8d12-7000-8000-000000000201", "quantidade": 2 }
  ]
}
```

```json
// Response 201 Created
{
  "id": "0193514c-8d12-7a00-8f41-9c2a1b3e4f77",
  "unidadeId": "0193514c-8d12-7000-8000-000000000101",
  "clienteId": "0193514c-8d12-7000-8000-000000000305",
  "promocaoId": "0193514c-8d12-7000-8000-000000000501",
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
      "id": "0193514c-8d12-7a00-8f41-9c2a1b3e4f88",
      "produtoId": "0193514c-8d12-7000-8000-000000000201",
      "quantidade": 2,
      "precoUnitarioCentavos": 2490,
      "precoUnitario": 24.9,
      "subtotalCentavos": 4980,
      "subtotal": 49.8
    }
  ],
  "createdAt": "2026-11-22T02:40:00.000Z",
  "updatedAt": "2026-11-22T02:40:00.000Z"
}
```

#### `POST /pagamentos` — Pagamento Mock Idempotente (Request e Response `201` / `200`)
```json
// Request (para simular falha controlada, envie "simularRecusa": true)
{
  "pedidoId": "0193514c-8d12-7a00-8f41-9c2a1b3e4f77",
  "formaPagamento": "PIX",
  "idempotencyKey": "pm-ok-1732250000000"
}
```

```json
// Response 201 Created (ou 200 OK na retentativa com mesma idempotencyKey)
{
  "id": "0193514c-8d12-7a00-8f41-9c2a1b3e4f99",
  "pedidoId": "0193514c-8d12-7a00-8f41-9c2a1b3e4f77",
  "idempotencyKey": "pm-ok-1732250000000",
  "formaPagamento": "PIX",
  "status": "APROVADO",
  "valorCentavos": 4232,
  "valor": 42.32,
  "referenciaExterna": "MOCK-PIX-1732250000123",
  "processadoEm": "2026-11-22T02:40:10.123Z",
  "createdAt": "2026-11-22T02:40:10.125Z"
}
```

---

## 5. LGPD, Privacidade e Segurança no Back-End

Documento detalhado: [`docs/lgpd/lgpd-security.md`](./docs/lgpd/lgpd-security.md).

- **Minimização e Bases Legais (Art. 7º LGPD):** coleta restrita a `nome`, `email`, `senhaHash`, `perfil` e `unidadeId` (sem CPF, endereço residencial ou dados de cartão). Dados cadastrais e de pedidos operam sob **execução de contrato**; pontuação e histórico de fidelidade operam exclusivamente mediante **consentimento explícito**.
- **Gestão de Consentimento:** adesão desativada por padrão no cadastro (salvo opt-in explícito), podendo ser ativada ou revogada em `PATCH /fidelidade/consentimento` com gravação de `consentimentoEm` / `revogadoEm` e registro de auditoria.
- **Direito à Eliminação / Anonimização (`DELETE /usuarios/me`):** substitui `nome` (`"Usuário Anonimizado"`), `email` (`anonimizado-<id>@anon.local`) e `senhaHash`, marca `ativo = false` e `anonimizadoEm`, revoga o consentimento de fidelidade e preserva os registros de `pedidos` para integridade financeira sem expor dados do titular.
- **Segurança Aplicada:** senhas com hash `bcryptjs`, JWT validado pelo `JwtAuthGuard` global, RBAC com escopo por loja via `RolesGuard`, omissão absoluta de `senhaHash` nas respostas e allowlist de metadados no `AuditInterceptor` (`logs_auditoria`).

---

## 6. Entrega Técnica e Execução Local

### 6.1 Pré-requisitos e Instalação

- **Node.js 24.9+ LTS** (necessário para suporte nativo a `require(esm)` com NestJS 12) e **npm**

```bash
# 1. Clonar repositório e entrar na pasta
git clone https://github.com/mmrezende/raizes-nordeste-api.git
cd raizes-nordeste-api

# 2. Copiar variáveis de ambiente
cp .env.example .env

# 3. Instalar dependências
npm install

# 4. Gerar Prisma Client, aplicar migrations SQLite e popular o seed
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
```

### 6.2 Subir a API e Acessar Swagger

```bash
# Modo desenvolvimento (watch)
npm run start:dev

# Ou build de produção + execução do dist/
npm run build
npm run start:prod
```

- **Base URL:** `http://localhost:3000`
- **Swagger / OpenAPI:** `http://localhost:3000/docs` *(configurável via `SWAGGER_PATH` no `.env`)*

### 6.3 Credenciais e Dados Pré-carregados (`prisma/seed.ts`)

Todos os usuários do seed utilizam a senha **`Senha@123`**:

| E-mail | Perfil | Unidade | Finalidade no Seed |
|---|---|---|---|
| `admin@raizes.com` | `ADMIN` | `null` | Cadastro de unidades, catálogo e promoções |
| `gerente.rec@raizes.com` | `GERENTE` | `REC-01` | Gestão de estoque e consulta à auditoria (`REC-01`) |
| `atendente.rec@raizes.com` | `ATENDENTE` | `REC-01` | Entrega de pedidos (`PRONTO → ENTREGUE`) e balcão |
| `cozinha.rec@raizes.com` | `COZINHA` | `REC-01` | Preparo de pedidos (`EM_PREPARO → PRONTO`) |
| `cliente@exemplo.com` | `CLIENTE` | `null` | Fidelidade ativa (`20` pontos iniciais) |

- **Unidades:** `REC-01` (*Raízes Boa Viagem*, Recife/PE — id `0193514c-8d12-7000-8000-000000000101`) e `FOR-01` (*Raízes Meireles*, Fortaleza/CE).
- **Promoções vigentes:** `TOTEM10` (`10%` exclusivo no canal `TOTEM`, mínimo R$ 20,00) e `RAIZES5` (`R$ 5,00` fixo em qualquer canal, mínimo R$ 15,00).
- **Cenário pronto para estoque insuficiente (`409`):** *Bolo de Rolo Tradicional* em `REC-01` inicia com saldo `2`.

### 6.4 Links Públicos (Evidências Obrigatórias)

- **Repositório GitHub:** https://github.com/mmrezende/raizes-nordeste-api
- **Swagger Local:** `http://localhost:3000/docs` (rota `/docs`)
- **Coleção Postman (`.json`):** [`test/postman/raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json) ([link público no GitHub](https://github.com/mmrezende/raizes-nordeste-api/blob/main/test/postman/raizes-nordeste-api.postman_collection.json))

---

## 7. Plano de Testes e Evidências

Plano completo: [`docs/tests/test-plan.md`](./docs/tests/test-plan.md).

### 7.1 Execução dos Testes Automatizados e Coleção Postman

```bash
# Análise estática e checagem de tipos
npm run lint

# Testes unitários (regras de cálculo/status, guards, filtros e interceptors)
npm test

# Testes HTTP ponta a ponta (E2E) com SQLite real
npm run test:e2e
```

**No Postman:** com a API rodando e o seed aplicado (`npm run prisma:seed && npm run start:dev`), importe [`test/postman/raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json) e execute as pastas na ordem numérica (`1` → `7`, ou via *Run collection*). Os scripts internos salvam tokens JWT e IDs automaticamente.

### 7.2 Matriz de Cenários (`T01`–`T16`: 10 Positivos + 6 Negativos)

| ID | Cenário | Endpoint | Esperado | Evidência (Postman) |
|---|---|---|---|---|
| **T01** | Login válido (`cliente@exemplo.com`) | `POST /auth/login` | `200` + `accessToken` | `1. Auth / T01 - Login cliente válido` |
| **T02** | Consulta pública de cardápio (`REC-01`) | `GET /unidades/{id}/cardapio` | `200` + itens paginados e saldo | `2. Unidades e Cardápio / T02 - Consultar cardápio da unidade REC-01` |
| **T03** | Acesso a rota protegida sem token | `GET /unidades/{id}/estoque` | `401 NAO_AUTENTICADO` | `2. Unidades e Cardápio / T03 - Consultar estoque sem token (401)` |
| **T04** | Pedido `TOTEM` com cupom e pontos | `POST /pedidos` | `201 AGUARDANDO_PAGAMENTO` | `3. Pedidos e Multicanalidade / T04 - Criar pedido TOTEM com cupom e pontos` |
| **T05** | Filtro por `canalPedido=TOTEM` | `GET /pedidos?canalPedido=TOTEM` | `200` + pedidos filtrados | `3. Pedidos e Multicanalidade / T05 - Filtrar pedidos por canalPedido=TOTEM` |
| **T06** | `canalPedido` ausente (obrigatório) | `POST /pedidos` | `422 ERRO_VALIDACAO` | `3. Pedidos e Multicanalidade / T06 - Criar pedido sem canalPedido (422)` |
| **T07** | Quantidade negativa (formato inválido) | `POST /pedidos` | `422 ERRO_VALIDACAO` | `3. Pedidos e Multicanalidade / T07 - Criar pedido com quantidade negativa (422)` |
| **T08** | Pedido com produto inexistente | `POST /pedidos` | `404 PRODUTO_NAO_ENCONTRADO` | `3. Pedidos e Multicanalidade / T08 - Criar pedido com produto inexistente (404)` |
| **T09** | Estoque insuficiente (`5` > saldo `2`) | `POST /pedidos` | `409 ESTOQUE_INSUFICIENTE` | `3. Pedidos e Multicanalidade / T09 - Criar pedido com estoque insuficiente (409)` |
| **T10** | Pagamento mock aprovado + pontos | `POST /pagamentos` | `201 APROVADO` + `EM_PREPARO` | `4. Pagamentos Mock / T10 - Processar pagamento aprovado` |
| **T11** | Retentativa idempotente (`idempotencyKey`) | `POST /pagamentos` | `200` + mesmo `id` sem duplicar | `4. Pagamentos Mock / T11 - Reenviar pagamento idempotente (200)` |
| **T12** | Pagamento mock recusado + estorno | `POST /pagamentos` | `201 RECUSADO` + estorno estoque | `4. Pagamentos Mock / T12 - Processar pagamento recusado com estorno` |
| **T13** | Perfil sem permissão mudando status | `PATCH /pedidos/{id}/status` | `403 ACESSO_NEGADO` | `5. Ciclo de Status / T13 - Cliente tenta atualizar status (403)` |
| **T14** | Cozinha avança para `PRONTO` | `PATCH /pedidos/{id}/status` | `200 PRONTO` | `5. Ciclo de Status / T14 - Cozinha marca pedido como PRONTO` |
| **T15** | Atendente entrega pedido (`ENTREGUE`) | `PATCH /pedidos/{id}/status` | `200 ENTREGUE` | `5. Ciclo de Status / T15 - Atendente marca pedido como ENTREGUE` |
| **T16** | Consulta à auditoria de pedidos (`GERENTE`) | `GET /auditoria?entidade=pedidos` | `200` + logs `PEDIDO_CRIADO` / status | `7. Auditoria / T16 - Consultar logs de auditoria de pedidos` |

---

## 8. Conclusão

A solução entrega um back-end completo e executável para a rede **Raízes do Nordeste**, priorizando no MVP os fluxos essenciais de operação multicanal (`APP`, `TOTEM`, `BALCAO`, `PICKUP`, `WEB`), controle de estoque isolado por unidade, aplicação de promoções e fidelidade, pagamento simulado idempotente e rastreabilidade via auditoria — deixando integrações externas reais (gateway bancário, mensageria e Redis) preparadas via portas e adapters para a Fase 2.

- **Coerência modelagem ↔ implementação:** as 12 tabelas do DER (`der.dbml`), os casos de uso (`UC01`–`UC14`), o diagrama de classes e o fluxo de sequência refletem 1:1 o schema do Prisma (`schema.prisma`) e os 25 endpoints reais expostos na API e no Swagger (`/docs`).
- **Pagamento mock e padronização de erros:** o provedor simulado desacoplado (`MockPaymentGateway`) cobre cenários determinísticos de aprovação e recusa (com estorno automático de estoque e pontos) sob chave `idempotencyKey`, enquanto todas as falhas seguem um único contrato JSON (`error`, `message`, `details`, `timestamp`, `path`, `requestId`) via `GlobalExceptionFilter`.
- **Segurança, LGPD e evidências de teste:** autenticação JWT, RBAC por perfil/unidade, hash de senha com `bcryptjs`, consentimento com timestamp, anonimização preservando histórico (`DELETE /usuarios/me`) e logs auditáveis (`GET /auditoria`) foram validados em conjunto pela suíte automatizada Jest (unitária e E2E) e pela coleção Postman de 16 cenários (`T01`–`T16`).

---

## 9. Referências

- **NestJS Documentation.** Disponível em: https://docs.nestjs.com/. Acesso em: nov. 2026.
- **Prisma ORM Documentation.** Disponível em: https://www.prisma.io/docs. Acesso em: nov. 2026.
- **OpenAPI / Swagger Specification.** Disponível em: https://swagger.io/specification/. Acesso em: nov. 2026.
- **IETF RFC 9562 — Universally Unique IDentifiers (UUIDs), Seção UUIDv7.** Disponível em: https://datatracker.ietf.org/doc/html/rfc9562. Acesso em: nov. 2026.
- **BRASIL. Lei nº 13.709, de 14 de agosto de 2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).** Disponível em: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm. Acesso em: nov. 2026.
