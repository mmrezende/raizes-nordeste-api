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

O estudo de caso da rede de lanchonetes **Raízes do Nordeste** retrata um problema comum no varejo de alimentação em expansão: com a abertura de novas unidades e a venda simultânea por aplicativo, totem de autoatendimento, balcão, web e retirada rápida, os controles locais passam a gerar divergência de cardápio, venda de itens sem saldo na cozinha, aplicação incorreta de promoções e falta de rastreabilidade sobre dados de clientes no programa de fidelidade.

Para resolver esse cenário, este projeto implementa uma API REST centralizada em **NestJS, TypeScript e Prisma ORM (SQLite)**. O objetivo do serviço é unificar o catálogo de produtos, as campanhas promocionais e a pontuação de fidelidade na matriz, mantendo o saldo de estoque e a fila de preparo isolados por unidade física, com validação estrita do canal de origem, processamento de pagamento simulado e conformidade com a LGPD.

---

## 2. Análise e Requisitos

No levantamento funcional, o sistema foi dividido em cinco responsabilidades principais. A primeira é o controle de acesso por perfil (`CLIENTE`, `ATENDENTE`, `COZINHA`, `GERENTE` e `ADMIN`), onde funcionários operacionais ficam vinculados à sua loja e só manipulam pedidos ou estoques daquela unidade. A segunda é a separação entre o catálogo único da matriz e o estoque local, permitindo que a consulta pública de cardápio de uma loja exiba apenas itens ativos com saldo disponível naquele endereço.

A terceira frente trata do fluxo de pedidos multicanal. Todo pedido exige o campo `canalPedido` (`APP`, `TOTEM`, `BALCAO`, `PICKUP` ou `WEB`) na criação e permite filtragem na listagem. Os valores de subtotal, desconto promocional e resgate de pontos são calculados exclusivamente no servidor em centavos inteiros, evitando inconsistências de arredondamento ou manipulação pelo cliente. Na mesma transação em que o pedido nasce como `AGUARDANDO_PAGAMENTO`, os itens são reservados no estoque da loja escolhida.

Por fim, o pagamento é processado por um gateway simulado com chave de idempotência (`idempotencyKey`), evitando cobranças duplicadas em falhas de rede. Se aprovado, o pedido avança para `EM_PREPARO` e credita pontos de fidelidade (1 ponto a cada R$ 10,00 pagos, quando há consentimento ativo); se recusado ou cancelado antes da entrega, uma transação devolve o estoque e os pontos utilizados. Da mesma forma, caso um pedido já pago seja cancelado pela loja, os pontos gerados naquela compra são estornados.

| Escopo | O que foi priorizado | Motivação técnica |
|---|---|---|
| **Implementado (MVP)** | Autenticação JWT e perfis por loja, catálogo e estoque por unidade, pedido multicanal com reserva transacional, cupons, pagamento mock idempotente, fidelidade com consentimento, anonimização e auditoria. | Cobre de ponta a ponta os fluxos exigidos pelo estudo de caso em uma aplicação autocontida com banco SQLite local. |
| **Evolução (Fase 2)** | Integração com adquirente real via webhooks, fila em tempo real para a cozinha (WebSocket/SSE), revogação de tokens em Redis e migração para PostgreSQL. | O desacoplamento por interfaces na camada de aplicação permite substituir os adaptadores locais sem reescrever regras de negócio. |

---

## 3. Modelagem e Arquitetura

### 3.1 Casos de Uso e Fluxos Críticos

O diagrama de casos de uso delimita a fronteira da API e a interação com os seis atores do negócio (`Cliente`, `Atendente`, `Cozinha`, `Gerente`, `Administrador` e `Gateway de Pagamento Mock`).

![Diagrama de Casos de Uso](./docs/diagrams/img/use-cases.svg)

Dois fluxos concentram as regras críticas da operação:
- **Realizar Pedido e Solicitar Pagamento (`UC04` e `UC07`):** exige usuário autenticado e ativo, unidade e produtos ativos e saldo na loja. A criação reserva o estoque (`UC05`) e, opcionalmente, aplica cupom ou resgata pontos mediante consentimento ativo (`UC06`). Em seguida, o envio do pagamento valida a `idempotencyKey`: chamadas inéditas acionam o gateway simulado (aprovando para `EM_PREPARO` ou recusando para `PAGAMENTO_RECUSADO` com estorno imediato), enquanto retentativas com a mesma chave retornam `200 OK` com o resultado original.
- **Atualizar Status e Cancelar Pedido (`UC09`):** restringe cada etapa ao perfil responsável. A cozinha avança o pedido de `EM_PREPARO` para `PRONTO`, e o balcão finaliza de `PRONTO` para `ENTREGUE`. O cancelamento é permitido antes da entrega (para o próprio cliente, apenas enquanto o pedido ainda não entrou no estado `PRONTO`), executando a devolução atômica dos itens ao estoque e dos pontos à conta de fidelidade.

### 3.2 Modelo de Dados (DER)

O esquema relacional foi modelado em 12 tabelas com chaves primárias em formato UUIDv7, que preservam a ordenação temporal nos índices sem expor contadores sequenciais na API. A integridade do modelo apoia-se em chaves únicas compostas para garantir um único registro de saldo por produto em cada loja (`unidade_id, produto_id`) e evitar linhas repetidas no mesmo pedido (`pedido_id, produto_id`), além de unicidade em `pagamentos.idempotency_key`.

![Diagrama Entidade-Relacionamento](./docs/diagrams/img/der.svg)

### 3.3 Arquitetura em 4 Camadas

A aplicação organiza o código em quatro camadas com dependências direcionadas para dentro. A camada **Domain** (`src/domain`) concentra enums, exceções de negócio e funções puras de cálculo e transição de status, sem depender do NestJS ou do Prisma. A camada **Application** (`src/application`) coordena os casos de uso, valida escopo de unidade e define portas para serviços externos. A camada **Infrastructure** (`src/infrastructure`) implementa essas portas com Prisma, `bcryptjs`, JWT, gerador UUIDv7 e o gateway mock. Por último, a camada **API** (`src/api`) expõe os controllers REST, valida DTOs, aplica guards de autenticação/perfil, injeta `X-Request-Id`, intercepta eventos de auditoria e padroniza falhas no filtro global.

![Arquitetura em 4 Camadas](./docs/diagrams/img/architecture.svg)

### 3.4 Diagramas de Classes e de Sequência

O diagrama de classes detalha a estrutura das entidades, seus atributos tipados e os métodos que encapsulam as regras de domínio em cinco pacotes funcionais.

![Diagrama de Classes](./docs/diagrams/img/classes.svg)

O diagrama de sequência ilustra o comportamento dinâmico das duas operações mais sensíveis do sistema (`POST /pedidos` e `POST /pagamentos`), destacando os blocos alternativos de validação (`404`, `409`, `422`), a proteção de idempotência (`200 OK`) e o ponto exato em que as transações e a trilha de auditoria são gravadas no banco.

![Diagrama de Sequência - Pedido e Pagamento](./docs/diagrams/img/sequence-order-payment.svg)

---

## 4. API e Endpoints

A API segue o padrão REST com rotas no plural, paginação padronizada (`?page=1&limit=10`), cabeçalho de rastreamento `X-Request-Id` em todas as respostas e documentação OpenAPI interativa em `/docs`. Qualquer erro de validação, permissão ou regra de negócio retorna um envelope único contendo `error`, `message`, `details`, `timestamp`, `path` e `requestId`.

| Recurso | Rotas principais | Controle de acesso |
|---|---|---|
| **Saúde e Autenticação** | `GET /health`, `POST /auth/register`, `POST /auth/login` | Público |
| **Usuários** | `GET /usuarios/me`, `DELETE /usuarios/me` e `POST /usuarios` | Autenticado (próprio titular) / `ADMIN` e `GERENTE` (cadastro de equipe da loja) |
| **Unidades e Catálogo** | `GET /unidades`, `GET /unidades/:id/cardapio`, `GET /produtos`, `POST /unidades`, `POST /produtos` | Consultas públicas / cadastros restritos a `ADMIN` |
| **Estoque e Promoções** | `GET /unidades/:id/estoque`, `POST /estoque/movimentacoes`, `GET /promocoes`, `POST /promocoes` | Estoque restrito à loja ou `ADMIN`; listagem de promoções pública e criação por `ADMIN` |
| **Pedidos** | `POST /pedidos`, `GET /pedidos` (`?canalPedido=&status=&unidadeId=`), `GET /pedidos/:id`, `PATCH /pedidos/:id/status`, `POST /pedidos/:id/cancelar` | Autenticado com filtro automático por dono do pedido ou unidade de lotação |
| **Pagamentos** | `POST /pagamentos` (`idempotencyKey`, `formaPagamento`, `simularRecusa`) | Autenticado (cliente dono do pedido, equipe da loja ou `ADMIN`) |
| **Fidelidade e Auditoria** | `GET /fidelidade/conta`, `PATCH /fidelidade/consentimento`, `GET /fidelidade/movimentacoes`, `GET /auditoria` | Fidelidade para o titular autenticado; auditoria para `ADMIN` (rede) e `GERENTE` (própria loja) |

Abaixo estão os contratos JSON dos fluxos principais de autenticação, criação de pedido no totem com cupom e resgate de pontos, confirmação de pagamento e tratamento de conflito de estoque:

```json
// POST /auth/login -> 200 OK
// Request: { "email": "cliente@exemplo.com", "senha": "Senha@123" }
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

```json
// POST /pedidos -> 201 Created
// Request: { "unidadeId": "019c6199-df00-7000-8000-000000000101", "canalPedido": "TOTEM", "codigoPromocao": "TOTEM10", "pontosResgate": 5, "itens": [{ "produtoId": "019c6199-df00-7000-8000-000000000201", "quantidade": 2 }] }
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
// POST /pagamentos -> 201 Created (ou 200 OK quando a mesma idempotencyKey é reenviada)
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
// Resposta padronizada de erro -> 409 Conflict
{
  "error": "ESTOQUE_INSUFICIENTE",
  "message": "Estoque insuficiente na unidade selecionada.",
  "details": [{ "field": "itens", "issue": "Bolo de Rolo Tradicional: solicitado 5, disponível 2" }],
  "timestamp": "2026-02-15T14:00:00.000Z",
  "path": "/pedidos",
  "requestId": "019c6199-df00-7a00-8f41-9c2a1b3e4f99"
}
```

---

## 5. LGPD e Segurança

O tratamento de dados pessoais foi desenhado sob o princípio de minimização da Lei Geral de Proteção de Dados (Lei nº 13.709/2018): a API coleta apenas nome, e-mail e senha para identificação, sem armazenar CPF, endereço residencial ou dados de cartão de crédito. A participação no programa de fidelidade depende de consentimento explícito (`consentimentoAtivo`), que inicia desativado por padrão e pode ser concedido ou revogado a qualquer momento em `PATCH /fidelidade/consentimento`, registrando os carimbos de tempo correspondentes.

Para atender ao direito de eliminação sem quebrar a integridade contábil das vendas já realizadas, a rota `DELETE /usuarios/me` anonimiza o cadastro do titular: o nome e o e-mail são substituídos por valores genéricos, o hash de senha é descartado, o consentimento de fidelidade é revogado e o usuário é marcado como inativo. Como a estratégia JWT verifica o status ativo do titular a cada requisição, qualquer token emitido antes da anonimização passa a ser recusado imediatamente com `401 NAO_AUTENTICADO`. As senhas utilizam `bcryptjs` (custo 10) e são omitidas nas consultas do banco, enquanto os logs de auditoria registram apenas metadados operacionais filtrados por loja.

| Dados tratados | Finalidade no sistema | Base legal (Art. 7º da LGPD) |
|---|---|---|
| Nome, e-mail, hash de senha, perfil e unidade | Criação de conta, autenticação JWT e controle de acesso por loja | Execução de contrato (inciso V) e cumprimento de obrigação legal (inciso II) |
| Histórico de pedidos e retorno simulado de pagamento | Preparo dos itens na loja, baixa de estoque e conciliação financeira | Execução de contrato (inciso V) |
| Saldo de pontos e histórico de consentimento | Concessão de descontos e acúmulo no programa de fidelidade | Consentimento explícito do titular (inciso I) |
| Logs de auditoria (`usuarioId`, ação, entidade e `requestId`) | Rastreabilidade de alterações críticas e prevenção a fraudes | Legítimo interesse e segurança (inciso IX) |

---

## 6. Entrega Técnica e Execução

- **Repositório público (GitHub):** https://github.com/mmrezende/raizes-nordeste-api
- **Servidor local e Swagger:** `http://localhost:3000` e `http://localhost:3000/docs`
- **Coleção Postman:** [`test/postman/raizes-nordeste-api.postman_collection.json`](./test/postman/raizes-nordeste-api.postman_collection.json) (com [documentação complementar em `docs/`](./docs))
- **Ambiente:** **Node.js 24+ (LTS)** e `npm`. O arquivo `.env.example` define `NODE_ENV=development`, `PORT=3000`, `SWAGGER_PATH=docs`, `DATABASE_URL="file:./dev.db"`, `JWT_SECRET` e `JWT_EXPIRES_IN_SECONDS=3600`.

```bash
git clone https://github.com/mmrezende/raizes-nordeste-api.git
cd raizes-nordeste-api
cp .env.example .env
npm install
npm run prisma:generate && npx prisma migrate deploy && npm run prisma:seed
npm run start:dev
```

O script de seed popula as unidades de Recife (`REC-01`) e Fortaleza (`FOR-01`), o catálogo regional, os cupons `TOTEM10` e `RAIZES5`, e cinco contas de teste com a senha padrão `Senha@123`: `admin@raizes.com` (`ADMIN`), `gerente.rec@raizes.com` (`GERENTE`), `atendente.rec@raizes.com` (`ATENDENTE`), `cozinha.rec@raizes.com` (`COZINHA`) e `cliente@exemplo.com` (`CLIENTE`, com 20 pontos e consentimento ativo). O item *Bolo de Rolo Tradicional* inicia com saldo `2` em Recife especificamente para permitir a validação de erro de estoque insuficiente.

---

## 7. Plano de Testes

A verificação do projeto combina testes automatizados em Jest e cenários de aceitação no Postman. Para que a bateria automatizada não apague os dados demonstrativos do banco de desenvolvimento (`prisma/dev.db`), a suíte E2E executa em um arquivo SQLite separado (`prisma/test-e2e.db`). No total, o projeto conta com 7 suítes unitárias (34 testes) e 6 suítes E2E HTTP (35 testes), executadas com:

```bash
npm run lint && npm test && npm run test:e2e
```

Para validar manualmente no Postman, basta iniciar a API com o seed aplicado, importar a coleção JSON e executar as pastas de `1` a `7` em sequência. Os scripts da coleção encadeiam os tokens JWT e IDs gerados entre as requisições e aferem os status codes e contratos listados abaixo (9 cenários positivos e 7 negativos):

| ID | Cenário testado | Endpoint | Pré-condição e entrada resumida | Resultado esperado | Requisição na coleção Postman |
|---|---|---|---|---|---|
| `T01` | Login válido de cliente | `POST /auth/login` | Seed aplicado; credenciais de `cliente@exemplo.com` | `200 OK` com `accessToken` Bearer e `expiresIn: 3600` | `1. Auth / T01` |
| `T02` | Cardápio disponível da loja | `GET /unidades/{id}/cardapio` | Unidade `REC-01` com estoque positivo | `200 OK` com itens ativos e `quantidadeDisponivel` | `2. Unidades e Cardápio / T02` |
| `T03` | Rota protegida sem token | `GET /unidades/{id}/estoque` | Requisição sem cabeçalho `Authorization` | `401 Unauthorized` (`NAO_AUTENTICADO`) | `2. Unidades e Cardápio / T03` |
| `T04` | Pedido no totem com cupom e pontos | `POST /pedidos` | Token de cliente; `canalPedido: "TOTEM"`, cupom `TOTEM10` e 5 pontos | `201 Created` com `AGUARDANDO_PAGAMENTO` e total `4232` | `3. Pedidos e Multicanalidade / T04` |
| `T05` | Filtro de pedidos por canal | `GET /pedidos` | Query `?canalPedido=TOTEM&status=AGUARDANDO_PAGAMENTO` | `200 OK` contendo apenas pedidos do canal `TOTEM` | `3. Pedidos e Multicanalidade / T05` |
| `T06` | Pedido sem informar canal | `POST /pedidos` | Payload sem o campo obrigatório `canalPedido` | `422 Unprocessable Entity` (`ERRO_VALIDACAO`) | `3. Pedidos e Multicanalidade / T06` |
| `T07` | Item com quantidade negativa | `POST /pedidos` | Payload com `quantidade: -1` | `422 Unprocessable Entity` (`ERRO_VALIDACAO`) | `3. Pedidos e Multicanalidade / T07` |
| `T08` | Produto inexistente no pedido | `POST /pedidos` | `produtoId` não cadastrado no catálogo | `404 Not Found` (`PRODUTO_NAO_ENCONTRADO`) | `3. Pedidos e Multicanalidade / T08` |
| `T09` | Compra acima do saldo da loja | `POST /pedidos` | Solicitação de 5 unidades de *Bolo de Rolo* (saldo local igual a 2) | `409 Conflict` (`ESTOQUE_INSUFICIENTE`) | `3. Pedidos e Multicanalidade / T09` |
| `T10` | Pagamento aprovado e pontuação | `POST /pagamentos` | Pedido de `T04`, forma `PIX` e nova `idempotencyKey` | `201 Created` (`APROVADO`), `payloadRetorno` e pedido `EM_PREPARO` | `4. Pagamentos Mock / T10` |
| `T11` | Retentativa idempotente | `POST /pagamentos` | Reenvio da mesma `idempotencyKey` utilizada em `T10` | `200 OK` com o mesmo registro, sem nova cobrança nem log extra | `4. Pagamentos Mock / T11` |
| `T12` | Pagamento recusado com estorno | `POST /pagamentos` | Novo pedido `APP` com `simularRecusa: true` | `201 Created` (`RECUSADO`), pedido `PAGAMENTO_RECUSADO` e estoque devolvido | `4. Pagamentos Mock / T12` |
| `T13` | Alteração de status sem permissão | `PATCH /pedidos/{id}/status` | Cliente tentando avançar pedido para `PRONTO` | `403 Forbidden` (`ACESSO_NEGADO`) | `5. Ciclo de Status / T13` |
| `T14` | Cozinha conclui preparo | `PATCH /pedidos/{id}/status` | Token da cozinha de `REC-01` enviando `status: "PRONTO"` | `200 OK` com pedido atualizado para `PRONTO` | `5. Ciclo de Status / T14` |
| `T15` | Balcão confirma entrega | `PATCH /pedidos/{id}/status` | Token do atendente de `REC-01` enviando `status: "ENTREGUE"` | `200 OK` com pedido finalizado em `ENTREGUE` | `5. Ciclo de Status / T15` |
| `T16` | Auditoria filtrada por unidade | `GET /auditoria` | Token do gerente de `REC-01` consultando `?entidade=pedidos` | `200 OK` listando a trilha de eventos da unidade `REC-01` | `7. Auditoria / T16` |

---

## 8. Conclusão

O desenvolvimento da API da rede **Raízes do Nordeste** permitiu traduzir os problemas operacionais descritos no estudo de caso em regras transacionais concretas. O principal desafio técnico consistiu em coordenar o saldo de estoque por loja e a pontuação de fidelidade diante de falhas de pagamento ou cancelamentos: reservar o estoque na abertura do pedido evitou a venda simultânea do último item em canais distintos, enquanto o helper transacional de estorno garantiu que recusas do gateway ou cancelamentos devolvessem tanto os produtos quanto os pontos resgatados ou acumulados.

A divisão em quatro camadas manteve as fórmulas de desconto, as regras de transição de status e as validações de domínio isoladas de detalhes de protocolo HTTP e banco de dados. Essa organização simplificou a criação da porta `PaymentGateway` para o serviço de pagamento simulado, a aplicação uniforme de controles de privacidade da LGPD e a validação automatizada dos fluxos positivos e negativos por meio das suítes Jest e da coleção Postman.

---

## 9. Referências

- BRASIL. **Lei nº 13.709, de 14 de agosto de 2018**. Lei Geral de Proteção de Dados Pessoais (LGPD). Brasília, DF: Presidência da República, 2018.
- FOWLER, M. **UML Essencial: um breve guia para a linguagem-padrão de modelagem de objetos**. 3. ed. Porto Alegre: Bookman, 2005.
- NESTJS. **NestJS Documentation**. Disponível em: https://docs.nestjs.com. Acesso em: nov. 2026.
- OPENAPI INITIATIVE. **OpenAPI Specification v3.0**. Disponível em: https://spec.openapis.org/oas/latest.html. Acesso em: nov. 2026.
- PRESSMAN, R. S.; MAXIM, B. R. **Engenharia de Software: uma abordagem profissional**. 9. ed. Porto Alegre: AMGH, 2021.
- PRISMA. **Prisma ORM Documentation**. Disponível em: https://www.prisma.io/docs. Acesso em: nov. 2026.
- SOMMERVILLE, I. **Engenharia de Software**. 10. ed. São Paulo: Pearson Education do Brasil, 2018.
