-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "iaAtiva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "iaModelo" TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
ADD COLUMN     "iaPrecoPorMilTokensExcedenteCentavos" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "iaPromptSistema" TEXT,
ADD COLUMN     "iaTokensIncluidosMes" INTEGER NOT NULL DEFAULT 100000;

-- CreateTable
CREATE TABLE "consumo_ia" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "tokensUsados" INTEGER NOT NULL DEFAULT 0,
    "tokensExcedentes" INTEGER NOT NULL DEFAULT 0,
    "valorExcedenteCentavos" INTEGER NOT NULL DEFAULT 0,
    "faturadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumo_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consumo_ia_clienteId_periodo_idx" ON "consumo_ia"("clienteId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "consumo_ia_botId_periodo_key" ON "consumo_ia"("botId", "periodo");

-- AddForeignKey
ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
