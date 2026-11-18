-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidade_id" TEXT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" TEXT NOT NULL DEFAULT 'CLIENTE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "anonimizado_em" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "usuarios_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT NOT NULL,
    "preco_centavos" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "estoque_unidades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidade_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "quantidade_disponivel" INTEGER NOT NULL DEFAULT 0,
    "disponivel_venda" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "estoque_unidades_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "estoque_unidades_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "promocoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidade_id" TEXT,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo_desconto" TEXT NOT NULL,
    "valor_desconto" INTEGER NOT NULL,
    "valor_minimo_centavos" INTEGER NOT NULL DEFAULT 0,
    "canal_aplicavel" TEXT,
    "inicio_em" DATETIME NOT NULL,
    "fim_em" DATETIME NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "promocoes_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidade_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "promocao_id" TEXT,
    "canal_pedido" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "subtotal_centavos" INTEGER NOT NULL,
    "desconto_promocao_centavos" INTEGER NOT NULL DEFAULT 0,
    "pontos_utilizados" INTEGER NOT NULL DEFAULT 0,
    "desconto_fidelidade_centavos" INTEGER NOT NULL DEFAULT 0,
    "valor_total_centavos" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pedidos_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_promocao_id_fkey" FOREIGN KEY ("promocao_id") REFERENCES "promocoes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedido_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario_centavos" INTEGER NOT NULL,
    "subtotal_centavos" INTEGER NOT NULL,
    CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estoque_unidade_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "tipo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "motivo" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimentacoes_estoque_estoque_unidade_id_fkey" FOREIGN KEY ("estoque_unidade_id") REFERENCES "estoque_unidades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimentacoes_estoque_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimentacoes_estoque_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedido_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "valor_centavos" INTEGER NOT NULL,
    "referencia_externa" TEXT,
    "payload_retorno" TEXT,
    "processado_em" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pagamentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contas_fidelidade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT NOT NULL,
    "saldo_pontos" INTEGER NOT NULL DEFAULT 0,
    "consentimento_ativo" BOOLEAN NOT NULL DEFAULT false,
    "consentimento_em" DATETIME,
    "revogado_em" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "contas_fidelidade_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movimentacoes_fidelidade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conta_fidelidade_id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "tipo" TEXT NOT NULL,
    "pontos" INTEGER NOT NULL,
    "descricao" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimentacoes_fidelidade_conta_fidelidade_id_fkey" FOREIGN KEY ("conta_fidelidade_id") REFERENCES "contas_fidelidade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "movimentacoes_fidelidade_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "metadados" TEXT,
    "request_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logs_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_codigo_key" ON "unidades"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_unidade_id_idx" ON "usuarios"("unidade_id");

-- CreateIndex
CREATE INDEX "produtos_categoria_ativo_idx" ON "produtos"("categoria", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_unidades_unidade_id_produto_id_key" ON "estoque_unidades"("unidade_id", "produto_id");

-- CreateIndex
CREATE UNIQUE INDEX "promocoes_codigo_key" ON "promocoes"("codigo");

-- CreateIndex
CREATE INDEX "pedidos_unidade_id_status_idx" ON "pedidos"("unidade_id", "status");

-- CreateIndex
CREATE INDEX "pedidos_canal_pedido_status_idx" ON "pedidos"("canal_pedido", "status");

-- CreateIndex
CREATE INDEX "pedidos_cliente_id_created_at_idx" ON "pedidos"("cliente_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "itens_pedido_pedido_id_produto_id_key" ON "itens_pedido"("pedido_id", "produto_id");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_estoque_unidade_id_created_at_idx" ON "movimentacoes_estoque"("estoque_unidade_id", "created_at");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_pedido_id_idx" ON "movimentacoes_estoque"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_idempotency_key_key" ON "pagamentos"("idempotency_key");

-- CreateIndex
CREATE INDEX "pagamentos_pedido_id_idx" ON "pagamentos"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "contas_fidelidade_usuario_id_key" ON "contas_fidelidade"("usuario_id");

-- CreateIndex
CREATE INDEX "movimentacoes_fidelidade_conta_fidelidade_id_created_at_idx" ON "movimentacoes_fidelidade"("conta_fidelidade_id", "created_at");

-- CreateIndex
CREATE INDEX "movimentacoes_fidelidade_pedido_id_idx" ON "movimentacoes_fidelidade"("pedido_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidade_entidade_id_idx" ON "logs_auditoria"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_created_at_idx" ON "logs_auditoria"("created_at");
