import { query } from '../config/database';

// ─────────────────────────────────────────────────────────────────────────────
// Full candidate pipeline view — used by triage dashboard & recruiter chatbot
// ─────────────────────────────────────────────────────────────────────────────
export async function getCandidatePipeline(recruiterId: string, isCeo: boolean = false) {
  const result = await query(
    `SELECT
       a.application_id,
       a.application_status,
       a.interest_status,
       a.applied_at,
       a.updated_at                                            AS last_updated,
       a.recruiter_id,
       r.full_name                                             AS recruiter_name,
       c.candidate_id,
       c.full_name                                             AS candidate_name,
       c.email                                                 AS candidate_email,
       c.phone,
       c.location                                              AS candidate_location,
       jr.role_title,
       jr.department,
       jr.salary_min                                           AS role_salary_min,
       jr.salary_max                                           AS role_salary_max,
       jr.currency_code,
       ad.notice_period_days,
       ad.experience_years,
       ad.expected_salary,
       ad.current_salary,
       ad.current_role_title,
       ad.current_company,
       ad.available_from,
       -- last message details
       lm.message_body                                         AS last_message,
       lm.sent_at                                              AS last_message_at,
       lm.direction                                            AS last_message_direction,
       -- pending follow-up
       ft.task_type                                            AS pending_task_type,
       ft.task_description                                     AS pending_task_desc,
       ft.due_at                                               AS pending_task_due,
       ft.priority                                             AS pending_task_priority,
       -- hours since last candidate message
       EXTRACT(EPOCH FROM (NOW() - lm.sent_at)) / 3600        AS hours_since_last_message,
       -- unanswered questions count
       (SELECT COUNT(*) FROM candidate_questions cq
        WHERE cq.application_id = a.application_id
          AND cq.response_status = 'pending')                  AS pending_questions_count,
       -- missing required fields count
       (SELECT COUNT(*) FROM application_required_fields arf
        WHERE arf.application_id = a.application_id
          AND arf.is_required = true
          AND arf.collection_status NOT IN ('answered','skipped'))
                                                               AS missing_fields_count
     FROM applications a
     JOIN candidates c   ON c.candidate_id  = a.candidate_id
     JOIN job_roles  jr  ON jr.job_role_id  = a.job_role_id
     JOIN recruiters r   ON r.recruiter_id  = a.recruiter_id
     LEFT JOIN application_details ad ON ad.application_id = a.application_id
     LEFT JOIN LATERAL (
       SELECT m.message_body, m.sent_at, m.direction
       FROM messages m
       JOIN conversation_threads ct ON ct.thread_id = m.thread_id
       WHERE ct.application_id = a.application_id
       ORDER BY m.sent_at DESC LIMIT 1
     ) lm ON TRUE
     LEFT JOIN LATERAL (
       SELECT task_type, task_description, due_at, priority
       FROM follow_up_tasks
       WHERE application_id = a.application_id
         AND task_status = 'pending'
       ORDER BY due_at ASC LIMIT 1
     ) ft ON TRUE
     WHERE ($2::boolean = true OR a.recruiter_id = $1)
       AND a.application_status NOT IN ('hired','rejected')
     ORDER BY
       CASE a.interest_status
         WHEN 'interested'     THEN 1
         WHEN 'unknown'        THEN 2
         WHEN 'maybe'          THEN 3
         WHEN 'no_response'    THEN 4
         WHEN 'not_interested' THEN 5
       END,
       lm.sent_at DESC NULLS LAST`,
    [recruiterId, isCeo]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-ups due today for a recruiter
// ─────────────────────────────────────────────────────────────────────────────
export async function getFollowUpsDueToday(recruiterId: string, isCeo: boolean = false) {
  const result = await query(
    `SELECT
       ft.*,
       c.full_name   AS candidate_name,
       jr.role_title,
       r.full_name   AS recruiter_name
     FROM follow_up_tasks ft
     JOIN applications a ON a.application_id = ft.application_id
     JOIN candidates   c ON c.candidate_id   = a.candidate_id
     JOIN job_roles    jr ON jr.job_role_id  = a.job_role_id
     JOIN recruiters   r ON r.recruiter_id   = a.recruiter_id
     WHERE ($2::boolean = true OR ft.recruiter_id = $1)
       AND ft.task_status  = 'pending'
       AND ft.due_at       <= (NOW() + INTERVAL '24 hours')
     ORDER BY ft.priority DESC, ft.due_at ASC`,
    [recruiterId, isCeo]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidates waiting for recruiter response (last message is inbound)
// ─────────────────────────────────────────────────────────────────────────────
export async function getWaitingForResponse(recruiterId: string, isCeo: boolean = false) {
  const result = await query(
    `SELECT
       a.application_id,
       c.full_name    AS candidate_name,
       c.email,
       jr.role_title,
       r.full_name    AS recruiter_name,
       lm.message_body AS last_candidate_message,
       lm.sent_at,
       EXTRACT(EPOCH FROM (NOW() - lm.sent_at))/3600 AS hours_waiting
     FROM applications a
     JOIN candidates c ON c.candidate_id = a.candidate_id
     JOIN job_roles jr ON jr.job_role_id = a.job_role_id
     JOIN recruiters r ON r.recruiter_id = a.recruiter_id
     JOIN LATERAL (
       SELECT m.message_body, m.sent_at, m.direction
       FROM messages m
       JOIN conversation_threads ct ON ct.thread_id = m.thread_id
       WHERE ct.application_id = a.application_id
       ORDER BY m.sent_at DESC LIMIT 1
     ) lm ON lm.direction = 'inbound'
     WHERE ($2::boolean = true OR a.recruiter_id = $1)
       AND a.interest_status != 'not_interested'
     ORDER BY lm.sent_at ASC`,
    [recruiterId, isCeo]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidates who asked about salary (from candidate_questions, messages, or tasks)
// ─────────────────────────────────────────────────────────────────────────────
export async function getSalaryAskers(recruiterId: string, isCeo: boolean = false) {
  const result = await query(
    `SELECT DISTINCT
       a.application_id,
       c.full_name    AS candidate_name,
       c.email,
       jr.role_title,
       jr.salary_min  AS role_salary_min,
       jr.salary_max  AS role_salary_max,
       jr.currency_code,
       ad.current_salary,
       ad.expected_salary,
       r.full_name    AS recruiter_name,
       COALESCE(
         cq.question_text,
         lm.message_body,
         'Inquired about salary range for the role'
       ) AS question_text,
       COALESCE(cq.created_at, lm.sent_at, a.updated_at) AS asked_at
     FROM applications a
     JOIN candidates c ON c.candidate_id = a.candidate_id
     JOIN job_roles jr ON jr.job_role_id = a.job_role_id
     JOIN recruiters r ON r.recruiter_id = a.recruiter_id
     LEFT JOIN application_details ad ON ad.application_id = a.application_id
     LEFT JOIN candidate_questions cq ON cq.application_id = a.application_id AND cq.question_category = 'salary'
     LEFT JOIN LATERAL (
       SELECT m.message_body, m.sent_at
       FROM messages m
       JOIN conversation_threads ct ON ct.thread_id = m.thread_id
       WHERE ct.application_id = a.application_id
         AND m.direction = 'inbound'
         AND (LOWER(m.message_body) LIKE '%salary%' OR LOWER(m.message_body) LIKE '%compensation%' OR LOWER(m.message_body) LIKE '%pay%')
       ORDER BY m.sent_at DESC LIMIT 1
     ) lm ON TRUE
     LEFT JOIN follow_up_tasks ft ON ft.application_id = a.application_id AND ft.task_type = 'share_salary'
     WHERE ($2::boolean = true OR a.recruiter_id = $1)
       AND (cq.question_id IS NOT NULL OR lm.message_body IS NOT NULL OR ft.task_id IS NOT NULL)
     ORDER BY asked_at DESC`,
    [recruiterId, isCeo]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interested candidates who haven't been contacted in N days
// ─────────────────────────────────────────────────────────────────────────────
export async function getInterestedNotContacted(recruiterId: string, days: number = 3, isCeo: boolean = false) {
  const result = await query(
    `SELECT
       a.application_id,
       c.full_name    AS candidate_name,
       c.email,
       jr.role_title,
       r.full_name    AS recruiter_name,
       ad.notice_period_days,
       lm.sent_at     AS last_contact,
       EXTRACT(EPOCH FROM (NOW() - lm.sent_at))/86400 AS days_since_contact
     FROM applications a
     JOIN candidates c ON c.candidate_id = a.candidate_id
     JOIN job_roles jr ON jr.job_role_id = a.job_role_id
     JOIN recruiters r ON r.recruiter_id = a.recruiter_id
     LEFT JOIN application_details ad ON ad.application_id = a.application_id
     LEFT JOIN LATERAL (
       SELECT m.sent_at
       FROM messages m
       JOIN conversation_threads ct ON ct.thread_id = m.thread_id
       WHERE ct.application_id = a.application_id
         AND m.direction = 'outbound'
       ORDER BY m.sent_at DESC LIMIT 1
     ) lm ON TRUE
     WHERE ($3::boolean = true OR a.recruiter_id = $1)
       AND a.interest_status = 'interested'
       AND (lm.sent_at IS NULL OR lm.sent_at < NOW() - ($2 || ' days')::INTERVAL)
     ORDER BY lm.sent_at ASC NULLS FIRST`,
    [recruiterId, days, isCeo]
  );
  return result.rows;
}
