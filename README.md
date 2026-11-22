# Raízes do Nordeste API

API REST desenvolvida em NestJS, TypeScript e Prisma (SQLite) para a rede de lanchonetes Raízes do Nordeste. Centraliza pedidos nos cinco canais de atendimento (`APP`, `TOTEM`, `BALCAO`, `PICKUP` e `WEB`), com estoque isolado por loja, aplicação de cupons, pagamento simulado idempotente, programa de fidelidade com gestão de consentimento, anonimização de usuário e logs de auditoria.

## Estrutura do Projeto

O projeto está organizado em quatro camadas:

- **Domain (`src/domain`)**: enums puros, erros de domínio, cálculo de descontos/pontos e regras de transição de status, sem dependência de HTTP ou ORM.
- **Application (`src/application`)**: casos de uso por módulo, helpers compartilhados (`src/application/common`) e interfaces de portas (`IdGenerator`, `PasswordHasher`, `AuditLogger`, `PaymentGateway`).
- **Infrastructure (`src/infrastructure`)**: `InfrastructureModule`, conexão Prisma/SQLite, configuração de ambiente, JWT/bcryptjs, gerador UUIDv7, `PrismaAuditLogger` e `MockPaymentGateway`.
- **API (`src/api`)**: controllers REST, DTOs com `class-validator`, decorators, guards (`JwtAuthGuard`, `RolesGuard`), middleware `X-Request-Id`, `AuditInterceptor`, `GlobalExceptionFilter` e Swagger.

```text
├── docs/                  # Requisitos, casos de uso, LGPD, plano de testes e diagramas
├── prisma/                # Schema Prisma, migrations e seed
├── src/
│   ├── domain/            # Enums, erros, utilitários e regras de pedido
│   ├── application/       # Casos de uso, helpers comuns e portas
│   ├── infrastructure/    # Prisma, segurança, auditoria, config e gateway mock
│   └── api/               # Controllers, DTOs, módulos, guards, filtros e Swagger
└── test/
    ├── unit/              # Testes unitários de regras, guards, filtro e interceptor
    ├── e2e/               # Testes HTTP integrados com SQLite
    └── postman/           # Coleção Postman v2.1.0
```

## Execução Local

### Pré-requisitos

- Node.js 20.19+, 22.12+ ou 24+ LTS
- npm

### Instalação e banco de dados

```bash
git clone https://github.com/mmrezende/raizes-nordeste-api.git
cd raizes-nordeste-api
cp .env.example .env
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
```

### Iniciar a API

```bash
# Desenvolvimento (watch)
npm run start:dev

# Produção
npm run build
npm run start:prod
```

- Base URL: `http://localhost:3000`
- Documentação Swagger: `http://localhost:3000/docs` (ajustável via `SWAGGER_PATH` no `.env`)

### Dados iniciais do seed (`prisma/seed.ts`)

Todos os usuários criados pelo seed usam a senha `Senha@123`:

| E-mail | Perfil | Unidade | Uso principal |
|---|---|---|---|
| `admin@raizes.com` | `ADMIN` | `null` | Gestão da rede (unidades, produtos e promoções) |
| `gerente.rec@raizes.com` | `GERENTE` | `REC-01` | Estoque e auditoria da unidade Recife |
| `atendente.rec@raizes.com` | `ATENDENTE` | `REC-01` | Entrega de pedidos (`PRONTO` -> `ENTREGUE`) e balcão |
| `cozinha.rec@raizes.com` | `COZINHA` | `REC-01` | Preparo de pedidos (`EM_PREPARO` -> `PRONTO`) |
| `cliente@exemplo.com` | `CLIENTE` | `null` | Cliente com 20 pontos e consentimento ativo |

- Unidades criadas: `REC-01` (`Raízes Boa Viagem`, ID `0193514c-8d12-7000-8000-000000000101`) e `FOR-01` (`Raízes Meireles`).
- Cupons ativos: `TOTEM10` (10% no canal `TOTEM`, mínimo R$ 20,00) e `RAIZES5` (R$ 5,00 em qualquer canal, mínimo R$ 15,00).
- O produto *Bolo de Rolo Tradicional* em `REC-01` inicia com saldo `2` para facilitar testes de estoque insuficiente (`409`).

## Endpoints Principais

Todas as listagens aceitam paginação via `?page=1&limit=10` e erros retornam o formato único `{ error, message, details, timestamp, path, requestId }` acompanhado do header `X-Request-Id`.

- **Health**: `GET /health` (público)
- **Auth**: `POST /auth/register`, `POST /auth/login` (públicos)
- **Usuários**: `GET /usuarios/me`, `DELETE /usuarios/me` (autenticado), `POST /usuarios` (`ADMIN`, `GERENTE` na própria loja)
- **Unidades**: `GET /unidades`, `GET /unidades/:id/cardapio` (públicos), `POST /unidades` (`ADMIN`), `GET /unidades/:id/estoque` (`ADMIN` ou equipe da loja)
- **Produtos**: `GET /produtos` (público, filtro `?categoria=`), `POST /produtos` (`ADMIN`)
- **Estoque**: `POST /estoque/movimentacoes` (`ADMIN`, `GERENTE` da loja)
- **Promoções**: `GET /promocoes` (público, filtros `ativo`, `canalAplicavel`, `unidadeId`), `POST /promocoes` (`ADMIN`)
- **Pedidos**: `POST /pedidos`, `GET /pedidos` (`?canalPedido=&status=&unidadeId=`), `GET /pedidos/:id`, `PATCH /pedidos/:id/status`, `POST /pedidos/:id/cancelar`
- **Pagamentos**: `POST /pagamentos` (gateway mock com `idempotencyKey` e `simularRecusa`)
- **Fidelidade**: `GET /fidelidade/conta`, `PATCH /fidelidade/consentimento`, `GET /fidelidade/movimentacoes`
- **Auditoria**: `GET /auditoria` (`ADMIN` geral; `GERENTE` restrito à própria unidade; filtros `entidade`, `acao`)

### Exemplos de Payload

Criar pedido (`POST /pedidos`):

```json
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

Processar pagamento (`POST /pagamentos`):

```json
{
  "pedidoId": "0193514c-8d12-7a00-8f41-9c2a1b3e4f77",
  "formaPagamento": "PIX",
  "idempotencyKey": "pm-ok-1732250000000"
}
```

Resposta padrão de erro (`409 Conflict`):

```json
{
  "error": "ESTOQUE_INSUFICIENTE",
  "message": "Estoque insuficiente na unidade selecionada.",
  "details": [
    { "field": "itens", "issue": "Bolo de Rolo Tradicional: solicitado 5, disponível 2" }
  ],
  "timestamp": "2026-02-15T14:00:00.000Z",
  "path": "/pedidos",
  "requestId": "0193514c-8d12-7a00-8f41-9c2a1b3e4f99"
}
```

## Testes e Evidências

```bash
npm run lint
npm test
npm run test:e2e
```

Para testar manualmente com Postman:

1. Aplique o seed e inicie a API (`npm run prisma:seed && npm run start:dev`).
2. Importe [`test/postman/raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json) ([link público no GitHub](https://github.com/mmrezende/raizes-nordeste-api/blob/main/test/postman/raizes-nordeste-api.postman_collection.json)).
3. Execute as pastas na ordem (`1` a `7`); os scripts da coleção salvam tokens e IDs automaticamente.

## Documentação Complementar

- [Requisitos e decisões técnicas](./docs/requirements/requirements.md)
- [Casos de uso e fluxos críticos](./docs/requirements/use-cases.md)
- [LGPD, privacidade e segurança](./docs/lgpd/lgpd-security.md)
- [Plano de testes (T01-T16)](./docs/tests/test-plan.md)
- [Índice de diagramas](./docs/diagrams/README.md)
- [Repositório no GitHub](https://github.com/mmrezende/raizes-nordeste-api)
