-- AlterTable
ALTER TABLE "faqs" ADD COLUMN     "palavrasChave" TEXT[] DEFAULT ARRAY[]::TEXT[];
