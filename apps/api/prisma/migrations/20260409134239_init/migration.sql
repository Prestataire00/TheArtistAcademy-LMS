-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('learner', 'trainer', 'admin', 'superadmin');

-- CreateEnum
CREATE TYPE "PathwayMode" AS ENUM ('linear', 'free');

-- CreateEnum
CREATE TYPE "UAType" AS ENUM ('video', 'quiz', 'resource');

-- CreateEnum
CREATE TYPE "TranscodeStatus" AS ENUM ('pending', 'processing', 'ready', 'error');

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('future', 'active', 'closed');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq', 'truefalse', 'short');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('sso', 'navigation', 'video', 'quiz', 'reminder', 'admin');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "sso_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'dendreo',
    "jwt_public_key" TEXT NOT NULL,
    "jwt_algorithm" TEXT NOT NULL DEFAULT 'RS256',
    "token_ttl_seconds" INTEGER NOT NULL DEFAULT 300,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "used_jti_tokens" (
    "jti" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "used_jti_tokens_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "dendreo_user_id" TEXT,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'learner',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "formation_id" TEXT NOT NULL,
    "dendreo_enrolment_id" TEXT NOT NULL,
    "dendreo_session_id" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'future',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "pathway_mode" "PathwayMode" NOT NULL DEFAULT 'free',
    "video_completion_threshold" INTEGER NOT NULL DEFAULT 99,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "formation_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uas" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "UAType" NOT NULL,
    "position" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_contents" (
    "id" TEXT NOT NULL,
    "ua_id" TEXT NOT NULL,
    "bunny_video_id" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "hls_url" TEXT,
    "thumbnail_url" TEXT,
    "transcode_status" "TranscodeStatus" NOT NULL DEFAULT 'pending',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "ua_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_choices" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "choice_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quiz_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "ua_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ua_progresses" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "ua_id" TEXT NOT NULL,
    "status" "CompletionStatus" NOT NULL DEFAULT 'not_started',
    "video_position_seconds" INTEGER NOT NULL DEFAULT 0,
    "video_percent_watched" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "first_accessed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ua_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_progresses" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "status" "CompletionStatus" NOT NULL DEFAULT 'not_started',
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formation_progresses" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "status" "CompletionStatus" NOT NULL DEFAULT 'not_started',
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "first_accessed_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "webhook_last_synced_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formation_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "score_percent" DOUBLE PRECISION,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "selected_choice_id" TEXT,
    "short_answer_text" TEXT,
    "is_correct" BOOLEAN,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "enrollment_id" TEXT,
    "category" "EventCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "payload" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_rules" (
    "id" TEXT NOT NULL,
    "formation_id" TEXT,
    "delay_days" INTEGER NOT NULL,
    "send_window_start_hour" INTEGER NOT NULL DEFAULT 8,
    "send_window_end_hour" INTEGER NOT NULL DEFAULT 20,
    "template_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_version" TEXT,
    "status" "ReminderStatus" NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "used_jti_tokens_expires_at_idx" ON "used_jti_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_dendreo_user_id_key" ON "users"("dendreo_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_dendreo_user_id_idx" ON "users"("dendreo_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_dendreo_enrolment_id_key" ON "enrollments"("dendreo_enrolment_id");

-- CreateIndex
CREATE INDEX "enrollments_user_id_idx" ON "enrollments"("user_id");

-- CreateIndex
CREATE INDEX "enrollments_formation_id_idx" ON "enrollments"("formation_id");

-- CreateIndex
CREATE INDEX "enrollments_dendreo_session_id_idx" ON "enrollments"("dendreo_session_id");

-- CreateIndex
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");

-- CreateIndex
CREATE INDEX "modules_formation_id_position_idx" ON "modules"("formation_id", "position");

-- CreateIndex
CREATE INDEX "uas_module_id_position_idx" ON "uas"("module_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "video_contents_ua_id_key" ON "video_contents"("ua_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_contents_bunny_video_id_key" ON "video_contents"("bunny_video_id");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_ua_id_key" ON "quizzes"("ua_id");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_position_idx" ON "quiz_questions"("quiz_id", "position");

-- CreateIndex
CREATE INDEX "quiz_choices_question_id_idx" ON "quiz_choices"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "resources_ua_id_key" ON "resources"("ua_id");

-- CreateIndex
CREATE INDEX "ua_progresses_enrollment_id_idx" ON "ua_progresses"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "ua_progresses_enrollment_id_ua_id_key" ON "ua_progresses"("enrollment_id", "ua_id");

-- CreateIndex
CREATE INDEX "module_progresses_enrollment_id_idx" ON "module_progresses"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_progresses_enrollment_id_module_id_key" ON "module_progresses"("enrollment_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "formation_progresses_enrollment_id_key" ON "formation_progresses"("enrollment_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_enrollment_id_quiz_id_idx" ON "quiz_attempts"("enrollment_id", "quiz_id");

-- CreateIndex
CREATE INDEX "quiz_answers_attempt_id_idx" ON "quiz_answers"("attempt_id");

-- CreateIndex
CREATE INDEX "event_logs_user_id_created_at_idx" ON "event_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "event_logs_category_created_at_idx" ON "event_logs"("category", "created_at");

-- CreateIndex
CREATE INDEX "event_logs_enrollment_id_created_at_idx" ON "event_logs"("enrollment_id", "created_at");

-- CreateIndex
CREATE INDEX "event_logs_created_at_idx" ON "event_logs"("created_at");

-- CreateIndex
CREATE INDEX "reminder_logs_enrollment_id_idx" ON "reminder_logs"("enrollment_id");

-- CreateIndex
CREATE INDEX "reminder_logs_rule_id_sent_at_idx" ON "reminder_logs"("rule_id", "sent_at");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uas" ADD CONSTRAINT "uas_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_contents" ADD CONSTRAINT "video_contents_ua_id_fkey" FOREIGN KEY ("ua_id") REFERENCES "uas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_ua_id_fkey" FOREIGN KEY ("ua_id") REFERENCES "uas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_choices" ADD CONSTRAINT "quiz_choices_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_ua_id_fkey" FOREIGN KEY ("ua_id") REFERENCES "uas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ua_progresses" ADD CONSTRAINT "ua_progresses_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ua_progresses" ADD CONSTRAINT "ua_progresses_ua_id_fkey" FOREIGN KEY ("ua_id") REFERENCES "uas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_progresses" ADD CONSTRAINT "module_progresses_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_progresses" ADD CONSTRAINT "module_progresses_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formation_progresses" ADD CONSTRAINT "formation_progresses_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_selected_choice_id_fkey" FOREIGN KEY ("selected_choice_id") REFERENCES "quiz_choices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "reminder_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
