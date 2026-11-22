# Raízes do Nordeste API

**Instituição:** Centro Universitário Internacional UNINTER - Escola Superior Politécnica (ESP)  
**Disciplina:** Projeto Multidisciplinar - Trilha Back-End (Análise e Desenvolvimento de Sistemas)  
**Aluno:** Mateus Mendonça Dias Rezende (RU: `4841127`)  
**Professora:** Prof. Me. Luciane Yanase Kanashiro | **Ano:** 2026

## Sumário

1. [Introdução e Objetivos](#1-introdução-e-objetivos)
2. [Análise e Requisitos](#2-análise-e-requisitos)
3. [Modelagem e Arquitetura](#3-modelagem-e-arquitetura)
4. [API e Endpoints](#4-api-e-endpoints)
5. [LGPD e Segurança](#5-lgpd-e-segurança)
6. [Entrega Técnica e Execução](#6-entrega-técnica-e-execução)
7. [Plano de Testes](#7-plano-de-testes)
8. [Conclusão](#8-conclusão)
9. [Referências](#9-referências)

---
<br>

## 1. Introdução e Objetivos

A rede de lanchonetes **Raízes do Nordeste** expandiu sua operação para múltiplas lojas vendendo simultaneamente por aplicativo, totem, balcão, web e retirada rápida. Sem um núcleo centralizado, surgiram divergências de preço no cardápio, venda de produtos sem estoque local, falhas na aplicação de cupons e ausência de controle sobre o consentimento de clientes no programa de fidelidade.

Este projeto implementa uma API REST em **NestJS 12, TypeScript e Prisma ORM (SQLite)** para centralizar catálogo, promoções e fidelidade na matriz, mantendo o estoque e a fila de preparo isolados por unidade física, com exigência do canal de origem, pagamento simulado idempotente e adequação à LGPD.

---
<br>

## 2. Análise e Requisitos

O sistema controla o acesso por perfil (`CLIENTE`, `ATENDENTE`, `COZINHA`, `GERENTE` e `ADMIN`), vinculando funcionários à sua respectiva `unidadeId`. O catálogo de produtos pertence à matriz, mas o saldo fica isolado em cada loja (`estoque_unidades`), de modo que a consulta pública do cardápio (`GET /unidades/:id/cardapio`) exibe apenas itens ativos e disponíveis naquele endereço.

Na abertura do pedido (`POST /pedidos`), o campo `canalPedido` (`APP`, `TOTEM`, `BALCAO`, `PICKUP` ou `WEB`) é obrigatório (`422` se ausente). Os cálculos de subtotal, cupom (`PERCENTUAL` ou `VALOR_FIXO`) e desconto de fidelidade rodam no servidor em centavos inteiros (`Int`), reservando o estoque na mesma transação. O pagamento (`POST /pagamentos`) exige `idempotencyKey` para evitar cobrança dupla: quando aprovado pelo gateway mock, o pedido vai para `EM_PREPARO` e gera pontos (1 pt a cada R$ 10,00 com consentimento ativo); se recusado ou cancelado antes da entrega, uma transação devolve o estoque e estorna os pontos utilizados ou gerados.

No escopo do projeto, o MVP entrega todos esses fluxos transacionais localmente em SQLite com chaves UUIDv7. Integrações de infraestrutura externa - gateway real via webhooks, fila em tempo real por WebSocket, revogação de JWT em Redis e banco PostgreSQL - ficaram para a Fase 2, apoiadas nas interfaces da camada de aplicação.

<div class="page"></div>
<br>

## 3. Modelagem e Arquitetura

### 3.1 Casos de Uso e Fluxos Críticos

O diagrama abaixo mapeia os seis atores (`Cliente`, `Atendente`, `Cozinha`, `Gerente`, `Administrador` e `Gateway Mock`) e os casos de uso `UC01` a `UC14`.

![Diagrama de Casos de Uso](./docs/diagrams/img/use-cases.svg)

- **Pedido e Pagamento (`UC04` e `UC07`):** requer usuário ativo, unidade/produtos ativos e saldo local (além de consentimento ativo caso resgate pontos). `POST /pedidos` cria o registro em `AGUARDANDO_PAGAMENTO`, reserva o estoque (`UC05`) e debita pontos (`UC06`) em transação única. `POST /pagamentos` valida a `idempotencyKey` (retornando `200 OK` se já processada) e aciona o gateway mock: aprovado (`201`) avança para `EM_PREPARO` e pontua; recusado (`simularRecusa: true`) muda para `PAGAMENTO_RECUSADO` e estorna estoque e pontos.
- **Status e Cancelamento (`UC09`):** a cozinha avança `EM_PREPARO -> PRONTO` e o balcão conclui `PRONTO -> ENTREGUE` (`PATCH /pedidos/:id/status`), bloqueando desvios com `403` ou `409`. O cancelamento (`POST /pedidos/:id/cancelar`) ocorre antes da entrega (para o cliente, apenas antes de `PRONTO`), revertendo estoque e pontos em transação.

<div class="page"></div>
<br>

### 3.2 Modelo de Dados (DER)

O banco possui 12 tabelas relacionais com chaves primárias UUIDv7 e restrições `unique(unidade_id, produto_id)` em `estoque_unidades`, `unique(pedido_id, produto_id)` em `itens_pedido` e `unique(idempotency_key)` em `pagamentos`.

![Diagrama Entidade-Relacionamento](./docs/diagrams/img/der.svg)

<div class="page"></div>
<br>

### 3.3 Arquitetura em 4 Camadas

A aplicação separa **Domain** (`src/domain`, regras puras de cálculo/status e erros sem ORM/HTTP), **Application** (`src/application`, services, escopo por unidade e portas), **Infrastructure** (`src/infrastructure`, Prisma, Bcrypt, JWT, UUIDv7 e `MockPaymentGateway`) e **API** (`src/api`, controllers, DTOs, guards, interceptor de auditoria, filtro global e Swagger).

![Arquitetura em 4 Camadas](./docs/diagrams/img/architecture.svg)

<div class="page"></div>
<br>

### 3.4 Diagrama de Classes

Representação das entidades, atributos, métodos e multiplicidades nos cinco pacotes do domínio.

![Diagrama de Classes](./docs/diagrams/img/classes.svg)

<div class="page"></div>
<br>

### 3.5 Diagrama de Sequência

Fluxo transacional de `POST /pedidos` e `POST /pagamentos`, detalhando validações (`404`, `409`, `422`), idempotência (`200 OK`), aprovação/estorno e gravação de auditoria.

![Diagrama de Sequência - Pedido e Pagamento](./docs/diagrams/img/sequence-order-payment.svg)

<div class="page"></div>
<br>

## 4. API e Endpoints

Rotas REST no plural, paginação `?page=1&limit=10`, header `X-Request-Id` e documentação interativa em `/docs`:

- **Auth e Usuários:** `GET /health`, `POST /auth/register` e `POST /auth/login` (públicos); `GET /usuarios/me` e `DELETE /usuarios/me` (titular JWT); `POST /usuarios` (`ADMIN` e `GERENTE`).
- **Unidades, Catálogo, Estoque e Promoções:** `GET /unidades`, `GET /unidades/:id/cardapio`, `GET /produtos` e `GET /promocoes` (públicos); `POST /unidades`, `POST /produtos` e `POST /promocoes` (`ADMIN`); `GET /unidades/:id/estoque` (loja/`ADMIN`) e `POST /estoque/movimentacoes` (`GERENTE`/`ADMIN`).
- **Pedidos e Pagamentos:** `POST /pedidos`, `GET /pedidos` (`?canalPedido=&status=&unidadeId=`), `GET /pedidos/:id`, `PATCH /pedidos/:id/status`, `POST /pedidos/:id/cancelar` e `POST /pagamentos` (`idempotencyKey`, `simularRecusa`).
- **Fidelidade e Auditoria:** `GET /fidelidade/conta`, `PATCH /fidelidade/consentimento` e `GET /fidelidade/movimentacoes` (titular JWT); `GET /auditoria` (`ADMIN` geral e `GERENTE` da própria loja).

```json
// POST /auth/login -> 200 OK | Request: { "email": "cliente@exemplo.com", "senha": "Senha@123" }
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": "019c6199-df00-7000-8000-000000000305", "nome": "Maria Cliente", "email": "cliente@exemplo.com", "perfil": "CLIENTE", "unidadeId": null }
}
```

```json
// POST /pedidos -> 201 Created | Request: { "unidadeId": "019c6199-df00-7000-8000-000000000101", "canalPedido": "TOTEM", "codigoPromocao": "TOTEM10", "pontosResgate": 5, "itens": [{ "produtoId": "019c6199-df00-7000-8000-000000000201", "quantidade": 2 }] }
{
  "id": "019c6199-df00-7a00-8f41-9c2a1b3e4f77",
  "unidadeId": "019c6199-df00-7000-8000-000000000101",
  "canalPedido": "TOTEM",
  "status": "AGUARDANDO_PAGAMENTO",
  "subtotalCentavos": 4980,
  "descontoPromocaoCentavos": 498,
  "pontosUtilizados": 5,
  "descontoFidelidadeCentavos": 250,
  "valorTotalCentavos": 4232,
  "valorTotal": 42.32
}
```

```json
// POST /pagamentos -> 201 Created (ou 200 OK no retry idempotente) | Request: { "pedidoId": "019c6199-df00-7a00-8f41-9c2a1b3e4f77", "formaPagamento": "PIX", "idempotencyKey": "pm-ok-1771164000000" }
{
  "id": "019c6199-df00-7a00-8f41-9c2a1b3e4f88",
  "pedidoId": "019c6199-df00-7a00-8f41-9c2a1b3e4f77",
  "unidadeId": "019c6199-df00-7000-8000-000000000101",
  "status": "APROVADO",
  "valorCentavos": 4232,
  "referenciaExterna": "MOCK-PIX-1771164000000",
  "payloadRetorno": { "provider": "raizes-mock-gateway", "aprovado": true, "motivo": null }
}
```

```json
// Erro padronizado -> 409 Conflict
{
  "error": "ESTOQUE_INSUFICIENTE",
  "message": "Estoque insuficiente na unidade selecionada.",
  "details": [{ "field": "itens", "issue": "Bolo de Rolo Tradicional: solicitado 5, disponível 2" }],
  "timestamp": "2026-02-15T14:00:00.000Z",
  "path": "/pedidos",
  "requestId": "019c6199-df00-7a00-8f41-9c2a1b3e4f99"
}
```

<div class="page"></div>
<br>

## 5. LGPD e Segurança

A API aplica minimização de dados (Lei nº 13.709/2018), coletando apenas nome, e-mail e senha para conta e pedidos sob as bases de execução de contrato (Art. 7º, V) e obrigação legal (Art. 7º, II), sem armazenar CPF, endereço residencial ou cartão. A fidelidade exige consentimento explícito (Art. 7º, I): `consentimentoAtivo` inicia falso, é gerenciado em `PATCH /fidelidade/consentimento` com timestamps (`consentimentoEm`, `revogadoEm`) e bloqueia pontuação ou resgate quando inativo (`409`).

O endpoint `DELETE /usuarios/me` anonimiza o titular (`nome = "Usuário Anonimizado"`, `email = anonimizado-<id>@anon.local`, descarte de senha, revogação da fidelidade e `ativo = false`), preservando o histórico contábil dos pedidos. Como a `JwtStrategy` valida se o usuário segue ativo no banco, tokens anteriores à anonimização passam a retornar `401 NAO_AUTENTICADO` imediatamente. Senhas usam `bcryptjs` (custo 10) e são omitidas nas projeções do Prisma, e a auditoria (legítimo interesse, Art. 7º, IX) registra apenas metadados de uma allowlist sem gravar segredos.

---
<br>

## 6. Entrega Técnica e Execução

- **Repositório GitHub:** https://github.com/mmrezende/raizes-nordeste-api
- **API e Swagger local:** `http://localhost:3000` e `http://localhost:3000/docs`
- **Coleção Postman:** [`test/postman/raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json)
- **Ambiente:** **Node.js 24+ (LTS)** e `npm` (`.env.example` define `PORT=3000`, `SWAGGER_PATH=docs`, `DATABASE_URL="file:./dev.db"`, `JWT_SECRET` e `JWT_EXPIRES_IN_SECONDS=3600`).

```bash
git clone https://github.com/mmrezende/raizes-nordeste-api.git && cd raizes-nordeste-api
cp .env.example .env && npm install
npm run prisma:generate && npx prisma migrate deploy && npm run prisma:seed
npm run start:dev
```

O seed (`prisma/seed.ts`) cria as unidades `REC-01` e `FOR-01`, o catálogo, os cupons `TOTEM10` e `RAIZES5`, e cinco contas de teste (senha `Senha@123`): `admin@raizes.com`, `gerente.rec@raizes.com`, `atendente.rec@raizes.com`, `cozinha.rec@raizes.com` e `cliente@exemplo.com` (20 pontos e consentimento ativo), além de estoque reduzido (`2` unidades) para o *Bolo de Rolo Tradicional* em Recife.

<div class="page"></div>
<br>

## 7. Plano de Testes

Os testes automatizados somam 7 suítes unitárias (34 testes) e 6 suítes E2E HTTP (35 testes). A suíte E2E roda em banco SQLite separado (`prisma/test-e2e.db`) para não apagar o `prisma/dev.db` usado na avaliação manual:

```bash
npm run lint && npm test && npm run test:e2e
```

No Postman, basta importar a coleção e executar as pastas `1` a `7` em ordem (9 cenários positivos e 7 negativos):

| ID | Cenário | Rota | Pré-condição e Entrada | Saída Esperada e Evidência |
|---|---|---|---|---|
| `T01` | Login válido de cliente | `POST /auth/login` | Seed aplicado; `cliente@exemplo.com` | `200 OK` com `accessToken` (`1. Auth / T01`) |
| `T02` | Cardápio disponível da loja | `GET /unidades/:id/cardapio` | Unidade `REC-01` com estoque ativo | `200 OK` com itens e saldo (`2. Unidades / T02`) |
| `T03` | Rota protegida sem token | `GET /unidades/:id/estoque` | Requisição sem header Bearer | `401 NAO_AUTENTICADO` (`2. Unidades / T03`) |
| `T04` | Pedido `TOTEM` com cupom/pontos | `POST /pedidos` | Token cliente; `TOTEM`, `TOTEM10`, 5 pts | `201 Created`, total `4232` (`3. Pedidos / T04`) |
| `T05` | Filtro de pedidos por canal | `GET /pedidos` | Query `?canalPedido=TOTEM` | `200 OK` apenas com canal `TOTEM` (`3. Pedidos / T05`) |
| `T06` | Pedido sem `canalPedido` | `POST /pedidos` | Body omitindo `canalPedido` | `422 ERRO_VALIDACAO` (`3. Pedidos / T06`) |
| `T07` | Quantidade negativa no item | `POST /pedidos` | Body com `quantidade: -1` | `422 ERRO_VALIDACAO` (`3. Pedidos / T07`) |
| `T08` | Produto inexistente | `POST /pedidos` | `produtoId` UUIDv7 não cadastrado | `404 PRODUTO_NAO_ENCONTRADO` (`3. Pedidos / T08`) |
| `T09` | Estoque insuficiente na loja | `POST /pedidos` | 5x *Bolo de Rolo* (saldo disponível: 2) | `409 ESTOQUE_INSUFICIENTE` (`3. Pedidos / T09`) |
| `T10` | Pagamento mock aprovado | `POST /pagamentos` | Pedido de `T04`, `PIX`, `idempotencyKey` | `201 APROVADO`, pedido `EM_PREPARO` (`4. Pagamentos / T10`) |
| `T11` | Retentativa idempotente | `POST /pagamentos` | Reenvio da mesma `idempotencyKey` | `200 OK` com mesmo ID, sem recobrar (`4. Pagamentos / T11`) |
| `T12` | Pagamento recusado e estorno | `POST /pagamentos` | Novo pedido com `simularRecusa: true` | `201 RECUSADO` e estoque devolvido (`4. Pagamentos / T12`) |
| `T13` | Status alterado sem permissão | `PATCH /pedidos/:id/status` | Token de `CLIENTE` tentando `PRONTO` | `403 ACESSO_NEGADO` (`5. Status / T13`) |
| `T14` | Cozinha conclui preparo | `PATCH /pedidos/:id/status` | Token `COZINHA` enviando `PRONTO` | `200 OK` com status `PRONTO` (`5. Status / T14`) |
| `T15` | Balcão confirma entrega | `PATCH /pedidos/:id/status` | Token `ATENDENTE` enviando `ENTREGUE` | `200 OK` com status `ENTREGUE` (`5. Status / T15`) |
| `T16` | Auditoria filtrada por loja | `GET /auditoria` | Token `GERENTE` com `?entidade=pedidos` | `200 OK` com eventos de `REC-01` (`7. Auditoria / T16`) |

<div class="page"></div>
<br>

## 8. Conclusão

A construção da API atendeu aos requisitos operacionais da rede **Raízes do Nordeste**, mas a adoção simultânea do **NestJS** e do **Prisma ORM** trouxe dificuldades técnicas práticas ao longo do desenvolvimento. No NestJS, a principal curva de aprendizado foi dominar a ordem do pipeline de requisição - integrando middleware de `X-Request-Id`, `ValidationPipe` (onde foi preciso desativar a conversão implícita do `class-transformer` que transformava qualquer string em booleano verdadeiro), guards globais de JWT/RBAC, `AuditInterceptor` assíncrono com RxJS e o `GlobalExceptionFilter` - além de configurar a injeção de dependências com tokens `Symbol` para desacoplar as portas da camada de aplicação sem gerar dependências circulares entre módulos.

No Prisma com SQLite, os desafios concentraram-se na coordenação de transações interativas (`prisma.$transaction`) para reservar e estornar estoque e pontos sem condição de corrida, bem como na tradução de erros internos do ORM (como interceptar o código `P2002` de violação de chave única em chamadas concorrentes de pagamento para devolver `409` ou o registro idempotente em vez de um erro `500`). Outro ponto crítico foi o isolamento do banco nos testes automatizados: como os testes E2E limpavam as tabelas a cada suíte, foi necessário redirecionar o `DATABASE_URL` de testes para um arquivo separado (`prisma/test-e2e.db`), preservando o banco `prisma/dev.db` populado pelo seed.

---
<br>

## 9. Referências

- BRASIL. **Lei nº 13.709, de 14 de agosto de 2018**. Lei Geral de Proteção de Dados Pessoais (LGPD). Brasília, DF: Presidência da República, 2018.
- FOWLER, M. **UML Essencial: um breve guia para a linguagem-padrão de modelagem de objetos**. 3. ed. Porto Alegre: Bookman, 2005.
- NESTJS. **NestJS Documentation**. Disponível em: https://docs.nestjs.com. Acesso em: nov. 2026.
- OPENAPI INITIATIVE. **OpenAPI Specification v3.0**. Disponível em: https://spec.openapis.org/oas/latest.html. Acesso em: nov. 2026.
- PRESSMAN, R. S.; MAXIM, B. R. **Engenharia de Software: uma abordagem profissional**. 9. ed. Porto Alegre: AMGH, 2021.
- PRISMA. **Prisma ORM Documentation**. Disponível em: https://www.prisma.io/docs. Acesso em: nov. 2026.
- SOMMERVILLE, I. **Engenharia de Software**. 10. ed. São Paulo: Pearson Education do Brasil, 2018.
