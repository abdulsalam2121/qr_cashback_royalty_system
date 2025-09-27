-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authProvider" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "photoURL" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;
