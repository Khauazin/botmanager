-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'DEVOLUCAO_PROXIMA';

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "diasAvisoDevolucao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "configuracoes_catalogo" ADD COLUMN     "ocultarSemEstoque" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "diasParaDevolucaoPadrao" INTEGER,
ADD COLUMN     "temDevolucao" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "devolucoes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "variacaoId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "dataDevolucao" TIMESTAMP(3) NOT NULL,
    "devolvidoEm" TIMESTAMP(3),
    "lembreteEnviadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devolucoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "devolucoes_clienteId_dataDevolucao_idx" ON "devolucoes"("clienteId", "dataDevolucao");

-- CreateIndex
CREATE INDEX "devolucoes_vendaId_idx" ON "devolucoes"("vendaId");

-- AddForeignKey
ALTER TABLE "devolucoes" ADD CONSTRAINT "devolucoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucoes" ADD CONSTRAINT "devolucoes_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucoes" ADD CONSTRAINT "devolucoes_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "variacoes_produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucoes" ADD CONSTRAINT "devolucoes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
