# Casos de Uso e Fluxos Críticos — Rede "Raízes do Nordeste"

Diagrama UML correspondente: [`docs/diagrams/use-cases.puml`](../diagrams/use-cases.puml).

---

## 1. Atores do Sistema

| Ator | Papel no Sistema |
|---|---|
| **Cliente (App / Web / Totem)** | Realiza cadastro, autenticação, consulta cardápio por unidade, cria e acompanha pedidos, gerencia consentimento LGPD e utiliza pontos de fidelidade. |
| **Atendente (Balcão)** | Lança pedidos presenciais (`BALCAO`) da sua unidade, confirma entrega (`PRONTO → ENTREGUE`) ou cancelamento antes da entrega. |
| **Cozinha** | Acompanha a fila de preparo da sua unidade e avança pedidos pagos (`EM_PREPARO → PRONTO`). |
| **Gerente / Administrador** | Gerencia unidades, produtos e promoções (`ADMIN` na rede), movimenta estoque da unidade (`GERENTE`/`ADMIN`), consulta pedidos por canal e audita logs. |
| **Gateway de Pagamento (Mock)** | Ator externo simulado que processa solicitações de pagamento e devolve aprovação ou recusa com payload estruturado. |

---

## 2. Catálogo de Casos de Uso

| ID | Caso de Uso | Atores | Módulo |
|---|---|---|---|
| **UC01** | Cadastrar Cliente | Cliente | Usuarios / LGPD |
| **UC02** | Autenticar Usuário (JWT) | Cliente, Atendente, Cozinha, Gerente/Admin | Auth |
| **UC03** | Consultar Unidades e Cardápio por Unidade | Cliente, Atendente | Unidades / Produtos |
| **UC04** | Realizar Pedido (Multicanal) | Cliente, Atendente | Pedidos |
| **UC05** | Validar e Reservar Estoque da Unidade | *(incluído por UC04)* | Estoque |
| **UC06** | Aplicar Promoção / Resgatar Fidelidade | *(estende UC04)* | Promoções / Fidelidade |
| **UC07** | Solicitar Pagamento (Mock) | *(incluído por UC04)*, Gateway Mock | Pagamentos |
| **UC08** | Consultar Pedidos e Filtros por Canal | Cliente, Atendente, Gerente/Admin | Pedidos |
| **UC09** | Atualizar Status / Cancelar Pedido | Cliente, Atendente, Cozinha, Gerente/Admin | Pedidos |
| **UC10** | Consultar Fila de Preparo da Unidade | Cozinha | Pedidos |
| **UC11** | Gerenciar Unidades, Cardápio e Promoções | Gerente / Admin | Unidades / Produtos / Promoções |
| **UC12** | Movimentar e Consultar Estoque | Gerente / Admin | Estoque |
| **UC13** | Gerenciar Fidelidade e Consentimento LGPD | Cliente | Fidelidade / LGPD |
| **UC14** | Consultar Logs de Auditoria | Gerente / Admin | Auditoria |

---

## 3. Especificação das Features Críticas

### Feature Crítica 1: `UC04` Realizar Pedido + `UC07` Solicitar Pagamento (Mock)

- **Descrição:** Criação de pedido multicanal com validação/reserva atômica de estoque por unidade, aplicação opcional de cupom promocional e pontos de fidelidade, seguida da cobrança via gateway simulado.
- **Ator principal:** Cliente (`APP`, `TOTEM`, `WEB`, `PICKUP`) ou Atendente (`BALCAO`).
- **Demais atores:** Gateway de Pagamento (Mock).
- **Pré-condições:**
  1. Usuário autenticado com token JWT válido (`CLIENTE` ou `ATENDENTE` vinculado à unidade).
  2. Unidade ativa, produtos ativos e saldo de estoque disponível na unidade selecionada.
  3. Caso utilize pontos de fidelidade, conta com `consentimentoAtivo = true` e saldo suficiente.
- **Pós-condições:**
  - *Cenário aprovado:* pedido atualizado para `EM_PREPARO`, pagamento salvo como `APROVADO`, estoque mantido abatido, pontos resgatados debitados (se usados), novos pontos creditados (`ACUMULO`) e ação registrada em `logs_auditoria`.
  - *Cenário recusado:* pagamento salvo como `RECUSADO`, pedido atualizado para `PAGAMENTO_RECUSADO`, estoque e pontos eventualmente resgatados estornados (`ESTORNO`) e ação registrada em `logs_auditoria`.
- **Fluxo principal:**
  1. Cliente/Atendente envia `POST /pedidos` informando `unidadeId`, `canalPedido`, `itens` e, opcionalmente, `codigoPromocao` e `pontosResgate`.
  2. API valida formato dos campos obrigatórios e `canalPedido` válido dentro do enum.
  3. Aplicação verifica existência da unidade e dos produtos ativos.
  4. Dentro de uma transação única de banco:
     - Verifica e abate `quantidadeDisponivel` em `estoque_unidades` para cada item (`RESERVA` em `movimentacoes_estoque`).
     - Valida cupom promocional (se informado) e calcula `descontoPromocaoCentavos`.
     - Valida consentimento/saldo de fidelidade (se `pontosResgate > 0`), abate o saldo e grava `RESGATE`.
     - Calcula `subtotalCentavos` e `valorTotalCentavos` e persiste `pedidos` (`AGUARDANDO_PAGAMENTO`) + `itens_pedido` + log `PEDIDO_CRIADO`.
  5. Cliente/Atendente aciona `POST /pagamentos` com `pedidoId`, `formaPagamento` e `idempotencyKey`.
  6. API verifica se `idempotencyKey` já foi processada; caso negativo, chama o `PaymentGateway` (mock).
  7. Gateway mock retorna `APROVADO` com `referenciaExterna` e payload simulado.
  8. Transação persiste o registro em `pagamentos`, altera o pedido para `EM_PREPARO`, credita pontos de fidelidade (`floor(valorTotalCentavos / 1000)` se consentimento ativo) e o `AuditInterceptor` grava `PAGAMENTO_PROCESSADO` em `logs_auditoria`.
- **Fluxos alternativos e exceções:**
  - **401 / 403:** token ausente/inválido ou perfil sem permissão (ex.: Cozinha tentando criar pedido, ou Atendente criando pedido em outra unidade).
  - **422 Unprocessable Entity:** `canalPedido` ausente/inválido, lista de itens vazia, quantidade `<= 0` ou cupom inválido/expirado/abaixo do valor mínimo.
  - **404 Not Found:** `unidadeId`, `produtoId` ou `pedidoId` inexistente.
  - **409 Conflict:** estoque insuficiente na unidade para um ou mais itens (`ESTOQUE_INSUFICIENTE`), saldo de pontos insuficiente ou pedido em status incompatível com pagamento.
  - **Idempotência no pagamento:** repetição de `POST /pagamentos` com a mesma `idempotencyKey` devolve o pagamento já persistido sem gerar nova cobrança ou pontuação duplicada.
  - **Pagamento recusado pelo mock:** gateway retorna `RECUSADO`; transação grava o pagamento, muda o pedido para `PAGAMENTO_RECUSADO`, devolve os itens ao estoque (`ESTORNO`), devolve os pontos resgatados (`ESTORNO`) e audita o evento.
- **Regras de negócio aplicadas:** `RN01` (canal obrigatório), `RN02` (estoque isolado por loja), `RN03` (reserva + estorno), `RN04` (preço congelado e centavos), `RN05` (idempotência) e `RN06` (fidelidade com consentimento).

---

### Feature Crítica 2: `UC09` Atualizar Status / Cancelar Pedido

- **Descrição:** Avanço operacional do pedido na loja ou cancelamento controlado antes da entrega.
- **Ator principal:** Cozinha, Atendente, Cliente ou Gerente/Admin.
- **Pré-condições:** Usuário autenticado; pedido existente; funcionário pertencente à mesma `unidadeId` do pedido (ou `CLIENTE` dono do pedido no cancelamento, ou `ADMIN`).
- **Pós-condições:** Novo status persistido no pedido; em caso de cancelamento, estoque e pontos resgatados são devolvidos (`ESTORNO`) e evento registrado em `logs_auditoria`.
- **Fluxo principal:**
  1. Usuário envia `PATCH /pedidos/{id}/status` (ou `POST /pedidos/{id}/cancelar`).
  2. API valida se a transição solicitada é permitida para o perfil e para o status atual:
     - `COZINHA`: `EM_PREPARO → PRONTO`.
     - `ATENDENTE`: `PRONTO → ENTREGUE`.
     - `CLIENTE` (dono, antes de `ENTREGUE`), `ATENDENTE`, `GERENTE` ou `ADMIN`: `* → CANCELADO` (exceto se já `ENTREGUE` ou `CANCELADO`).
  3. Transação atualiza `pedidos.status`, executa estorno de estoque/pontos quando for cancelamento e grava `PEDIDO_STATUS_ATUALIZADO` / `PEDIDO_CANCELADO` em `logs_auditoria`.
- **Fluxos alternativos e exceções:**
  - **403 Forbidden:** perfil não autorizado para a transição (ex.: Cliente tentando marcar pedido como `PRONTO`) ou funcionário de outra unidade.
  - **404 Not Found:** pedido inexistente.
  - **409 Conflict:** transição inválida (ex.: tentar entregar pedido `AGUARDANDO_PAGAMENTO` ou cancelar pedido já `ENTREGUE`).
