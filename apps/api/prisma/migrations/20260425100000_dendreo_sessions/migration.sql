-- CreateTable
CREATE TABLE "dendreo_sessions" (
    "id" TEXT NOT NULL,
    "formation_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "tms_origin" TEXT NOT NULL DEFAULT 'dendreo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dendreo_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dendreo_sessions_external_id_key" ON "dendreo_sessions"("external_id");

-- CreateIndex
CREATE INDEX "dendreo_sessions_formation_id_idx" ON "dendreo_sessions"("formation_id");

-- AddForeignKey
ALTER TABLE "dendreo_sessions" ADD CONSTRAINT "dendreo_sessions_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
