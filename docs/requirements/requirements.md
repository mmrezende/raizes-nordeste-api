# Análise e Requisitos — Rede "Raízes do Nordeste"

## 1. Contexto e Objetivo do Back-end

A rede **Raízes do Nordeste** opera no modelo de **matriz e múltiplas lojas (unidades)**. A matriz define o cardápio base, promoções, perfis de acesso e regras de auditoria, enquanto cada unidade controla seu próprio estoque e fila de preparo.

A API REST unifica o recebimento de pedidos dos cinco canais da rede (**App**, **Totem**, **Balcão**, **Pickup** e **Web**), garantindo rastreabilidade por `canalPedido`, controle de estoque por loja sem venda duplicada em horários de pico, pagamento simulado desacoplado, fidelização com consentimento LGPD e trilha de auditoria.

---

## 2. Requisitos Funcionais (por módulo)

### Auth e Perfis (RBAC)
- Cadastro e login de usuários com emissão de token JWT.
- Controle de acesso por perfil: `CLIENTE`, `ATENDENTE`, `COZINHA`, `GERENTE` e `ADMIN`.
- Funcionários de loja (`ATENDENTE`, `COZINHA`, `GERENTE`) ficam vinculados a uma unidade específica (`unidadeId`) e operam restritos a ela; `CLIENTE` e `ADMIN` ficam com `unidadeId = null`.

### Unidades, Cardápio e Estoque
- Cadastro, edição e listagem paginada das unidades da rede (código único, endereço e status ativo/inativo).
- CRUD de produtos na matriz com preço único padronizado para toda a rede (`precoCentavos`) e consulta paginada de cardápio por unidade exibindo a disponibilidade e o saldo da loja.
- Movimentação de estoque por `(unidadeId, produtoId)` com tipos `ENTRADA`, `SAIDA`, `RESERVA` e `ESTORNO`, consulta de saldo por loja e bloqueio de pedido quando não houver saldo (`409`).

### Pedidos e Multicanalidade
- Criação de pedido vinculado à unidade e ao cliente, exigindo `canalPedido` (`APP`, `TOTEM`, `BALCAO`, `PICKUP`, `WEB` — erro `422` se ausente ou inválido).
- Cálculo de subtotal, desconto e total exclusivamente no servidor.
- Listagem paginada de pedidos com filtros combináveis por canal, status e unidade (ex.: `GET /pedidos?canalPedido=TOTEM&status=AGUARDANDO_PAGAMENTO`).
- Controle de ciclo de vida por perfil: `AGUARDANDO_PAGAMENTO` → `EM_PREPARO` (após pagamento aprovado) → `PRONTO` (Cozinha) → `ENTREGUE` (Atendente), além de `PAGAMENTO_RECUSADO` e `CANCELADO` (com devolução automática do estoque).

### Promoções e Campanhas
- Cadastro e aplicação de cupons/campanhas por `codigo` único (`PERCENTUAL` ou `VALOR_FIXO`), validando vigência, status ativo, valor mínimo de pedido e restrições opcionais por `canalPedido` e/ou `unidadeId`.

### Pagamento Simulado (Mock)
- Envio do pagamento para um gateway mock desacoplado, com registro de status (`PENDENTE`, `APROVADO`, `RECUSADO`), referência externa simulada e payload de retorno.
- Suporte a chave de idempotência (`idempotencyKey`) para evitar cobranças ou estornos duplicados em retentativas.

### Fidelidade e Privacidade (LGPD)
- Adesão e revogação explícita de consentimento para o programa de fidelidade com registro de data/hora.
- Acúmulo automático após pagamento aprovado (`1 ponto` a cada `R$ 10,00` pagos no valor final) e resgate aplicado diretamente como desconto em um pedido futuro (`POST /pedidos`, `1 ponto = R$ 0,50`), mantendo saldo consolidado e histórico de movimentações atualizados juntos (com estorno de pontos caso o pedido seja cancelado ou recusado).
- Consulta/atualização de dados mínimos pelo próprio titular e fluxo de anonimização sem quebrar o histórico financeiro e operacional dos pedidos já realizados.

### Auditoria
- Registro persistido e consultável (`GERENTE` e `ADMIN`) de ações sensíveis: criação/cancelamento de pedidos, trocas de status, movimentações de estoque, pagamentos e eventos de consentimento/anonimização LGPD.

---

## 3. Regras de Negócio Principais

- **RN01 — Canal obrigatório:** nenhum pedido pode ser criado sem um `canalPedido` válido dentro do enum da rede (`422`).
- **RN02 — Estoque por loja:** a validação e a baixa ocorrem sempre no estoque da unidade escolhida no pedido; nunca se consome saldo de outra loja.
- **RN03 — Reserva e reversão de estoque:** ao criar o pedido, o estoque é abatido na mesma operação de banco (`RESERVA`). Se o pagamento for recusado ou o pedido for cancelado antes da entrega, os itens retornam ao estoque (`ESTORNO`).
- **RN04 — Preço congelado e promoções:** cada item do pedido grava o preço unitário vigente no momento da compra; promoções ativas são validadas antes do cálculo final, com valores persistidos em centavos (`Int`).
- **RN05 — Idempotência no pagamento:** chamadas repetidas com a mesma `idempotencyKey` devolvem o resultado já processado sem alterar saldo ou pedido novamente.
- **RN06 — Fidelidade sob consentimento e resgate futuro:** acúmulo e resgate de pontos dependem de consentimento ativo; pontos só podem ser usados como desconto em compras futuras (em `POST /pedidos`), e saldo/histórico são atualizados juntos na mesma operação de banco (com `ESTORNO` em cancelamento ou recusa).

---

## 4. Requisitos Não Funcionais

- **Segurança e acesso:** senhas com hash (`bcryptjs`), autenticação stateless via JWT, guards RBAC por rota e omissão de `senhaHash` ou campos sensíveis nas respostas e logs.
- **LGPD (mínimo técnico):** coleta apenas de dados necessários, separação clara de base legal (execução de contrato nos pedidos; consentimento explícito na fidelidade), registro de consentimento com timestamp, trilha de auditoria e anonimização do titular.
- **Consistência sob carga:** criação de pedido e abate de estoque executam na mesma transação do banco; listagens usam paginação (`?page=1&limit=10`) e chaves primárias **UUIDv7** ordenadas por tempo.
- **Tolerância a falhas na integração:** gateway de pagamento isolado por interface na camada de aplicação, tratando recusa ou retentativa de forma previsível sem deixar estoque preso.
- **Contrato REST e erros:** endpoints no plural, IDs no path, status codes coerentes (`200`, `201`, `204`, `401`, `403`, `404`, `409`, `422`) e formato único de erro JSON com `requestId`.
- **Documentação e execução local:** Swagger/OpenAPI (`/docs`) refletindo os contratos implementados + SQLite local com migrations e seed reproduzíveis.
- **Estrutura em 4 camadas:** separação explícita entre `Domain`, `Application`, `Infrastructure` e `API`.

---

## 5. Escopo: Implementado vs. Planejado (Fase 2)

| Escopo | O que entra | Por quê |
|---|---|---|
| **Implementado (MVP completo)** | Auth/RBAC, Unidades, Produtos, Estoque por unidade, Pedidos com `canalPedido`, Promoções, Ciclo de status, Pagamento Mock idempotente, Fidelidade (saldo + histórico + LGPD) e Auditoria. | Fecha ponta a ponta o fluxo crítico de venda multicanal, inclui promoções reais no cálculo e roda 100% local com persistência em SQLite sem exigir infra externa na avaliação. |
| **Planejado (Fase 2)** | Gateway real (Pix/cartão com webhooks), notificações assíncronas (e-mail/push/WebSocket para cozinha), revogação de JWT em Redis, PostgreSQL em produção, telemetria distribuída e combos/promoções empilháveis. | A separação por portas e adapters permite trocar banco, mensageria e provedor de pagamento sem mexer nas regras de negócio ou nos contratos REST. |

---

## 6. Decisões Técnicas e Trade-offs

| Decisão | Escolha | Motivo prático |
|---|---|---|
| **Framework** | NestJS + TypeScript (4 camadas) | Injeção de dependência, validação tipada e Swagger integrado sem o boilerplate de Java/Spring, mantendo o domínio desacoplado do HTTP e do ORM. |
| **Banco e ORM** | SQLite + Prisma 6 | Relacional completo (PKs, FKs, constraints únicas e transações) em arquivo local, facilitando a correção sem Docker; migra para PostgreSQL mudando basicamente `provider` e `DATABASE_URL`. |
| **Identificadores** | **UUIDv7** centralizado | Mantém ordenação cronológica nos índices do banco (ao contrário do UUIDv4 aleatório), evita enumeração sequencial de IDs na URL (`/pedidos/:id`) e tira a geração de ID da dependência do banco. |
| **Valores monetários** | Inteiro em centavos (`Int`) | Evita erros de arredondamento de ponto flutuante no SQLite; convertido para decimal apenas nos DTOs da API. |
| **Estoque** | Abate na criação + estorno após resultado | Evita vender o último item duas vezes em horários de pico sem deixar estoque bloqueado caso o pagamento seja recusado. |
| **Fidelidade** | Saldo na conta + tabela de histórico | Permite consultar o saldo direto sem somar todo o histórico a cada requisição, mantendo rastreabilidade completa das movimentações atualizadas na mesma transação. |
| **Escopo operacional** | Vínculo `unidadeId` para equipe + preço único na matriz | Garante que atendente, cozinha e gerente só alterem pedidos/estoque da própria loja sem duplicar tabelas de preço por unidade. |
