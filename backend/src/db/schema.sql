-- ============================================================
-- Trustume PostgreSQL Schema — All 16 Tables
-- Run this script once against an empty "trustume" database
-- ============================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";      -- case-insensitive text

-- ────────────────────────────────────────────────────────────
-- 1. recruiters
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruiters (
  recruiter_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(150) NOT NULL,
  email          CITEXT      UNIQUE NOT NULL,
  password_hash  TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. candidates
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  candidate_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(150) NOT NULL,
  email         CITEXT      UNIQUE NOT NULL,
  phone         VARCHAR(30),
  location      VARCHAR(200),
  linkedin_url  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. job_roles
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_roles (
  job_role_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_title       VARCHAR(200) NOT NULL,
  department       VARCHAR(100),
  job_description  TEXT,
  min_experience   NUMERIC(4,1),
  max_experience   NUMERIC(4,1),
  salary_min       NUMERIC(14,2),
  salary_max       NUMERIC(14,2),
  currency_code    CHAR(3)     NOT NULL DEFAULT 'INR',
  location         VARCHAR(200),
  employment_type  VARCHAR(50) CHECK (employment_type IN ('full-time','part-time','contract','internship')),
  status           VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','closed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. applications
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  application_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      UUID        NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  job_role_id       UUID        NOT NULL REFERENCES job_roles(job_role_id) ON DELETE RESTRICT,
  recruiter_id      UUID        NOT NULL REFERENCES recruiters(recruiter_id) ON DELETE RESTRICT,
  application_status VARCHAR(50) NOT NULL DEFAULT 'new'
                    CHECK (application_status IN ('new','screening','interview','offer','hired','rejected','closed')),
  interest_status   VARCHAR(30) NOT NULL DEFAULT 'unknown'
                    CHECK (interest_status IN ('unknown','interested','not_interested','maybe','no_response')),
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 5. application_details
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_details (
  detail_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id         UUID        UNIQUE NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  current_role_title     VARCHAR(200),
  current_company        VARCHAR(200),
  experience_years       NUMERIC(4,1),
  notice_period_days     INT,
  current_salary         NUMERIC(14,2),
  expected_salary        NUMERIC(14,2),
  salary_currency        CHAR(3)     DEFAULT 'INR',
  available_from         DATE,
  preferred_location     VARCHAR(200),
  last_updated_message_id UUID,       -- FK added after messages table
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 6. conversation_threads
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_threads (
  thread_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     UUID        NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  channel            VARCHAR(30) NOT NULL DEFAULT 'email'
                     CHECK (channel IN ('email','whatsapp','sms','portal')),
  external_thread_id TEXT,
  subject            TEXT,
  thread_status      VARCHAR(30) NOT NULL DEFAULT 'open'
                     CHECK (thread_status IN ('open','awaiting_candidate','awaiting_recruiter','closed')),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. messages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  message_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id          UUID        NOT NULL REFERENCES conversation_threads(thread_id) ON DELETE CASCADE,
  direction          VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_type        VARCHAR(20) NOT NULL CHECK (sender_type IN ('candidate','recruiter','ai')),
  recruiter_id       UUID        REFERENCES recruiters(recruiter_id) ON DELETE SET NULL,
  sender_email       CITEXT,
  message_body       TEXT        NOT NULL,
  external_message_id TEXT,
  reply_to_message_id UUID       REFERENCES messages(message_id) ON DELETE SET NULL,
  sent_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now add the FK that references messages back into application_details
ALTER TABLE application_details
  ADD CONSTRAINT fk_ad_last_msg
  FOREIGN KEY (last_updated_message_id) REFERENCES messages(message_id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 8. message_analyses
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_analyses (
  analysis_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        UUID        UNIQUE NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
  model_name        VARCHAR(100) NOT NULL DEFAULT 'gemini-3.8-flash',
  primary_intent    VARCHAR(50) CHECK (primary_intent IN (
                      'interested','not_interested','asking_salary',
                      'asking_role_details','confirming_availability',
                      'providing_notice_period','requesting_callback',
                      'unknown')),
  detected_interest VARCHAR(20) CHECK (detected_interest IN ('high','medium','low','none','unknown')),
  confidence_score  NUMERIC(5,4) CHECK (confidence_score BETWEEN 0 AND 1),
  extracted_data    JSONB       NOT NULL DEFAULT '{}',
  analysis_status   VARCHAR(20) NOT NULL DEFAULT 'completed'
                    CHECK (analysis_status IN ('pending','completed','failed','fallback')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 9. field_definitions
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_definitions (
  field_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key        VARCHAR(60) UNIQUE NOT NULL,  -- e.g. 'notice_period_days'
  field_label      VARCHAR(100) NOT NULL,
  data_type        VARCHAR(20) NOT NULL CHECK (data_type IN ('text','number','date','boolean','enum')),
  default_required BOOLEAN     NOT NULL DEFAULT TRUE,
  default_question TEXT        NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Seed default fields
INSERT INTO field_definitions (field_key, field_label, data_type, default_required, default_question) VALUES
  ('notice_period_days',  'Notice Period (days)',   'number',  true, 'Could you let us know your current notice period in days?'),
  ('current_role_title',  'Current Role',           'text',    true, 'What is your current job title/role?'),
  ('current_company',     'Current Company',        'text',    false,'Which company are you currently working with?'),
  ('experience_years',    'Years of Experience',    'number',  true, 'How many years of relevant experience do you have?'),
  ('expected_salary',     'Expected Salary',        'number',  false,'Could you share your expected salary (CTC)?'),
  ('current_salary',      'Current Salary',         'number',  false,'Could you share your current salary (CTC)?'),
  ('available_from',      'Available From',         'date',    false,'From when are you available to join?'),
  ('preferred_location',  'Preferred Location',     'text',    false,'Do you have any preference for work location?')
ON CONFLICT (field_key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 10. application_required_fields
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_required_fields (
  requirement_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     UUID        NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  field_id           UUID        NOT NULL REFERENCES field_definitions(field_id) ON DELETE CASCADE,
  is_required        BOOLEAN     NOT NULL DEFAULT TRUE,
  collection_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (collection_status IN ('pending','asked','answered','skipped')),
  last_asked_at      TIMESTAMPTZ,
  answered_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, field_id)
);

-- ────────────────────────────────────────────────────────────
-- 11. application_field_answers
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_field_answers (
  answer_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  field_id            UUID        NOT NULL REFERENCES field_definitions(field_id) ON DELETE CASCADE,
  raw_answer          TEXT,
  normalized_text     TEXT,
  normalized_number   NUMERIC(14,4),
  normalized_date     DATE,
  source_message_id   UUID        REFERENCES messages(message_id) ON DELETE SET NULL,
  analysis_id         UUID        REFERENCES message_analyses(analysis_id) ON DELETE SET NULL,
  confidence_score    NUMERIC(5,4) CHECK (confidence_score BETWEEN 0 AND 1),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'auto'
                      CHECK (verification_status IN ('auto','recruiter_verified','disputed')),
  is_current          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 12. candidate_questions
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_questions (
  question_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id           UUID        NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  source_message_id        UUID        REFERENCES messages(message_id) ON DELETE SET NULL,
  question_category        VARCHAR(50) CHECK (question_category IN (
                             'salary','role_details','work_location','benefits',
                             'interview_process','timeline','other')),
  question_text            TEXT        NOT NULL,
  response_status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                           CHECK (response_status IN ('pending','answered','dismissed')),
  recruiter_reply_message_id UUID     REFERENCES messages(message_id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at              TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────
-- 13. interview_availability_slots
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_availability_slots (
  slot_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID        NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  start_at              TIMESTAMPTZ NOT NULL,
  end_at                TIMESTAMPTZ NOT NULL,
  timezone              VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata',
  original_availability TEXT,
  source_message_id     UUID        REFERENCES messages(message_id) ON DELETE SET NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'proposed'
                        CHECK (status IN ('proposed','confirmed','cancelled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 14. message_templates
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  template_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key     VARCHAR(80) UNIQUE NOT NULL,
  template_type    VARCHAR(50) NOT NULL CHECK (template_type IN (
                     'job_proposal','follow_up','field_collection',
                     'interview_invite','offer','rejection','general')),
  field_id         UUID        REFERENCES field_definitions(field_id) ON DELETE SET NULL,
  subject_template TEXT,
  body_template    TEXT        NOT NULL,
  channel          VARCHAR(20) NOT NULL DEFAULT 'email'
                   CHECK (channel IN ('email','whatsapp','sms','portal')),
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  version          INT         NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed core templates
INSERT INTO message_templates (template_key, template_type, subject_template, body_template, channel) VALUES
  ('job_proposal_initial','job_proposal',
   'Exciting {{role_title}} Opportunity at {{company_name}}',
   'Hi {{candidate_name}},\n\nI hope this message finds you well! I came across your profile and wanted to reach out regarding an exciting {{role_title}} opportunity.\n\n{{job_description}}\n\nWould you be interested in learning more? Please reply to this message and we can take it forward.\n\nBest regards,\n{{recruiter_name}}',
   'email'),
  ('follow_up_no_response','follow_up',
   'Following up — {{role_title}} Opportunity',
   'Hi {{candidate_name}},\n\nI wanted to follow up on my earlier message about the {{role_title}} position. The role is still open and I would love to hear your thoughts.\n\nLooking forward to your response.\n\nBest regards,\n{{recruiter_name}}',
   'email'),
  ('ask_notice_period','field_collection',
   NULL,
   'Hi {{candidate_name}}, could you let us know your current notice period in days?',
   'email'),
  ('ask_expected_salary','field_collection',
   NULL,
   'Hi {{candidate_name}}, could you share your expected CTC for this role?',
   'email'),
  ('schedule_interview','interview_invite',
   'Interview Invitation — {{role_title}}',
   'Hi {{candidate_name}},\n\nGreat news! We would like to invite you for an interview for the {{role_title}} position.\n\nCould you please share your availability for a {{interview_duration}}-minute call this week or next?\n\nBest regards,\n{{recruiter_name}}',
   'email')
ON CONFLICT (template_key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 15. reply_drafts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reply_drafts (
  draft_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  thread_id           UUID        NOT NULL REFERENCES conversation_threads(thread_id) ON DELETE CASCADE,
  template_id         UUID        REFERENCES message_templates(template_id) ON DELETE SET NULL,
  based_on_message_id UUID        REFERENCES messages(message_id) ON DELETE SET NULL,
  draft_type          VARCHAR(30) NOT NULL DEFAULT 'ai_generated'
                      CHECK (draft_type IN ('ai_generated','template','manual')),
  subject             TEXT,
  draft_content       TEXT        NOT NULL,
  draft_status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (draft_status IN ('pending','reviewed','sent','discarded')),
  reviewed_by         UUID        REFERENCES recruiters(recruiter_id) ON DELETE SET NULL,
  sent_message_id     UUID        REFERENCES messages(message_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────
-- 16. follow_up_tasks
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_up_tasks (
  task_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     UUID        NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  recruiter_id       UUID        NOT NULL REFERENCES recruiters(recruiter_id) ON DELETE RESTRICT,
  task_type          VARCHAR(50) NOT NULL CHECK (task_type IN (
                       'send_follow_up','schedule_interview','share_salary',
                       'share_jd','close_application','manual')),
  task_description   TEXT        NOT NULL,
  priority           VARCHAR(10) NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('low','medium','high','urgent')),
  due_at             TIMESTAMPTZ NOT NULL,
  task_status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (task_status IN ('pending','in_progress','completed','cancelled')),
  source_message_id  UUID        REFERENCES messages(message_id) ON DELETE SET NULL,
  reply_draft_id     UUID        REFERENCES reply_drafts(draft_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────
-- Indexes for common query patterns
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_applications_candidate     ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_recruiter     ON applications(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_applications_interest      ON applications(interest_status);
CREATE INDEX IF NOT EXISTS idx_applications_status        ON applications(application_status);
CREATE INDEX IF NOT EXISTS idx_messages_thread            ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at           ON messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_analyses_message   ON message_analyses(message_id);
CREATE INDEX IF NOT EXISTS idx_field_answers_application  ON application_field_answers(application_id);
CREATE INDEX IF NOT EXISTS idx_field_answers_field        ON application_field_answers(field_id, is_current);
CREATE INDEX IF NOT EXISTS idx_follow_up_due              ON follow_up_tasks(due_at, task_status);
CREATE INDEX IF NOT EXISTS idx_follow_up_recruiter        ON follow_up_tasks(recruiter_id, task_status);
CREATE INDEX IF NOT EXISTS idx_candidate_questions_app    ON candidate_questions(application_id, response_status);
CREATE INDEX IF NOT EXISTS idx_threads_application        ON conversation_threads(application_id);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_application   ON reply_drafts(application_id, draft_status);
