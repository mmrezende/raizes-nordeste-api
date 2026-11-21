# Raízes do Nordeste API

API REST multicanal para gestão de unidades, cardápio, estoque por loja, pedidos (`APP`, `TOTEM`, `BALCAO`, `PICKUP`, `WEB`), promoções, pagamento simulado (mock) com idempotência, programa de fidelidade com consentimento LGPD e trilha de auditoria.

## Stack

- **Runtime / Linguagem:** Node.js 24.9+ LTS / TypeScript
- **Framework:** NestJS 12
- **ORM / Banco:** Prisma 6 + SQLite (`prisma/dev.db`, portável para PostgreSQL)
- **Autenticação & Validação:** JWT + `bcryptjs` + `class-validator`
- **Documentação & Testes:** OpenAPI/Swagger + Jest + Supertest + Postman

## Documentação e Modelagem

- **Requisitos e regras de negócio:** [`docs/requirements/requirements.md`](./docs/requirements/requirements.md)
- **Casos de uso e fluxos críticos:** [`docs/requirements/use-cases.md`](./docs/requirements/use-cases.md)
- **Diagramas (Casos de Uso, DER, Classes, Sequência e Arquitetura):** [`docs/diagrams/README.md`](./docs/diagrams/README.md)
- **LGPD, Privacidade e Segurança:** [`docs/lgpd/lgpd-security.md`](./docs/lgpd/lgpd-security.md)
- **Plano de Testes (`T01`–`T16`):** [`docs/tests/test-plan.md`](./docs/tests/test-plan.md)
- **Coleção Postman (`.json`):** [`test/postman/raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json)

## Estrutura do Projeto

```text
├── docs/                  # Requisitos, casos de uso, diagramas, LGPD e plano de testes
├── prisma/                # Schema, migrations e seed do banco SQLite
├── src/
│   ├── domain/            # Regras puras de cálculo/transição, erros e enums de domínio
│   ├── application/       # Casos de uso (services) e portas (interfaces externas)
│   ├── infrastructure/    # Prisma ORM, JWT/bcryptjs, UUIDv7, auditoria e pagamento mock
│   └── api/               # Controllers, DTOs, guards RBAC, filtros globais e Swagger
└── test/
    ├── unit/              # Testes unitários (regras de domínio, guards, filtros e interceptors)
    ├── e2e/               # Testes HTTP ponta a ponta com SQLite real
    └── postman/           # Coleção Postman executável (.json)
```

## Como Rodar Localmente

### 1. Pré-requisitos
- **Node.js 24.9+** (necessário para suporte nativo a `require(esm)` com NestJS 12) e npm

### 2. Configurar variáveis de ambiente
Copie o arquivo de exemplo e ajuste se necessário:
```bash
cp .env.example .env
```

### 3. Instalar dependências, migrar banco e rodar seed
```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
```

### 4. Iniciar a API
```bash
# desenvolvimento (watch)
npm run start:dev

# build e produção
npm run build
npm run start:prod
```

- **Base URL:** `http://localhost:3000`
- **Swagger / OpenAPI:** `http://localhost:3000/docs` *(configurável via `SWAGGER_PATH` no `.env`)*

## Credenciais de Teste (`prisma/seed.ts`)

Todos os usuários criados pelo seed utilizam a senha padrão `Senha@123`:

| E-mail | Perfil | Unidade | Observação |
|---|---|---|---|
| `admin@raizes.com` | `ADMIN` | `null` | Acesso administrativo global |
| `gerente.rec@raizes.com` | `GERENTE` | `REC-01` | Boa Viagem — gestão local e auditoria |
| `atendente.rec@raizes.com` | `ATENDENTE` | `REC-01` | Boa Viagem — balcão e entrega (`ENTREGUE`) |
| `cozinha.rec@raizes.com` | `COZINHA` | `REC-01` | Boa Viagem — preparo e `PRONTO` |
| `cliente@exemplo.com` | `CLIENTE` | `null` | Fidelidade ativa com `20` pontos iniciais |

- **Promoções vigentes no seed:** `TOTEM10` (`10%` exclusivo no canal `TOTEM`, mínimo R$ 20,00) e `RAIZES5` (`R$ 5,00` fixo em qualquer canal, mínimo R$ 15,00).
- **Produto para simular erro de estoque (`409`):** `Bolo de Rolo Tradicional` em `REC-01` inicia com saldo `2`.

## Testes e Coleção Postman

### Testes automatizados e lint
```bash
# análise estática e tipos
npm run lint

# testes unitários
npm test

# testes HTTP ponta a ponta (E2E)
npm run test:e2e
```

### Validação manual/automatizada no Postman
1. Com a API rodando e o seed aplicado, importe [`test/postman/raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json).
2. Execute as pastas em ordem (`1` → `7`, ou clique em **Run collection**). A coleção autentica os perfis, armazena os tokens e IDs automaticamente e valida os 16 cenários (`T01`–`T16`) descritos em [`docs/tests/test-plan.md`](./docs/tests/test-plan.md).

## Links Públicos (Evidências)

- **Repositório GitHub:** https://github.com/mmrezende/raizes-nordeste-api
- **Swagger Local:** `http://localhost:3000/docs` (rota `/docs`)
- **Coleção Postman:** https://github.com/mmrezende/raizes-nordeste-api/blob/main/test/postman/raizes-nordeste-api.postman_collection.json
