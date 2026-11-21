# LGPD, Privacidade e Segurança — Rede "Raízes do Nordeste"

## 1. Minimização e Base Legal dos Dados Pessoais

O back-end coleta apenas os dados estritamente necessários para autenticação, processamento de pedidos multicanal e operação opcional do programa de fidelidade (sem coleta de CPF, endereço residencial completo ou dados de cartão de crédito):

| Entidade / Tabela | Dados Pessoais | Finalidade | Base Legal (Art. 7º LGPD) |
|---|---|---|---|
| `usuarios` | `nome`, `email`, `senhaHash`, `perfil`, `unidadeId` | Identificação da conta, autenticação JWT, autorização por perfil (RBAC) e vínculo de pedidos. | **Execução de contrato** (inciso V) e cumprimento de obrigação legal/auditável (inciso II). |
| `pedidos` | `clienteId`, `canalPedido`, itens e valores | Atendimento do pedido na unidade escolhida e rastreabilidade financeira/operacional. | **Execução de contrato** (inciso V). |
| `pagamentos` | `referenciaExterna`, `formaPagamento`, `payloadRetorno` (mock) | Confirmação/recusa de pagamento desacoplada sem armazenar dados sensíveis de cartão. | **Execução de contrato** (inciso V). |
| `contas_fidelidade` e `movimentacoes_fidelidade` | `saldoPontos`, `consentimentoAtivo`, `consentimentoEm`, `revogadoEm` | Acúmulo e resgate de pontos promocionais. | **Consentimento explícito do titular** (inciso I). |
| `logs_auditoria` | `usuarioId`, `acao`, `entidade`, `entidadeId`, `requestId`, `metadados` | Rastreabilidade de operações críticas e segurança. | **Legítimo interesse / prevenção à fraude e segurança** (inciso IX). |

---

## 2. Gestão de Consentimento Explícito (Programa de Fidelidade)

- No cadastro (`POST /auth/register`), o consentimento vem desativado (`consentimentoAtivo = false`) por padrão, salvo marcação explícita de `consentimentoFidelidade: true`.
- O titular pode conceder ou revogar o consentimento a qualquer momento via `PATCH /fidelidade/consentimento`, que registra timestamp em `consentimento_em` ou `revogado_em` e grava trilha em `logs_auditoria` (`FIDELIDADE_CONSENTIMENTO_ATUALIZADO`).
- Sem `consentimentoAtivo = true`, o pedido pago não acumula pontos e qualquer tentativa de resgate é bloqueada (`409 FIDELIDADE_SEM_CONSENTIMENTO`).

---

## 3. Retenção e Anonimização (`DELETE /usuarios/me`)

- O titular autenticado pode solicitar a eliminação/anonimização dos seus dados pessoais por `DELETE /usuarios/me`.
- Para manter a integridade referencial e fiscal dos pedidos já processados sem expor dados pessoais:
  - `nome` é substituído por `"Usuário Anonimizado"`;
  - `email` é substituído por `anonimizado-<usuarioId>@anon.local`;
  - `senhaHash` é substituído por hash aleatório inutilizado;
  - `ativo` passa para `false` e `anonimizado_em` recebe a data/hora da operação;
  - `contas_fidelidade.consentimento_ativo` é desativado com registro de `revogado_em`.
- Tentativas futuras de login com as credenciais originais são bloqueadas com `401 CREDENCIAIS_INVALIDAS`.

---

## 4. Controles Técnicos de Segurança

- **Armazenamento de senhas:** hash adaptativo via `bcryptjs` (custo 10); `senhaHash` nunca é retornado em DTOs de resposta, tokens JWT ou mensagens de erro.
- **Autenticação Stateless e Expiração:** tokens JWT assinados com segredo configurável (`JWT_SECRET`) e expiração em milissegundos (`JWT_EXPIRES_IN_MS`).
- **Controle de Acesso (RBAC + Escopo por Unidade):** guards globais (`JwtAuthGuard` e `RolesGuard`) exigem autenticação por padrão e restringem rotas aos perfis autorizados (`CLIENTE`, `ATENDENTE`, `COZINHA`, `GERENTE`, `ADMIN`). Funcionários de loja ficam restritos ao próprio `unidadeId`.
- **Auditoria Segura:** o `AuditInterceptor` persiste apenas metadados de allowlist (`method`, `path`, `status`, `canalPedido`, `perfil`, `unidadeId`, `tipo`), evitando gravar senhas, tokens ou payloads sensíveis nos logs, consultáveis por `GERENTE` e `ADMIN` em `GET /auditoria`.
- **Rastreabilidade e Padronização de Erros:** todas as requisições recebem `requestId` (`X-Request-Id`) e falhas passam pelo `GlobalExceptionFilter`, ocultando stack traces em produção (`500 ERRO_INTERNO`).
