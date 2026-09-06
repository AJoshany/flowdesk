-- AlterTable: Add default value for passwordHash column
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET DEFAULT '';
