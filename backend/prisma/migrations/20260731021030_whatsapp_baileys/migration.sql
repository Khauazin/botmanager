-- CreateEnum
CREATE TYPE "ProvedorCanal" AS ENUM ('META_CLOUD', 'BAILEYS');

-- CreateEnum
CREATE TYPE "StatusConexaoBaileys" AS ENUM ('DESCONECTADO', 'AGUARDANDO_QR', 'CONECTANDO', 'CONECTADO', 'LOGOUT');

-- AlterEnum
ALTER TYPE "TipoCredencial" ADD VALUE 'WHATSAPP_BAILEYS_SESSION';

-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "baileysAtualizadoEm" TIMESTAMP(3),
ADD COLUMN     "baileysNumeroConectado" TEXT,
ADD COLUMN     "provedorCanal" "ProvedorCanal" NOT NULL DEFAULT 'META_CLOUD',
ADD COLUMN     "qrCodeAtual" TEXT,
ADD COLUMN     "statusConexaoBaileys" "StatusConexaoBaileys";
