# Casos de Uso e Fluxos Críticos - Rede "Raízes do Nordeste"

Diagrama UML: [`docs/diagrams/use-cases.puml`](../diagrams/use-cases.puml).

## 1. Atores do Sistema

| Ator | Papel |
|---|---|
| Cliente (`APP` / `WEB` / `TOTEM` / `PICKUP`) | Cadastra-se, autentica, consulta cardápio por loja, cria e acompanha pedidos, gerencia consentimento de fidelidade e resgata pontos. |
| Atendente (`BALCAO`) | Registra pedidos presenciais da sua unidade, confirma entrega (`PRONTO` -> `ENTREGUE`) e cancela pedidos antes da entrega. |
| Cozinha | Acompanha pedidos pagos da sua unidade e marca como prontos (`EM_PREPARO` -> `PRONTO`). |
| Gerente / Administrador | `ADMIN` gerencia unidades, produtos e promoções na rede; `GERENTE` opera estoque e auditoria na própria unidade. |
| Gateway de Pagamento (Mock) | Serviço simulado que processa cobranças e devolve aprovação ou recusa determinística. |

## 2. Catálogo de Casos de Uso

| ID | Caso de Uso | Atores | Módulo |
|---|---|---|---|
| `UC01` | Cadastrar Cliente | Cliente | Auth / Usuários |
| `UC02` | Autenticar Usuário (JWT) | Todos os perfis | Auth |
| `UC03` | Consultar Unidades e Cardápio por Unidade | Cliente, Atendente | Unidades / Produtos |
| `UC04` | Realizar Pedido (Multicanal) | Cliente, Atendente, Gerente, Admin | Pedidos |
| `UC05` | Validar e Reservar Estoque da Unidade | *(incluído por UC04)* | Estoque |
| `UC06` | Aplicar Promoção / Resgatar Fidelidade | *(estende UC04)* | Promoções / Fidelidade |
| `UC07` | Solicitar Pagamento (Mock) | *(incluído por UC04)*, Gateway Mock | Pagamentos |
| `UC08` | Consultar Pedidos e Filtros por Canal | Cliente, Equipe da loja, Admin | Pedidos |
| `UC09` | Atualizar Status / Cancelar Pedido | Cliente, Atendente, Cozinha, Gerente, Admin | Pedidos |
| `UC10` | Consultar Fila de Preparo da Unidade | Cozinha | Pedidos |
| `UC11` | Gerenciar Unidades, Cardápio e Promoções | Admin | Unidades / Produtos / Promoções |
| `UC12` | Movimentar e Consultar Estoque | Gerente, Admin | Estoque |
| `UC13` | Gerenciar Fidelidade e Consentimento LGPD | Cliente | Fidelidade / Usuários |
| `UC14` | Consultar Logs de Auditoria | Gerente, Admin | Auditoria |

## 3. Fluxos Críticos

### Feature 1: `UC04` Realizar Pedido + `UC07` Solicitar Pagamento (Mock)

- **Ator principal:** Cliente ou Atendente/Gerente (`BALCAO`).
- **Demais atores:** Gateway de Pagamento (Mock).
- **Pré-condições:**
  1. Usuário autenticado e ativo (não anonimizado).
  2. Unidade ativa, produtos ativos e saldo disponível na unidade selecionada.
  3. Para resgate de pontos, conta com `consentimentoAtivo = true` e saldo suficiente.
- **Pós-condições:**
  - *Aprovado:* pagamento salvo como `APROVADO`, pedido em `EM_PREPARO`, estoque mantido abatido, pontos acumulados (se consentimento ativo) e eventos `PEDIDO_CRIADO` / `PAGAMENTO_PROCESSADO` gravados pelo `AuditInterceptor` após o commit.
  - *Recusado:* pagamento salvo como `RECUSADO`, pedido em `PAGAMENTO_RECUSADO`, estoque e pontos resgatados devolvidos (`ESTORNO`) e evento auditado.
- **Fluxo principal:**
  1. Usuário envia `POST /pedidos` com `unidadeId`, `canalPedido`, `itens` e, opcionalmente, `codigoPromocao` e `pontosResgate`.
  2. A API valida o DTO (incluindo `canalPedido`), verifica unidade ativa, produtos ativos, usuário ativo e calcula descontos no servidor.
  3. Em transação única: cria pedido (`AGUARDANDO_PAGAMENTO`) e itens, abate `quantidadeDisponivel` em `estoque_unidades` (`RESERVA`), e debita pontos resgatados (`RESGATE`).
  4. Após resposta `201`, o `AuditInterceptor` grava `PEDIDO_CRIADO` em `logs_auditoria`.
  5. Usuário envia `POST /pagamentos` com `pedidoId`, `formaPagamento` e `idempotencyKey`.
  6. O serviço verifica se `idempotencyKey` já existe. Caso não exista, chama `PaymentGateway.processar`.
  7. Em transação única: persiste o pagamento, muda o pedido para `EM_PREPARO` e credita pontos (`floor(valorTotalCentavos / 1000)` se consentimento ativo).
  8. O `AuditInterceptor` grava `PAGAMENTO_PROCESSADO` em `logs_auditoria` quando o status HTTP for `201`.
- **Exceções e fluxos alternativos:**
  - `401` / `403`: token ausente/inválido, `COZINHA` tentando criar pedido ou funcionário operando em outra unidade.
  - `404`: unidade, produto, cliente (inclusive anonimizado) ou pedido inexistente.
  - `422`: `canalPedido` ausente/inválido, itens vazios, quantidade menor que `1` ou cupom inelegível.
  - `409`: estoque insuficiente (`ESTOQUE_INSUFICIENTE`), ausência de consentimento (`FIDELIDADE_SEM_CONSENTIMENTO`), saldo de pontos insuficiente, pedido fora de `AGUARDANDO_PAGAMENTO` ou `idempotencyKey` já usada em outro pedido.
  - *Idempotência:* repetição de `POST /pagamentos` com a mesma `idempotencyKey` para o mesmo pedido devolve `200 OK` com o pagamento original e o `AuditInterceptor` ignora o registro para não duplicar log.
  - *Recusa simulada:* se `simularRecusa = true`, grava `RECUSADO`, muda o pedido para `PAGAMENTO_RECUSADO` e estorna estoque e pontos na mesma transação.

### Feature 2: `UC09` Atualizar Status / Cancelar Pedido

- **Ator principal:** Cozinha, Atendente, Cliente, Gerente ou Admin.
- **Pré-condições:** usuário autenticado, pedido existente e pertencente ao escopo do solicitante (dono no cancelamento, funcionário da mesma unidade ou `ADMIN`).
- **Fluxo principal:**
  1. Usuário chama `PATCH /pedidos/:id/status` (com `PRONTO` ou `ENTREGUE`) ou `POST /pedidos/:id/cancelar`.
  2. A API valida o escopo e a regra de transição: `COZINHA`/`GERENTE`/`ADMIN` avançam `EM_PREPARO` -> `PRONTO`; `ATENDENTE`/`GERENTE`/`ADMIN` avançam `PRONTO` -> `ENTREGUE`; dono do pedido, `ATENDENTE`, `GERENTE` ou `ADMIN` cancelam antes de `ENTREGUE`.
  3. No cancelamento, uma transação marca `CANCELADO` e devolve estoque e pontos resgatados (`ESTORNO`).
  4. Após a conclusão, o `AuditInterceptor` grava `PEDIDO_STATUS_ATUALIZADO` ou `PEDIDO_CANCELADO`.
- **Exceções:**
  - `403`: perfil sem permissão para a transição ou pedido de outro cliente/unidade.
  - `404`: pedido não encontrado.
  - `409`: transição inválida (`TRANSICAO_STATUS_INVALIDA`) ou cancelamento após `ENTREGUE`, `PAGAMENTO_RECUSADO` ou `CANCELADO` (`PEDIDO_NAO_CANCELAVEL`).
  - `422`: status de destino fora de `[PRONTO, ENTREGUE]` em `PATCH /pedidos/:id/status`.
