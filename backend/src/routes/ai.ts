import { Router, Response } from 'express';
import { query } from '../config/database';
import { validate } from '../middleware/validate';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { GenerateReplySchema, RecruiterQuerySchema, MessageAnalysisResult, MessageAnalysisResultSchema } from '../types/schemas';
import {
  generateRecruiterReply,
  answerRecruiterQuery,
  analyzeMessage,
} from '../services/aiService';
import {
  getCandidatePipeline,
  getFollowUpsDueToday,
  getWaitingForResponse,
  getSalaryAskers,
  getInterestedNotContacted,
} from '../services/dashboardService';

const router = Router();
router.use(authMiddleware);

// POST /api/ai/generate-reply
// Given a candidate message, generate a suggested recruiter reply draft
router.post('/generate-reply', validate(GenerateReplySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { application_id, message_id } = req.body;
    const isCeo = req.recruiter?.role === 'ceo';

    // Fetch message + conversation history
    const [msgResult, historyResult] = await Promise.all([
      query(`SELECT * FROM messages WHERE message_id = $1`, [message_id]),
      query(
        `SELECT m.direction, m.message_body, m.sent_at
         FROM messages m
         JOIN conversation_threads ct ON ct.thread_id = m.thread_id
         WHERE ct.application_id = $1
         ORDER BY m.sent_at ASC LIMIT 15`,
        [application_id]
      ),
    ]);

    if (!msgResult.rows.length) {
      return res.status(404).json({ error: 'Message not found' }) as unknown as void;
    }

    // CEO can access any application; recruiters only their own
    const appResult = isCeo
      ? await query(
          `SELECT a.*, c.full_name AS candidate_name, jr.role_title,
                  r.full_name AS recruiter_name
           FROM applications a
           JOIN candidates c ON c.candidate_id = a.candidate_id
           JOIN job_roles jr ON jr.job_role_id = a.job_role_id
           JOIN recruiters r ON r.recruiter_id = a.recruiter_id
           WHERE a.application_id = $1`,
          [application_id]
        )
      : await query(
          `SELECT a.*, c.full_name AS candidate_name, jr.role_title,
                  r.full_name AS recruiter_name
           FROM applications a
           JOIN candidates c ON c.candidate_id = a.candidate_id
           JOIN job_roles jr ON jr.job_role_id = a.job_role_id
           JOIN recruiters r ON r.recruiter_id = a.recruiter_id
           WHERE a.application_id = $1 AND a.recruiter_id = $2`,
          [application_id, req.recruiter!.recruiter_id]
        );

    if (!appResult.rows.length) {
      return res.status(403).json({ error: 'Application not found or access denied' }) as unknown as void;
    }

    // ── Get or create analysis ──────────────────────────────────────────────
    // If analysis doesn't exist yet (e.g. AI timed out during inbound), run it inline
    let analysis: MessageAnalysisResult;
    const analysisResult = await query(
      `SELECT * FROM message_analyses WHERE message_id = $1`, [message_id]
    );

    const FALLBACK_ANALYSIS: MessageAnalysisResult = {
      primary_intent: 'unknown',
      detected_interest: 'unknown',
      confidence_score: 0,
      extracted_data: { questions_asked: [], interview_slots: [] },
      missing_fields: [],
      suggested_action: 'follow_up',
      suggested_action_reason: 'AI analysis unavailable — reply based on context',
    };

    if (analysisResult.rows.length) {
      // Parse DB row through schema to get properly typed object
      try {
        const row = analysisResult.rows[0];
        // extracted_data may be stored as JSON string in DB
        if (typeof row.extracted_data === 'string') {
          row.extracted_data = JSON.parse(row.extracted_data);
        }
        if (typeof row.missing_fields === 'string') {
          row.missing_fields = JSON.parse(row.missing_fields);
        }
        analysis = MessageAnalysisResultSchema.parse(row);
      } catch {
        analysis = FALLBACK_ANALYSIS;
      }
    } else {
      console.log('[AI] No analysis row for message — running inline analysis...');
      try {
        const msgBody = msgResult.rows[0].message_body as string;
        const history = historyResult.rows as Array<{ direction: string; message_body: string; sent_at: Date }>;
        const freshAnalysis = await analyzeMessage(msgBody, history);

        // Persist to DB so it's available for future calls
        await query(
          `INSERT INTO message_analyses
             (message_id, primary_intent, detected_interest, confidence_score,
              extracted_data, missing_fields, suggested_action, suggested_action_reason)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (message_id) DO UPDATE
             SET primary_intent = EXCLUDED.primary_intent,
                 detected_interest = EXCLUDED.detected_interest,
                 confidence_score = EXCLUDED.confidence_score,
                 extracted_data = EXCLUDED.extracted_data,
                 missing_fields = EXCLUDED.missing_fields,
                 suggested_action = EXCLUDED.suggested_action,
                 suggested_action_reason = EXCLUDED.suggested_action_reason`,
          [
            message_id,
            freshAnalysis.primary_intent,
            freshAnalysis.detected_interest,
            freshAnalysis.confidence_score,
            JSON.stringify(freshAnalysis.extracted_data || {}),
            JSON.stringify(freshAnalysis.missing_fields || []),
            freshAnalysis.suggested_action,
            freshAnalysis.suggested_action_reason,
          ]
        );
        analysis = freshAnalysis;
      } catch (analysisErr) {
        console.error('[AI] Inline analysis failed — using minimal fallback:', analysisErr);
        analysis = FALLBACK_ANALYSIS;
      }
    }

    // ── Missing fields ──────────────────────────────────────────────────────
    let missingFieldQuestions: string[] = [];
    try {
      const missingResult = await query(
        `SELECT fd.field_label
         FROM application_required_fields arf
         JOIN field_definitions fd ON fd.field_id = arf.field_id
         WHERE arf.application_id = $1
           AND arf.is_required = true
           AND arf.collection_status IN ('pending','asked')
         LIMIT 2`,
        [application_id]
      );
      missingFieldQuestions = missingResult.rows.map((r: { field_label: string }) => r.field_label);
    } catch {
      // Table may not exist in all environments — ignore gracefully
    }

    // ── Generate reply ──────────────────────────────────────────────────────
    const app = appResult.rows[0];

    // Coerce the DB row (or fallback object) into the strict MessageAnalysisResult type
    let typedAnalysis: MessageAnalysisResult;
    try {
      // extracted_data may be stored as a JSON string in DB
      const raw = { ...analysis };
      if (typeof raw.extracted_data === 'string') raw.extracted_data = JSON.parse(raw.extracted_data as string);
      if (typeof raw.missing_fields === 'string') raw.missing_fields = JSON.parse(raw.missing_fields as string);
      typedAnalysis = MessageAnalysisResultSchema.parse(raw);
    } catch {
      typedAnalysis = {
        primary_intent: 'unknown',
        detected_interest: 'unknown',
        confidence_score: 0,
        extracted_data: { questions_asked: [], interview_slots: [] },
        missing_fields: [],
        suggested_action: 'follow_up',
        suggested_action_reason: 'AI analysis unavailable',
      };
    }

    const draftContent = await generateRecruiterReply({
      candidateName: (app.candidate_name as string).split(' ')[0],
      candidateMessage: msgResult.rows[0].message_body as string,
      analysis: typedAnalysis,
      jobRoleTitle: app.role_title as string,
      recruiterName: app.recruiter_name as string,
      missingFieldQuestions,
      conversationHistory: historyResult.rows as Array<{ direction: string; message_body: string }>,
    });

    // ── Save draft (non-fatal if it fails) ──────────────────────────────────
    let draftRow: Record<string, unknown> | null = null;
    try {
      const threadResult = await query(
        `SELECT thread_id FROM conversation_threads WHERE application_id = $1 LIMIT 1`,
        [application_id]
      );
      const threadId = threadResult.rows[0]?.thread_id ?? null;

      const draftResult = await query(
        `INSERT INTO reply_drafts
           (application_id, thread_id, based_on_message_id, draft_type, draft_content)
         VALUES ($1,$2,$3,'ai_generated',$4) RETURNING *`,
        [application_id, threadId, message_id, draftContent]
      );
      draftRow = draftResult.rows[0] as Record<string, unknown>;
    } catch (draftErr) {
      console.error('[AI] Draft DB save failed (non-fatal):', draftErr);
    }

    res.json({
      draft: draftRow,
      draft_content: draftContent,
      missing_fields: missingFieldQuestions,
    });
  } catch (err) {
    console.error('[ai] POST /generate-reply:', err);
    res.status(500).json({ error: 'Failed to generate reply. Please try again.' });
  }
});

// POST /api/ai/recruiter-query — natural language chatbot for recruiter dashboard
router.post('/recruiter-query', validate(RecruiterQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { query: nlQuery } = req.body;
    const recruiterId = req.recruiter!.recruiter_id;
    const isCeo = req.recruiter?.role === 'ceo';

    // Fetch full pipeline data for context
    const pipeline = await getCandidatePipeline(recruiterId, isCeo);

    // Route specific queries to optimized DB functions first
    const lq = nlQuery.toLowerCase();
    let contextData: Record<string, unknown>[] = pipeline;

    if (lq.includes('follow up') || lq.includes('today')) {
      contextData = await getFollowUpsDueToday(recruiterId, isCeo);
      if (!contextData.length && !isCeo) {
        contextData = await getFollowUpsDueToday(recruiterId, true);
      }
    } else if (lq.includes('waiting') || lq.includes('response from me') || lq.includes('awaiting')) {
      contextData = await getWaitingForResponse(recruiterId, isCeo);
      if (!contextData.length && !isCeo) {
        contextData = await getWaitingForResponse(recruiterId, true);
      }
    } else if (lq.includes('salary') || lq.includes('compensation') || lq.includes('pay')) {
      contextData = await getSalaryAskers(recruiterId, isCeo);
      if (!contextData.length && !isCeo) {
        contextData = await getSalaryAskers(recruiterId, true);
      }
    } else if (lq.includes('not contacted') || lq.includes("haven't been contacted")) {
      contextData = await getInterestedNotContacted(recruiterId, 3, isCeo);
      if (!contextData.length && !isCeo) {
        contextData = await getInterestedNotContacted(recruiterId, 3, true);
      }
    } else if (lq.includes('30 day') || lq.includes('within 30')) {
      const pool = pipeline.length ? pipeline : await getCandidatePipeline(recruiterId, true);
      contextData = pool.filter(c => {
        const np = Number(c.notice_period_days);
        const interested = String(c.interest_status || '').toLowerCase() === 'interested';
        return interested && !isNaN(np) && np <= 30;
      });
    } else if (lq.includes('interview')) {
      const pool = pipeline.length ? pipeline : await getCandidatePipeline(recruiterId, true);
      contextData = pool.filter(c => {
        const text = `${c.last_message || ''} ${c.pending_task_desc || ''}`.toLowerCase();
        return text.includes('interview') || Number(c.notice_period_days) <= 30;
      });
    }

    if (!contextData.length && !isCeo) {
      contextData = await getCandidatePipeline(recruiterId, true);
    }

    const answer = await answerRecruiterQuery(nlQuery, contextData);
    res.json({ query: nlQuery, answer, candidate_count: contextData.length });
  } catch (err) {
    console.error('[ai] POST /recruiter-query:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ai/analyze-message — manually trigger analysis for a message
router.post('/analyze-message', async (req: AuthRequest, res: Response) => {
  const { message_id } = req.body as { message_id: string };
  const result = await query(`SELECT * FROM message_analyses WHERE message_id = $1`, [message_id]);
  if (result.rows.length) return res.json(result.rows[0]) as unknown as void;
  return res.status(404).json({ error: 'Analysis not found. Send the message via /api/messages/inbound first.' }) as unknown as void;
});

export default router;
