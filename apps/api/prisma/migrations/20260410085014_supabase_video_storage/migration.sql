/*
  Warnings:

  - You are about to drop the column `bunny_video_id` on the `video_contents` table. All the data in the column will be lost.
  - You are about to drop the column `hls_url` on the `video_contents` table. All the data in the column will be lost.
  - You are about to drop the column `transcode_status` on the `video_contents` table. All the data in the column will be lost.
  - Added the required column `original_name` to the `video_contents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storage_path` to the `video_contents` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "video_contents_bunny_video_id_key";

-- AlterTable
ALTER TABLE "video_contents" DROP COLUMN "bunny_video_id",
DROP COLUMN "hls_url",
DROP COLUMN "transcode_status",
ADD COLUMN     "file_size_bytes" INTEGER,
ADD COLUMN     "mime_type" TEXT NOT NULL DEFAULT 'video/mp4',
ADD COLUMN     "original_name" TEXT NOT NULL,
ADD COLUMN     "storage_path" TEXT NOT NULL;

-- DropEnum
DROP TYPE "TranscodeStatus";
