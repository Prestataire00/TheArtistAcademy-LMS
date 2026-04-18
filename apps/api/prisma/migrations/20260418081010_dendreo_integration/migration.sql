-- AlterEnum
ALTER TYPE "EventCategory" ADD VALUE 'webhook';

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "tms_origin" TEXT,
ALTER COLUMN "dendreo_enrolment_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "tms_origin" TEXT;
