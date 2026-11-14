// ─── Core entity types ────────────────────────────────────────────────────────

export interface Recruiter {
  recruiter_id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface Candidate {
  candidate_id: string;
  full_name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  created_at: string;
}

export interface JobRole {
  job_role_id: string;
  role_title: string;
  department?: string;
  job_description?: string;
  min_experience?: number;
  max_experience?: number;
  salary_min?: number;
  salary_max?: number;
  currency_code: string;
  location?: string;
  employment_type?: string;
  status: 'active' | 'paused' | 'closed';
  created_at: string;
}

export interface Application {
  application_id: string;
  candidate_id: string;
  job_role_id: string;
  recruiter_id: string;
  application_status: 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'closed';
  interest_status: 'unknown' | 'interested' | 'not_interested' | 'maybe' | 'no_response';
  applied_at: string;
  created_at: string;
  updated_at: string;
  // joined fields
  candidate_name?: string;
  candidate_email?: string;
  phone?: string;
  role_title?: string;
  department?: string;
  notice_period_days?: number;
  experience_years?: number;
  expected_salary?: number;
  available_from?: string;
  salary_currency?: string;
  // thread fields (from LEFT JOIN conversation_threads)
  thread_id?: string;
  channel?: string;
  thread_status?: string;
  last_message_at?: string;
}

export interface TriageCandidate extends Application {
  last_message?: string;
  last_message_at?: string;
  last_message_direction?: string;
  pending_task_type?: string;
  pending_task_due?: string;
  pending_task_priority?: string;
  hours_since_last_message?: number;
  pending_questions_count?: number;
  missing_fields_count?: number;
}

export interface Message {
  message_id: string;
  thread_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'candidate' | 'recruiter' | 'ai';
  recruiter_id?: string;
  recruiter_name?: string;
  sender_email?: string;
  message_body: string;
  sent_at: string;
}

export interface MessageAnalysis {
  analysis_id: string;
  message_id: string;
  model_name: string;
  primary_intent: string;
  detected_interest: 'high' | 'medium' | 'low' | 'none' | 'unknown';
  confidence_score: number;
  extracted_data: {
    notice_period_days?: number | null;
    current_role?: string | null;
    current_company?: string | null;
    experience_years?: number | null;
    expected_salary?: number | null;
    current_salary?: number | null;
    available_from?: string | null;
    preferred_location?: string | null;
    questions_asked?: Array<{ category: string; question_text: string }>;
    interview_slots?: Array<{ description: string }>;
  };
  missing_fields: string[];
  suggested_action: string;
  suggested_action_reason: string;
  created_at: string;
}

export interface ReplyDraft {
  draft_id: string;
  application_id: string;
  thread_id: string;
  draft_type: 'ai_generated' | 'template' | 'manual';
  subject?: string;
  draft_content: string;
  draft_status: 'pending' | 'reviewed' | 'sent' | 'discarded';
  created_at: string;
  candidate_name?: string;
  role_title?: string;
}

export interface FollowUpTask {
  task_id: string;
  application_id: string;
  recruiter_id: string;
  task_type: string;
  task_description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_at: string;
  task_status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  candidate_name?: string;
  role_title?: string;
}

export interface DashboardStats {
  total: string;
  interested: string;
  not_interested: string;
  unknown: string;
  in_interview: string;
  offer_stage: string;
  follow_ups_due_today: string;
}

export interface ConversationThread {
  thread_id: string;
  application_id: string;
  channel: string;
  thread_status: string;
  started_at: string;
  last_message_at: string;
}

export interface InboundMessagePayload {
  application_id: string;
  thread_id?: string;
  message_body: string;
  sender_email?: string;
  channel?: string;
}

export interface RecruiterQueryResponse {
  query: string;
  answer: string;
  candidate_count: number;
}
