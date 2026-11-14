import { query } from '../config/database';
import { analyzeMessage, generateFieldQuestion } from './aiService';
import { MessageAnalysisResult } from '../types/schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Process a new inbound message end-to-end:
//  1. Store message
//  2. Fetch conversation history
//  3. AI classify & extract
//  4. Validate / fallback
//  5. Store analysis
//  6. Update application_field_answers
//  7. Update application interest_status
//  8. Create / update follow_up_tasks
//  9. If fields missing → generate follow-up questions
// 10. Return full result for the API response
// ─────────────────────────────────────────────────────────────────────────────
export async function processInboundMessage(opts: {
  applicationId: string;
  threadId: string;
  messageBody: string;
  senderEmail?: string;
  externalMessageId?: string;
  replyToMessageId?: string;
}) {
  const {
    applicationId,
    threadId,
    messageBody,
    senderEmail,
    externalMessageId,
    replyToMessageId,
  } = opts;

  // ── 1. Store message ──────────────────────────────────────────────────────
  const msgResult = await query(
    `INSERT INTO messages
       (thread_id, direction, sender_type, sender_email, message_body,
        external_message_id, reply_to_message_id)
     VALUES ($1,'inbound','candidate',$2,$3,$4,$5)
     RETURNING *`,
    [threadId, senderEmail, messageBody, externalMessageId, replyToMessageId]
  );
  const message = msgResult.rows[0];

  // Update thread last_message_at
  await query(
    `UPDATE conversation_threads SET last_message_at = NOW(), thread_status = 'awaiting_recruiter' WHERE thread_id = $1`,
    [threadId]
  );

  // ── 2. Retrieve conversation history ──────────────────────────────────────
  const historyResult = await query(
    `SELECT m.direction, m.message_body, m.sent_at
     FROM messages m
     JOIN conversation_threads ct ON ct.thread_id = m.thread_id
     WHERE ct.application_id = $1
     ORDER BY m.sent_at ASC
     LIMIT 20`,
    [applicationId]
  );
  const history = historyResult.rows;

  // ── 3. AI classify & extract ──────────────────────────────────────────────
  const analysis: MessageAnalysisResult = await analyzeMessage(messageBody, history);

  // ── 4 & 5. Store analysis ─────────────────────────────────────────────────
  const analysisResult = await query(
    `INSERT INTO message_analyses
       (message_id, model_name, primary_intent, detected_interest,
        confidence_score, extracted_data, analysis_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      message.message_id,
      'gemini-3.8-flash',
      analysis.primary_intent,
      analysis.detected_interest,
      analysis.confidence_score,
      JSON.stringify(analysis.extracted_data),
      'completed',
    ]
  );
  const storedAnalysis = analysisResult.rows[0];

  // ── 6. Update application_field_answers ───────────────────────────────────
  const fieldMap: Record<string, { column: string; value: unknown; type: 'text' | 'number' | 'date' }> = {
    notice_period_days:  { column: 'normalized_number', value: analysis.extracted_data.notice_period_days,  type: 'number' },
    current_role_title:  { column: 'normalized_text',   value: analysis.extracted_data.current_role,         type: 'text'   },
    current_company:     { column: 'normalized_text',   value: analysis.extracted_data.current_company,      type: 'text'   },
    experience_years:    { column: 'normalized_number', value: analysis.extracted_data.experience_years,     type: 'number' },
    expected_salary:     { column: 'normalized_number', value: analysis.extracted_data.expected_salary,      type: 'number' },
    current_salary:      { column: 'normalized_number', value: analysis.extracted_data.current_salary,       type: 'number' },
    available_from:      { column: 'normalized_date',   value: analysis.extracted_data.available_from,       type: 'date'   },
    preferred_location:  { column: 'normalized_text',   value: analysis.extracted_data.preferred_location,   type: 'text'   },
  };

  for (const [fieldKey, { value }] of Object.entries(fieldMap)) {
    if (value === null || value === undefined) continue;

    const fieldRes = await query(
      `SELECT field_id FROM field_definitions WHERE field_key = $1 AND is_active = true`,
      [fieldKey]
    );
    if (!fieldRes.rows.length) continue;
    const fieldId = fieldRes.rows[0].field_id;

    // Mark old answers as not current
    await query(
      `UPDATE application_field_answers SET is_current = false
       WHERE application_id = $1 AND field_id = $2`,
      [applicationId, fieldId]
    );

    // Insert new answer
    await query(
      `INSERT INTO application_field_answers
         (application_id, field_id, raw_answer, normalized_text, normalized_number, normalized_date,
          source_message_id, analysis_id, confidence_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        applicationId,
        fieldId,
        String(value),
        typeof value === 'string' ? value : null,
        typeof value === 'number' ? value : null,
        typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/) ? value : null,
        message.message_id,
        storedAnalysis.analysis_id,
        analysis.confidence_score,
      ]
    );

    // Update collection status
    await query(
      `UPDATE application_required_fields
       SET collection_status = 'answered', answered_at = NOW()
       WHERE application_id = $1 AND field_id = $2`,
      [applicationId, fieldId]
    );
  }

  // ── 7. Update application interest_status ─────────────────────────────────
  const interestMap: Record<string, string> = {
    interested:    'interested',
    not_interested:'not_interested',
  };
  const newInterest = interestMap[analysis.primary_intent];
  if (newInterest) {
    await query(
      `UPDATE applications SET interest_status = $1, updated_at = NOW() WHERE application_id = $2`,
      [newInterest, applicationId]
    );
  }

  // ── 8. Store candidate questions ──────────────────────────────────────────
  if (analysis.extracted_data.questions_asked?.length) {
    for (const q of analysis.extracted_data.questions_asked) {
      await query(
        `INSERT INTO candidate_questions
           (application_id, source_message_id, question_category, question_text)
         VALUES ($1,$2,$3,$4)`,
        [applicationId, message.message_id, q.category, q.question_text]
      );
    }
  }

  // ── 9. Create follow_up_task based on suggested action ───────────────────
  const appResult = await query(
    `SELECT a.recruiter_id, c.full_name AS candidate_name
     FROM applications a JOIN candidates c ON c.candidate_id = a.candidate_id
     WHERE a.application_id = $1`,
    [applicationId]
  );
  const app = appResult.rows[0];
  if (app && analysis.suggested_action !== 'no_action') {
    const dueAt = new Date();
    if (analysis.suggested_action === 'follow_up') {
      dueAt.setHours(dueAt.getHours() + 24);
    } else {
      dueAt.setHours(dueAt.getHours() + 4);
    }

    await query(
      `INSERT INTO follow_up_tasks
         (application_id, recruiter_id, task_type, task_description, priority, due_at, source_message_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        applicationId,
        app.recruiter_id,
        analysis.suggested_action === 'schedule_interview' ? 'schedule_interview'
          : analysis.suggested_action === 'share_salary' ? 'share_salary'
          : analysis.suggested_action === 'share_jd' ? 'share_jd'
          : analysis.suggested_action === 'close_application' ? 'close_application'
          : 'send_follow_up',
        `${app.candidate_name}: ${analysis.suggested_action_reason}`,
        analysis.detected_interest === 'high' ? 'high' : 'medium',
        dueAt.toISOString(),
        message.message_id,
      ]
    );
  }

  // ── 10. Identify missing required fields → note them ─────────────────────
  const missingRequired = await query(
    `SELECT fd.field_key, fd.field_label, fd.default_question
     FROM application_required_fields arf
     JOIN field_definitions fd ON fd.field_id = arf.field_id
     WHERE arf.application_id = $1
       AND arf.is_required = true
       AND arf.collection_status IN ('pending','asked')`,
    [applicationId]
  );

  return {
    message,
    analysis,
    storedAnalysis,
    missingRequiredFields: missingRequired.rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap required fields for a new application
// ─────────────────────────────────────────────────────────────────────────────
export async function bootstrapRequiredFields(applicationId: string) {
  const fields = await query(
    `SELECT field_id FROM field_definitions WHERE default_required = true AND is_active = true`
  );
  for (const f of fields.rows) {
    await query(
      `INSERT INTO application_required_fields (application_id, field_id)
       VALUES ($1, $2) ON CONFLICT (application_id, field_id) DO NOTHING`,
      [applicationId, f.field_id]
    );
  }
}
