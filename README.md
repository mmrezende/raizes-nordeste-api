# Raízes do Nordeste API

**Instituição:** Centro Universitário Internacional UNINTER - Escola Superior Politécnica (ESP)  
**Disciplina:** Projeto Multidisciplinar - Trilha Back-End (Análise e Desenvolvimento de Sistemas)  
**Aluno:** Mateus Mendonça Dias Rezende (RU: `4841127`)  
**Professora:** Prof. Me. Luciane Yanase Kanashiro | **Ano:** 2026 | **Entrega:** `4841127_Projeto_Back_End.PDF`

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

## 1. Introdução e Objetivos

O estudo de caso da rede de lanchonetes **Raízes do Nordeste** retrata um problema recorrente no varejo de alimentação em expansão: com a abertura de novas unidades e a venda simultânea por aplicativo, totem de autoatendimento, balcão, web e retirada rápida, controles locais descentralizados passam a gerar divergência de preços no cardápio, venda de itens sem saldo na cozinha, aplicação incorreta de promoções e falta de rastreabilidade sobre os dados de clientes no programa de fidelidade.

Para resolver esse cenário, este projeto implementa uma API REST centralizada em **NestJS 12, TypeScript e Prisma ORM (SQLite)**. O objetivo do serviço é unificar o catálogo de produtos, as campanhas promocionais e a pontuação de fidelidade na matriz, mantendo o saldo de estoque e a fila de preparo isolados por unidade física, com validação estrita do canal de origem, processamento de pagamento simulado e conformidade com a LGPD.

---

## 2. Análise e Requisitos

No levantamento funcional, o sistema foi estruturado em cinco frentes. A primeira é o controle de acesso por perfil (`CLIENTE`, `ATENDENTE`, `COZINHA`, `GERENTE` e `ADMIN`), no qual funcionários operacionais ficam vinculados à sua loja (`unidadeId`) e só podem consultar ou alterar pedidos, estoques e registros daquela unidade. A segunda é a separação entre o catálogo único da matriz e o estoque local, garantindo que a consulta pública do cardápio de uma loja (`GET /unidades/:id/cardapio`) liste apenas produtos ativos com saldo disponível para venda naquele endereço.

A terceira frente cobre o ciclo de pedidos multicanal. Todo pedido exige o campo `canalPedido` (`APP`, `TOTEM`, `BALCAO`, `PICKUP` ou `WEB`) na criação, retornando erro `422` quando omitido, e permite filtragem combinada por canal, status e unidade na listagem. Os cálculos de subtotal, cupom promocional (`PERCENTUAL` ou `VALOR_FIXO`) e resgate de pontos ocorrem exclusivamente no servidor em centavos inteiros (`Int`), congelando o preço unitário no momento da compra. Na mesma transação em que o pedido é criado como `AGUARDANDO_PAGAMENTO`, o saldo dos itens é reservado no estoque da unidade.

A quarta e a quinta frentes tratam do pagamento simulado, da fidelidade e da auditoria. O endpoint de pagamento exige uma chave de idempotência (`idempotencyKey`) para impedir cobranças duplicadas em retentativas de rede. Quando o gateway mock aprova a transação, o pedido avança para `EM_PREPARO` e o cliente acumula 1 ponto a cada R$ 10,00 pagos (desde que possua consentimento ativo na LGPD). Se o pagamento for recusado ou o pedido for cancelado antes da entrega, uma transação atômica devolve os itens ao estoque e estorna os pontos resgatados ou acumulados.

Quanto à priorização de escopo, o MVP entregue implementa integralmente os fluxos transacionais de autenticação, catálogo, estoque por loja, pedido multicanal, pagamento mock idempotente, fidelidade, anonimização e auditoria em banco SQLite local com identificadores UUIDv7. Integrações externas de infraestrutura, como webhooks de adquirentes reais, notificações em tempo real para a cozinha via WebSocket, revogação de tokens em Redis e banco PostgreSQL dedicado, foram planejadas para a Fase 2 e já contam com portas de inversão de dependência na camada de aplicação.

<div style="page-break-before: always;"></div>

## 3. Modelagem e Arquitetura

### 3.1 Casos de Uso e Fluxos Críticos

O diagrama de casos de uso delimita a fronteira da API e as interações dos seis atores (`Cliente`, `Atendente`, `Cozinha`, `Gerente`, `Administrador` e `Gateway de Pagamento Mock`) ao longo de `UC01` a `UC14`.

![Diagrama de Casos de Uso](./docs/diagrams/img/use-cases.svg)

Dois fluxos concentram as regras críticas de negócio:

- **Realizar Pedido e Solicitar Pagamento (`UC04` e `UC07`):** tem como pré-condições um usuário autenticado e ativo, unidade e produtos ativos, saldo disponível na loja e, caso haja resgate de pontos, consentimento ativo e saldo suficiente na conta de fidelidade. No fluxo principal, `POST /pedidos` valida o `canalPedido`, calcula os descontos no servidor e executa uma transação que grava o pedido em `AGUARDANDO_PAGAMENTO`, abate o estoque (`UC05`) e debita os pontos utilizados (`UC06`). Em seguida, `POST /pagamentos` verifica a `idempotencyKey`: se a chave já tiver sido processada para o pedido, devolve `200 OK` com o registro original sem nova cobrança; se for inédita, aciona o gateway mock. Na aprovação (`201`), o pedido passa para `EM_PREPARO` e credita novos pontos; na recusa simulada (`simularRecusa: true`), o pedido assume `PAGAMENTO_RECUSADO` e estorna estoque e pontos na mesma transação.
- **Atualizar Status e Cancelar Pedido (`UC09`):** exige autenticação e vínculo com o pedido (dono, equipe da unidade ou administrador). A cozinha avança pedidos pagos de `EM_PREPARO` para `PRONTO`, e o atendente conclui de `PRONTO` para `ENTREGUE` (`PATCH /pedidos/:id/status`), bloqueando transições fora de ordem com `409` ou perfis sem permissão com `403`. O cancelamento (`POST /pedidos/:id/cancelar`) é permitido antes da entrega, sendo restrito para o cliente apenas enquanto o pedido ainda não entrou em `PRONTO`, revertendo em transação o estoque reservado e os pontos de fidelidade.

<div style="page-break-before: always;"></div>

### 3.2 Modelo de Dados (DER)

O esquema relacional possui 12 tabelas no SQLite com chaves primárias UUIDv7, que mantêm ordenação cronológica em índices B-tree sem expor contadores sequenciais. As restrições `unique(unidade_id, produto_id)` em `estoque_unidades`, `unique(pedido_id, produto_id)` em `itens_pedido` e `unique(idempotency_key)` em `pagamentos` garantem a consistência estrutural das operações concorrentes.

![Diagrama Entidade-Relacionamento](./docs/diagrams/img/der.svg)

### 3.3 Arquitetura em 4 Camadas

O código-fonte divide-se em quatro camadas com dependências voltadas para o núcleo. A camada **Domain** (`src/domain`) contém enums, erros tipados e regras puras de cálculo e transição de status, sem dependência de framework ou ORM. A camada **Application** (`src/application`) orquestra os casos de uso, valida escopo por loja e declara portas (`PaymentGateway`, `AuditLogger`, `IdGenerator`, `PasswordHasher`). A camada **Infrastructure** (`src/infrastructure`) implementa essas portas com Prisma, `bcryptjs`, JWT, pacote `uuidv7` e `MockPaymentGateway`. A camada **API** (`src/api`) reúne controllers REST, DTOs validados com `class-validator`, guards de autenticação e perfil, interceptor de auditoria, middleware `X-Request-Id`, filtro global de exceções e documentação Swagger.

![Arquitetura em 4 Camadas](./docs/diagrams/img/architecture.svg)

<div style="page-break-before: always;"></div>

### 3.4 Diagrama de Classes

O diagrama de classes representa as entidades de domínio, seus atributos tipados, métodos de negócio e multiplicidades distribuídos nos pacotes de Identidade e Auditoria, Rede e Estoque, Pedidos e Promoções, Pagamentos e Fidelidade/LGPD.

![Diagrama de Classes](./docs/diagrams/img/classes.svg)

<div style="page-break-before: always;"></div>

### 3.5 Diagrama de Sequência

O diagrama de sequência detalha a comunicação entre cliente, camada de API/interceptors, banco SQLite e gateway simulado durante a abertura do pedido (`POST /pedidos`) e a liquidação do pagamento (`POST /pagamentos`), explicitando os retornos de erro (`404`, `409`, `422`), o curto-circuito de idempotência (`200 OK`) e o registro de auditoria pós-commit.

![Diagrama de Sequência - Pedido e Pagamento](./docs/diagrams/img/sequence-order-payment.svg)

<div style="page-break-before: always;"></div>

## 4. API e Endpoints

A API segue o padrão REST com rotas no plural, paginação via query string (`?page=1&limit=10`), cabeçalho `X-Request-Id` em todas as respostas e especificação OpenAPI interativa em `/docs`. As rotas estão agrupadas por domínio:

- **Saúde, Autenticação e Usuários:** `GET /health`, `POST /auth/register` e `POST /auth/login` são públicos. `GET /usuarios/me` e `DELETE /usuarios/me` atendem ao titular autenticado, enquanto `POST /usuarios` permite a `ADMIN` e `GERENTE` cadastrar funcionários da unidade.
- **Unidades, Catálogo, Estoque e Promoções:** `GET /unidades`, `GET /unidades/:id/cardapio`, `GET /produtos` e `GET /promocoes` são abertos ao público. Os cadastros de matriz (`POST /unidades`, `POST /produtos`, `POST /promocoes`) exigem perfil `ADMIN`. A consulta `GET /unidades/:id/estoque` pertence à equipe da loja ou `ADMIN`, e o ajuste manual `POST /estoque/movimentacoes` é restrito a `GERENTE` da unidade e `ADMIN`.
- **Pedidos e Pagamentos:** `POST /pedidos`, `GET /pedidos` (com filtros `?canalPedido=&status=&unidadeId=`), `GET /pedidos/:id`, `PATCH /pedidos/:id/status` e `POST /pedidos/:id/cancelar` exigem JWT e aplicam isolamento automático entre clientes e lojas. `POST /pagamentos` processa a cobrança simulada com `idempotencyKey` e flag opcional `simularRecusa`.
- **Fidelidade e Auditoria:** `GET /fidelidade/conta`, `PATCH /fidelidade/consentimento` e `GET /fidelidade/movimentacoes` são operados pelo cliente autenticado; `GET /auditoria` permite consulta paginada de eventos sensíveis por `ADMIN` (toda a rede) e `GERENTE` (apenas registros da própria unidade).

Abaixo estão os contratos JSON dos fluxos principais de login, criação de pedido com cupom e pontos, pagamento aprovado e erro padronizado:

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
// POST /pagamentos -> 201 Created (ou 200 OK na retentativa idempotente)
// Request: { "pedidoId": "019c6199-df00-7a00-8f41-9c2a1b3e4f77", "formaPagamento": "PIX", "idempotencyKey": "pm-ok-1771164000000" }
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

<div style="page-break-before: always;"></div>

## 5. LGPD e Segurança

O tratamento de dados pessoais observa o princípio de minimização da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). A API coleta apenas nome, e-mail e hash de senha para identificação da conta e controle de acesso, além do vínculo de pedidos para atendimento e conciliação financeira, apoiando-se nas bases legais de execução de contrato (Art. 7º, inciso V) e cumprimento de obrigação legal (inciso II), sem armazenar CPF, endereço residencial ou número de cartão. Já a participação no programa de fidelidade baseia-se no consentimento explícito do titular (Art. 7º, inciso I): o campo `consentimentoAtivo` inicia falso por padrão, pode ser concedido ou revogado a qualquer momento em `PATCH /fidelidade/consentimento` com registro de data/hora (`consentimentoEm` e `revogadoEm`), e bloqueia qualquer acúmulo ou resgate de pontos quando inativo (`409 FIDELIDADE_SEM_CONSENTIMENTO`).

Para assegurar o direito de eliminação sem comprometer o histórico fiscal dos pedidos das unidades, o endpoint `DELETE /usuarios/me` executa a anonimização irreversível do titular: o nome passa a `"Usuário Anonimizado"`, o e-mail é substituído por `anonimizado-<id>@anon.local`, a senha é descartada por um hash aleatório, o consentimento de fidelidade é revogado e o cadastro é marcado como inativo (`ativo = false`). Como a estratégia JWT consulta a situação ativa do usuário a cada requisição, tokens emitidos antes da anonimização são invalidados de imediato com `401 NAO_AUTENTICADO`. Complementam a segurança o hash `bcryptjs` (custo 10), a omissão estrutural de `senhaHash` nas projeções do Prisma, os guards globais de RBAC e a trilha de auditoria baseada em legítimo interesse e prevenção a fraudes (Art. 7º, inciso IX), que grava apenas metadados operacionais de uma allowlist sem expor senhas ou tokens.

---

## 6. Entrega Técnica e Execução

- **Repositório público (GitHub):** https://github.com/mmrezende/raizes-nordeste-api
- **Servidor local e Swagger:** `http://localhost:3000` e `http://localhost:3000/docs`
- **Coleção Postman:** [`test/postman/raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json)
- **Pré-requisitos e variáveis:** **Node.js 24+ (LTS)** e `npm`. O arquivo `.env.example` documenta `NODE_ENV=development`, `PORT=3000`, `SWAGGER_PATH=docs`, `DATABASE_URL="file:./dev.db"`, `JWT_SECRET` e `JWT_EXPIRES_IN_SECONDS=3600`.

```bash
git clone https://github.com/mmrezende/raizes-nordeste-api.git
cd raizes-nordeste-api
cp .env.example .env
npm install
npm run prisma:generate && npx prisma migrate deploy && npm run prisma:seed
npm run start:dev
```

O seed inicial (`prisma/seed.ts`) cadastra as unidades de Recife (`REC-01`) e Fortaleza (`FOR-01`), o catálogo regional, os cupons `TOTEM10` e `RAIZES5`, e cinco usuários com a senha padrão `Senha@123`: `admin@raizes.com` (`ADMIN`), `gerente.rec@raizes.com` (`GERENTE`), `atendente.rec@raizes.com` (`ATENDENTE`), `cozinha.rec@raizes.com` (`COZINHA`) e `cliente@exemplo.com` (`CLIENTE`, com 20 pontos e consentimento ativo). O item *Bolo de Rolo Tradicional* inicia com saldo `2` em Recife para permitir o teste imediato de bloqueio por falta de estoque.

<div style="page-break-before: always;"></div>

## 7. Plano de Testes

A validação do projeto combina testes automatizados em Jest e cenários de aceitação na coleção Postman. Para que a execução dos testes fim a fim nunca apague os dados demonstrativos do banco principal (`prisma/dev.db`), a suíte E2E utiliza um arquivo SQLite dedicado (`prisma/test-e2e.db`). Ao todo, são 7 suítes unitárias (34 testes) e 6 suítes E2E HTTP (35 testes):

```bash
npm run lint && npm test && npm run test:e2e
```

No Postman, com a API em execução após o seed, basta importar a coleção JSON e rodar as pastas de `1` a `7` em ordem. Os scripts `pm.test` encadeiam tokens e IDs automaticamente ao longo dos 16 cenários principais (9 positivos e 7 negativos, além da pasta `6` dedicada à fidelidade e LGPD):

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

---

## 8. Conclusão

O desenvolvimento da API da rede **Raízes do Nordeste** permitiu converter os gargalos operacionais descritos no estudo de caso em regras transacionais verificáveis. O principal desafio técnico consistiu em coordenar o saldo de estoque por loja e a pontuação de fidelidade diante de falhas de pagamento ou cancelamentos: reservar o estoque na criação do pedido impediu a venda concorrente do último item em canais distintos, enquanto a rotina transacional de estorno garantiu que recusas do gateway ou cancelamentos devolvessem tanto os produtos quanto os pontos resgatados ou acumulados.

A organização em quatro camadas manteve o cálculo de descontos, a matriz de transição de status e as validações de domínio desacoplados de protocolo HTTP e banco de dados. Essa estrutura facilitou a substituição do adquirente real pela porta `PaymentGateway`, a aplicação consistente de consentimento e anonimização previstos na LGPD e a comprovação dos fluxos positivos e negativos pelas suítes automatizadas e pela coleção Postman.

---

## 9. Referências

- BRASIL. **Lei nº 13.709, de 14 de agosto de 2018**. Lei Geral de Proteção de Dados Pessoais (LGPD). Brasília, DF: Presidência da República, 2018.
- FOWLER, M. **UML Essencial: um breve guia para a linguagem-padrão de modelagem de objetos**. 3. ed. Porto Alegre: Bookman, 2005.
- NESTJS. **NestJS Documentation**. Disponível em: https://docs.nestjs.com. Acesso em: nov. 2026.
- OPENAPI INITIATIVE. **OpenAPI Specification v3.0**. Disponível em: https://spec.openapis.org/oas/latest.html. Acesso em: nov. 2026.
- PRESSMAN, R. S.; MAXIM, B. R. **Engenharia de Software: uma abordagem profissional**. 9. ed. Porto Alegre: AMGH, 2021.
- PRISMA. **Prisma ORM Documentation**. Disponível em: https://www.prisma.io/docs. Acesso em: nov. 2026.
- SOMMERVILLE, I. **Engenharia de Software**. 10. ed. São Paulo: Pearson Education do Brasil, 2018.
