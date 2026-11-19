# Raízes do Nordeste API

API REST multicanal para gestão de unidades, cardápio, estoque por loja, pedidos (`APP`, `TOTEM`, `BALCAO`, `PICKUP`, `WEB`), promoções, pagamento simulado (mock), programa de fidelidade com consentimento LGPD e auditoria.

## Stack

- **Runtime / Linguagem:** Node.js 22+ / TypeScript
- **Framework:** NestJS 12
- **ORM / Banco:** Prisma 6 + SQLite (`prisma/dev.db`, portável para PostgreSQL)
- **Autenticação & Validação:** JWT + `bcryptjs` + `class-validator`
- **Documentação & Testes:** OpenAPI/Swagger + Jest + Supertest

## Documentação e Modelagem

- Requisitos e regras de negócio: [`docs/requirements/requirements.md`](./docs/requirements/requirements.md)
- Casos de uso e fluxos críticos: [`docs/requirements/use-cases.md`](./docs/requirements/use-cases.md)
- **Diagramas (DER, Casos de Uso, Classes, Sequência e Arquitetura):** [`docs/diagrams/README.md`](./docs/diagrams/README.md)

## Estrutura do Projeto

```text
├── docs/                  # Requisitos, casos de uso, diagramas, contratos e LGPD
├── prisma/                # Schema, migrations e seed do banco SQLite
├── scripts/               # Scripts utilitários locais
├── src/
│   ├── domain/            # Entidades, enums, erros e contratos de repositório
│   ├── application/       # Casos de uso e interfaces de serviços externos
│   ├── infrastructure/    # Prisma ORM, JWT/hash, UUIDv7, auditoria e pagamento mock
│   └── api/               # Controllers, DTOs, guards RBAC, filtros e Swagger
└── test/
    ├── unit/              # Testes unitários
    ├── e2e/               # Testes HTTP ponta a ponta
    └── postman/           # Coleção Postman/Insomnia (.json)
```

## Como Rodar Localmente

### 1. Pré-requisitos
- Node.js 22+ e npm

### 2. Configurar variáveis de ambiente
Copie o template de exemplo e ajuste se necessário:
```bash
cp .env.example .env
```

### 3. Instalar dependências e preparar o banco
```bash
npm install
npm run prisma:generate
npx prisma migrate dev
npm run prisma:seed
```

### 4. Subir a API
```bash
# desenvolvimento (watch)
npm run start:dev

# produção
npm run build
npm run start:prod
```

- **Base URL:** `http://localhost:3000`
- **Swagger / OpenAPI:** `http://localhost:3000/docs` *(configurável via `SWAGGER_PATH` no `.env`)*

## Testes

```bash
# testes unitários
npm test

# testes e2e
npm run test:e2e
```

A coleção reproduzível para validação manual/automatizada ficará em `test/postman/`.

## Repositório

- GitHub: https://github.com/mmrezende/raizes-nordeste-api
