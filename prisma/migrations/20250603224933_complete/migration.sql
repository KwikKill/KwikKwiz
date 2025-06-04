-- AlterTable
ALTER TABLE "QuizSession" ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "sessionDate" TIMESTAMP(3),
ADD COLUMN     "timerDuration" INTEGER;
