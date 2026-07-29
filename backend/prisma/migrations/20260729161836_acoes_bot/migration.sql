-- CreateEnum
CREATE TYPE "TemplateCatalogo" AS ENUM ('FOTOS_GRANDES', 'LISTA_COMPACTA', 'MINIMALISTA');

-- CreateEnum
CREATE TYPE "AgrupamentoCatalogo" AS ENUM ('CATEGORIA', 'NENHUM');

-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "acoesPermitidas" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "cobrancas" ADD COLUMN     "itensPendentes" JSONB;

-- CreateTable
CREATE TABLE "configuracoes_catalogo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "template" "TemplateCatalogo" NOT NULL DEFAULT 'FOTOS_GRANDES',
    "corDestaque" TEXT NOT NULL DEFAULT '#2563EB',
    "agruparPor" "AgrupamentoCatalogo" NOT NULL DEFAULT 'CATEGORIA',
    "mostrarPreco" BOOLEAN NOT NULL DEFAULT true,
    "mostrarFoto" BOOLEAN NOT NULL DEFAULT true,
    "mostrarDescricao" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_catalogo_clienteId_key" ON "configuracoes_catalogo"("clienteId");

-- AddForeignKey
ALTER TABLE "configuracoes_catalogo" ADD CONSTRAINT "configuracoes_catalogo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
