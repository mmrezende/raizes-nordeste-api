# LGPD, Privacidade e Segurança - Rede "Raízes do Nordeste"

## 1. Minimização e Bases Legais

A API coleta apenas os dados necessários para autenticação, processamento de pedidos e adesão opcional ao programa de fidelidade, sem armazenar CPF, endereço residencial completo ou dados de cartão:

| Tabela | Dados Pessoais | Finalidade | Base Legal (Art. 7º LGPD) |
|---|---|---|---|
| `usuarios` | `nome`, `email`, `senhaHash`, `perfil`, `unidadeId` | Identificação da conta, autenticação JWT e controle de acesso | Execução de contrato (inciso V) e obrigação legal/auditável (inciso II) |
| `pedidos` | `clienteId`, `canalPedido`, itens e valores | Atendimento do pedido na loja e controle financeiro | Execução de contrato (inciso V) |
| `pagamentos` | `referenciaExterna`, `formaPagamento`, `payloadRetorno` | Registro do retorno simulado do gateway sem dados sensíveis de cartão | Execução de contrato (inciso V) |
| `contas_fidelidade`, `movimentacoes_fidelidade` | `saldoPontos`, `consentimentoAtivo`, `consentimentoEm`, `revogadoEm` | Acúmulo e resgate promocional de pontos | Consentimento do titular (inciso I) |
| `logs_auditoria` | `usuarioId`, `acao`, `entidade`, `entidadeId`, `requestId`, `metadados` | Rastreabilidade de operações críticas | Legítimo interesse e segurança (inciso IX) |

## 2. Gestão de Consentimento (Fidelidade)

- No cadastro (`POST /auth/register`), o consentimento inicia como `false`, exceto se o cliente enviar `consentimentoFidelidade: true`.
- O titular pode conceder ou revogar o consentimento a qualquer momento em `PATCH /fidelidade/consentimento`, gravando timestamp em `consentimento_em` ou `revogado_em` e registrando `FIDELIDADE_CONSENTIMENTO_ATUALIZADO` na auditoria.
- Sem `consentimentoAtivo = true`, compras aprovadas não acumulam pontos e tentativas de resgate são bloqueadas com `409 FIDELIDADE_SEM_CONSENTIMENTO`.

## 3. Anonimização do Titular (`DELETE /usuarios/me`)

O titular autenticado pode solicitar a anonimização dos seus dados preservando os registros financeiros e operacionais de `pedidos`:

- `nome` passa a `"Usuário Anonimizado"`;
- `email` passa a `anonimizado-<usuarioId>@anon.local`;
- `senhaHash` é substituído por um hash aleatório descartado;
- `ativo` é alterado para `false` e `anonimizado_em` recebe a data/hora da operação;
- `contas_fidelidade.consentimento_ativo` é desativado com registro de `revogado_em`.

Após a anonimização, tentativas de login retornam `401 CREDENCIAIS_INVALIDAS` e requisições autenticadas com token ainda não expirado são bloqueadas na validação do usuário ativo (`401 NAO_AUTENTICADO`).

## 4. Controles de Segurança Aplicados

- **Senhas:** hash `bcryptjs` com custo 10; `senhaHash` é excluído explicitamente via `USUARIO_SEGURO_SELECT` e nunca aparece em respostas ou tokens.
- **Autenticação e RBAC:** `JwtAuthGuard` e `RolesGuard` globais protegem todas as rotas por padrão (liberando apenas rotas marcadas com `@Public()`), com validação adicional de escopo por `unidadeId` e propriedade do pedido na camada de aplicação.
- **Auditoria:** `AuditInterceptor` grava apenas metadados da allowlist (`method`, `path`, `status`, `canalPedido`, `perfil`, `unidadeId`, `tipo`), evitando registrar senhas, tokens ou payloads completos. A consulta (`GET /auditoria`) é restrita a `ADMIN` (visão da rede) e `GERENTE` (filtrado apenas para os eventos da própria unidade).
- **Rastreabilidade e erros:** toda requisição recebe `X-Request-Id` em formato UUIDv7 e exceções passam pelo `GlobalExceptionFilter`, ocultando stack traces em falhas internas (`500 ERRO_INTERNO`).
