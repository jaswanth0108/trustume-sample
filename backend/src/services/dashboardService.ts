import { query } from '../config/database';

// ─────────────────────────────────────────────────────────────────────────────
// Full candidate pipeline view — used by triage dashboard & recruiter chatbot
// ─────────────────────────────────────────────────────────────────────────────
export async function getCandidatePipeline(recruiterId: string) {
  const result = await query(
    `SELECT
       a.application_id,
       a.application_status,
       a.interest_status,
       a.applied_at,
       a.updated_at                                            AS last_updated,
       c.candidate_id,
       c.full_name                                             AS candidate_name,
       c.email                                                 AS candidate_email,
       c.phone,
       jr.role_title,
       jr.department,
       ad.notice_period_days,
       ad.experience_years,
       ad.expected_salary,
       ad.current_role_title,
       ad.current_company,
       ad.available_from,
       -- last message details
       lm.message_body                                         AS last_message,
       lm.sent_at                                              AS last_message_at,
       lm.direction                                            AS last_message_direction,
       -- pending follow-up
       ft.task_type                                            AS pending_task_type,
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
     LEFT JOIN application_details ad ON ad.application_id = a.application_id
     LEFT JOIN LATERAL (
       SELECT m.message_body, m.sent_at, m.direction
       FROM messages m
       JOIN conversation_threads ct ON ct.thread_id = m.thread_id
       WHERE ct.application_id = a.application_id
       ORDER BY m.sent_at DESC LIMIT 1
     ) lm ON TRUE
     LEFT JOIN LATERAL (
       SELECT task_type, due_at, priority
       FROM follow_up_tasks
       WHERE application_id = a.application_id
         AND task_status = 'pending'
       ORDER BY due_at ASC LIMIT 1
     ) ft ON TRUE
     WHERE a.recruiter_id = $1
       AND a.application_status NOT IN ('hired','rejected','closed')
     ORDER BY
       CASE a.interest_status
         WHEN 'interested'     THEN 1
         WHEN 'unknown'        THEN 2
         WHEN 'maybe'          THEN 3
         WHEN 'no_response'    THEN 4
         WHEN 'not_interested' THEN 5
       END,
       lm.sent_at DESC NULLS LAST`,
    [recruiterId]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-ups due today for a recruiter
// ─────────────────────────────────────────────────────────────────────────────
export async function getFollowUpsDueToday(recruiterId: string) {
  const result = await query(
    `SELECT
       ft.*,
       c.full_name   AS candidate_name,
       jr.role_title
     FROM follow_up_tasks ft
     JOIN applications a ON a.application_id = ft.application_id
     JOIN candidates   c ON c.candidate_id   = a.candidate_id
     JOIN job_roles    jr ON jr.job_role_id  = a.job_role_id
     WHERE ft.recruiter_id = $1
       AND ft.task_status  = 'pending'
       AND ft.due_at       <= (NOW() + INTERVAL '24 hours')
     ORDER BY ft.priority DESC, ft.due_at ASC`,
    [recruiterId]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidates waiting for recruiter response (last message is inbound, > 3hrs ago)
// ─────────────────────────────────────────────────────────────────────────────
export async function getWaitingForResponse(recruiterId: string) {
  const result = await query(
    `SELECT
       a.application_id,
       c.full_name    AS candidate_name,
       c.email,
       jr.role_title,
       lm.message_body AS last_candidate_message,
       lm.sent_at,
       EXTRACT(EPOCH FROM (NOW() - lm.sent_at))/3600 AS hours_waiting
     FROM applications a
     JOIN candidates c ON c.candidate_id = a.candidate_id
     JOIN job_roles jr ON jr.job_role_id = a.job_role_id
     JOIN LATERAL (
       SELECT m.message_body, m.sent_at, m.direction
       FROM messages m
       JOIN conversation_threads ct ON ct.thread_id = m.thread_id
       WHERE ct.application_id = a.application_id
       ORDER BY m.sent_at DESC LIMIT 1
     ) lm ON lm.direction = 'inbound'
     WHERE a.recruiter_id = $1
       AND lm.sent_at < NOW() - INTERVAL '3 hours'
       AND a.interest_status != 'not_interested'
     ORDER BY lm.sent_at ASC`,
    [recruiterId]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidates who asked about salary
// ─────────────────────────────────────────────────────────────────────────────
export async function getSalaryAskers(recruiterId: string) {
  const result = await query(
    `SELECT DISTINCT
       a.application_id,
       c.full_name    AS candidate_name,
       c.email,
       jr.role_title,
       cq.question_text,
       cq.created_at  AS asked_at
     FROM candidate_questions cq
     JOIN applications a ON a.application_id = cq.application_id
     JOIN candidates   c ON c.candidate_id   = a.candidate_id
     JOIN job_roles   jr ON jr.job_role_id   = a.job_role_id
     WHERE a.recruiter_id  = $1
       AND cq.question_category = 'salary'
       AND cq.response_status = 'pending'
     ORDER BY cq.created_at ASC`,
    [recruiterId]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interested candidates who haven't been contacted in N days
// ─────────────────────────────────────────────────────────────────────────────
export async function getInterestedNotContacted(recruiterId: string, days: number = 3) {
  const result = await query(
    `SELECT
       a.application_id,
       c.full_name    AS candidate_name,
       c.email,
       jr.role_title,
       ad.notice_period_days,
       lm.sent_at     AS last_contact,
       EXTRACT(EPOCH FROM (NOW() - lm.sent_at))/86400 AS days_since_contact
     FROM applications a
     JOIN candidates c ON c.candidate_id = a.candidate_id
     JOIN job_roles jr ON jr.job_role_id = a.job_role_id
     LEFT JOIN application_details ad ON ad.application_id = a.application_id
     LEFT JOIN LATERAL (
       SELECT m.sent_at
       FROM messages m
       JOIN conversation_threads ct ON ct.thread_id = m.thread_id
       WHERE ct.application_id = a.application_id
         AND m.direction = 'outbound'
       ORDER BY m.sent_at DESC LIMIT 1
     ) lm ON TRUE
     WHERE a.recruiter_id = $1
       AND a.interest_status = 'interested'
       AND (lm.sent_at IS NULL OR lm.sent_at < NOW() - ($2 || ' days')::INTERVAL)
     ORDER BY lm.sent_at ASC NULLS FIRST`,
    [recruiterId, days]
  );
  return result.rows;
}
