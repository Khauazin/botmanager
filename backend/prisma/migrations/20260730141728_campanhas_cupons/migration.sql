-- CreateEnum
CREATE TYPE "TipoDescontoCupom" AS ENUM ('PERCENTUAL', 'VALOR');

-- CreateEnum
CREATE TYPE "StatusCampanha" AS ENUM ('RASCUNHO', 'ENVIANDO', 'CONCLUIDA', 'ERRO');

-- CreateEnum
CREATE TYPE "StatusEnvioCampanha" AS ENUM ('PENDENTE', 'ENVIADO', 'FALHOU');

-- AlterTable
ALTER TABLE "vendas" ADD COLUMN     "cupomId" TEXT,
ADD COLUMN     "valorAntesDesconto" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "cupons" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoDescontoCupom" NOT NULL DEFAULT 'PERCENTUAL',
    "valor" DOUBLE PRECISION NOT NULL,
    "validoAte" TIMESTAMP(3),
    "usoMaximo" INTEGER,
    "usosAtuais" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "segmento" TEXT NOT NULL,
    "diasRecompra" INTEGER,
    "mensagem" TEXT NOT NULL,
    "nomeTemplate" TEXT,
    "cupomId" TEXT,
    "status" "StatusCampanha" NOT NULL DEFAULT 'RASCUNHO',
    "totalAlvo" INTEGER NOT NULL DEFAULT 0,
    "totalEnviado" INTEGER NOT NULL DEFAULT 0,
    "totalFalhou" INTEGER NOT NULL DEFAULT 0,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "enviadoEm" TIMESTAMP(3),

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanha_envios" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "StatusEnvioCampanha" NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanha_envios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cupons_clienteId_codigo_key" ON "cupons"("clienteId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "campanhas_cupomId_key" ON "campanhas"("cupomId");

-- CreateIndex
CREATE INDEX "campanha_envios_campanhaId_status_idx" ON "campanha_envios"("campanhaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campanha_envios_campanhaId_leadId_key" ON "campanha_envios"("campanhaId", "leadId");

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "cupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupons" ADD CONSTRAINT "cupons_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "cupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha_envios" ADD CONSTRAINT "campanha_envios_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha_envios" ADD CONSTRAINT "campanha_envios_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
