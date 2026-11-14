import { z } from 'zod';

// ── Auth ────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// ── Recruiter ───────────────────────────────────────────────
export const CreateRecruiterSchema = z.object({
  full_name: z.string().min(2).max(150),
  email: z.string().email(),
  password: z.string().min(6),
});

// ── Candidate ───────────────────────────────────────────────
export const CreateCandidateSchema = z.object({
  full_name: z.string().min(2).max(150),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin_url: z.string().url().optional(),
});

// ── Job Role ────────────────────────────────────────────────
export const CreateJobRoleSchema = z.object({
  role_title: z.string().min(2).max(200),
  department: z.string().optional(),
  job_description: z.string().optional(),
  min_experience: z.number().min(0).optional(),
  max_experience: z.number().min(0).optional(),
  salary_min: z.number().min(0).optional(),
  salary_max: z.number().min(0).optional(),
  currency_code: z.string().length(3).default('INR'),
  location: z.string().optional(),
  employment_type: z.enum(['full-time', 'part-time', 'contract', 'internship']).optional(),
});

// ── Application ─────────────────────────────────────────────
export const CreateApplicationSchema = z.object({
  candidate_id: z.string().uuid(),
  job_role_id: z.string().uuid(),
});

// ── Message (inbound from candidate) ────────────────────────
export const InboundMessageSchema = z.object({
  application_id: z.string().uuid(),
  thread_id: z.string().uuid().optional(),
  sender_email: z.string().email().optional(),
  message_body: z.string().min(1),
  channel: z.enum(['email', 'whatsapp', 'sms', 'portal']).default('email'),
  external_message_id: z.string().optional(),
  reply_to_message_id: z.string().uuid().optional(),
});

// ── Outbound message (recruiter sends) ──────────────────────
export const OutboundMessageSchema = z.object({
  thread_id: z.string().uuid(),
  message_body: z.string().min(1),
  subject: z.string().optional(),
  draft_id: z.string().uuid().optional(), // mark draft as sent
});

// ── Generate Reply (AI) ─────────────────────────────────────
export const GenerateReplySchema = z.object({
  application_id: z.string().uuid(),
  message_id: z.string().uuid(),  // the candidate message to reply to
});

// ── Recruiter Natural Language Query ────────────────────────
export const RecruiterQuerySchema = z.object({
  query: z.string().min(3),
});

// ── Follow-up Task Update ───────────────────────────────────
export const UpdateTaskStatusSchema = z.object({
  task_status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
});

// ── AI Analysis Result (Gemini JSON schema) ─────────────────
export const MessageAnalysisResultSchema = z.object({
  primary_intent: z.enum([
    'interested', 'not_interested', 'asking_salary',
    'asking_role_details', 'confirming_availability',
    'providing_notice_period', 'requesting_callback', 'unknown',
  ]),
  detected_interest: z.enum(['high', 'medium', 'low', 'none', 'unknown']),
  confidence_score: z.number().min(0).max(1),
  extracted_data: z.object({
    notice_period_days: z.number().nullable().optional(),
    current_role: z.string().nullable().optional(),
    current_company: z.string().nullable().optional(),
    experience_years: z.number().nullable().optional(),
    expected_salary: z.number().nullable().optional(),
    current_salary: z.number().nullable().optional(),
    available_from: z.string().nullable().optional(),
    preferred_location: z.string().nullable().optional(),
    questions_asked: z.array(z.object({
      category: z.enum(['salary','role_details','work_location','benefits','interview_process','timeline','other']),
      question_text: z.string(),
    })).default([]),
    interview_slots: z.array(z.object({
      description: z.string(),
    })).default([]),
  }),
  missing_fields: z.array(z.string()).default([]),
  suggested_action: z.enum([
    'schedule_interview', 'follow_up', 'share_salary',
    'share_jd', 'close_application', 'send_field_question',
    'no_action',
  ]),
  suggested_action_reason: z.string(),
});

export type MessageAnalysisResult = z.infer<typeof MessageAnalysisResultSchema>;
export type InboundMessageInput = z.infer<typeof InboundMessageSchema>;
export type GenerateReplyInput = z.infer<typeof GenerateReplySchema>;
