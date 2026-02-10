-- CreateTable
CREATE TABLE "test_suites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "test_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suite_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "name" TEXT,
    "target_guardrail" TEXT NOT NULL,
    "expected_outcome" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_conversations_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "test_suites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "utterances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    CONSTRAINT "utterances_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "test_conversations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suite_id" TEXT,
    "status" TEXT NOT NULL,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "total_tests" INTEGER DEFAULT 0,
    "passed" INTEGER DEFAULT 0,
    "failed" INTEGER DEFAULT 0,
    "errors" INTEGER DEFAULT 0,
    CONSTRAINT "test_executions_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "test_suites" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "execution_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "guardrail_type" TEXT NOT NULL,
    "guardrail_stage" TEXT,
    "expected_blocked" BOOLEAN,
    "was_blocked" BOOLEAN,
    "response_content" TEXT,
    "violation_detected" BOOLEAN,
    "violation_reason" TEXT,
    "ai_analysis" TEXT,
    "prompt_improvement_suggestion" TEXT,
    "latency_ms" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_results_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "test_executions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_results_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "test_conversations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evaluation_prompts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guardrail_type" TEXT NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "prompt_improvements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "original_prompt_id" TEXT,
    "improved_prompt" TEXT NOT NULL,
    "improvement_reason" TEXT,
    "test_result_id" TEXT,
    "effectiveness_score" DECIMAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prompt_improvements_original_prompt_id_fkey" FOREIGN KEY ("original_prompt_id") REFERENCES "evaluation_prompts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "prompt_improvements_test_result_id_fkey" FOREIGN KEY ("test_result_id") REFERENCES "test_results" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evaluation_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default-user',
    "session_id" TEXT,
    "user_input" TEXT NOT NULL,
    "bot_response" TEXT NOT NULL,
    "prompt_sent" TEXT NOT NULL,
    "llm_output" TEXT NOT NULL,
    "toxicity_pass" BOOLEAN,
    "topics_pass" BOOLEAN,
    "injection_pass" BOOLEAN,
    "regex_pass" BOOLEAN,
    "overall_pass" BOOLEAN NOT NULL,
    "is_attack" BOOLEAN NOT NULL DEFAULT false,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "latency_ms" INTEGER,
    "model" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "attack_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "message_content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "turn_index" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bot_id" TEXT,
    "user_id" TEXT
);

-- CreateTable
CREATE TABLE "api_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "log_type" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "method" TEXT,
    "endpoint" TEXT,
    "request_body" TEXT,
    "request_headers" TEXT,
    "status_code" INTEGER,
    "response_body" TEXT,
    "latency_ms" INTEGER,
    "total_tokens" INTEGER,
    "is_error" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "session_id" TEXT,
    "provider" TEXT,
    "model" TEXT
);

-- CreateTable
CREATE TABLE "kore_llm_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kore_id" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" TEXT,
    "feature_name" TEXT,
    "model" TEXT,
    "status" TEXT,
    "description" TEXT,
    "request_payload" TEXT,
    "response_payload" TEXT,
    "input_tokens" INTEGER DEFAULT 0,
    "output_tokens" INTEGER DEFAULT 0,
    "total_tokens" INTEGER DEFAULT 0,
    "bot_id" TEXT,
    "user_id" TEXT,
    "channel_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "test_conversations_conversation_id_key" ON "test_conversations"("conversation_id");

-- CreateIndex
CREATE INDEX "evaluation_runs_user_id_idx" ON "evaluation_runs"("user_id");

-- CreateIndex
CREATE INDEX "attack_messages_session_id_idx" ON "attack_messages"("session_id");

-- CreateIndex
CREATE INDEX "api_logs_user_id_idx" ON "api_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kore_llm_logs_kore_id_key" ON "kore_llm_logs"("kore_id");
