import { Router, Response } from 'express';
import { query } from '../config/database';
import { validate } from '../middleware/validate';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { GenerateReplySchema, RecruiterQuerySchema } from '../types/schemas';
import {
  generateRecruiterReply,
  answerRecruiterQuery,
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
  const { application_id, message_id } = req.body;

  // Fetch message, analysis, application context
  const [msgResult, appResult, historyResult] = await Promise.all([
    query(`SELECT * FROM messages WHERE message_id = $1`, [message_id]),
    query(
      `SELECT a.*, c.full_name AS candidate_name, jr.role_title,
              r.full_name AS recruiter_name
       FROM applications a
       JOIN candidates c ON c.candidate_id = a.candidate_id
       JOIN job_roles jr ON jr.job_role_id = a.job_role_id
       JOIN recruiters r ON r.recruiter_id = a.recruiter_id
       WHERE a.application_id = $1 AND a.recruiter_id = $2`,
      [application_id, req.recruiter!.recruiter_id]
    ),
    query(
      `SELECT m.direction, m.message_body
       FROM messages m
       JOIN conversation_threads ct ON ct.thread_id = m.thread_id
       WHERE ct.application_id = $1
       ORDER BY m.sent_at ASC LIMIT 15`,
      [application_id]
    ),
  ]);

  if (!msgResult.rows.length) return res.status(404).json({ error: 'Message not found' }) as unknown as void;
  if (!appResult.rows.length) return res.status(403).json({ error: 'Application not found or access denied' }) as unknown as void;

  const analysisResult = await query(
    `SELECT * FROM message_analyses WHERE message_id = $1`, [message_id]
  );
  const analysis = analysisResult.rows[0];
  if (!analysis) return res.status(404).json({ error: 'Message not yet analysed' }) as unknown as void;

  // Get missing fields that need to be asked
  const missingResult = await query(
    `SELECT fd.field_label, fd.default_question
     FROM application_required_fields arf
     JOIN field_definitions fd ON fd.field_id = arf.field_id
     WHERE arf.application_id = $1
       AND arf.is_required = true
       AND arf.collection_status IN ('pending','asked')
     LIMIT 2`,
    [application_id]
  );
  const missingFieldQuestions = missingResult.rows.map((r: { field_label: string; default_question: string }) => r.field_label);

  const app = appResult.rows[0];
  const draftContent = await generateRecruiterReply({
    candidateName: app.candidate_name.split(' ')[0],
    candidateMessage: msgResult.rows[0].message_body,
    analysis: { ...analysis, extracted_data: analysis.extracted_data || {} },
    jobRoleTitle: app.role_title,
    recruiterName: app.recruiter_name,
    missingFieldQuestions,
    conversationHistory: historyResult.rows,
  });

  // Save draft
  const threadResult = await query(
    `SELECT thread_id FROM conversation_threads WHERE application_id = $1 LIMIT 1`, [application_id]
  );
  const threadId = threadResult.rows[0]?.thread_id;

  const draftResult = await query(
    `INSERT INTO reply_drafts
       (application_id, thread_id, based_on_message_id, draft_type, draft_content)
     VALUES ($1,$2,$3,'ai_generated',$4) RETURNING *`,
    [application_id, threadId, message_id, draftContent]
  );

  res.json({
    draft: draftResult.rows[0],
    missing_fields: missingResult.rows,
  });
});

// POST /api/ai/recruiter-query — natural language chatbot for recruiter dashboard
router.post('/recruiter-query', validate(RecruiterQuerySchema), async (req: AuthRequest, res: Response) => {
  const { query: nlQuery } = req.body;
  const recruiterId = req.recruiter!.recruiter_id;

  // Fetch full pipeline data for context
  const pipeline = await getCandidatePipeline(recruiterId);

  // Route specific queries to optimized DB functions first
  const lq = nlQuery.toLowerCase();
  let contextData = pipeline;

  if (lq.includes('follow up') || lq.includes('today')) {
    contextData = await getFollowUpsDueToday(recruiterId);
  } else if (lq.includes('waiting') || lq.includes('response from me')) {
    contextData = await getWaitingForResponse(recruiterId);
  } else if (lq.includes('salary')) {
    contextData = await getSalaryAskers(recruiterId);
  } else if (lq.includes('not contacted') || lq.includes("haven't been contacted")) {
    contextData = await getInterestedNotContacted(recruiterId);
  }

  const answer = await answerRecruiterQuery(nlQuery, contextData);
  res.json({ query: nlQuery, answer, candidate_count: contextData.length });
});

// POST /api/ai/analyze-message — manually trigger analysis for a message
router.post('/analyze-message', async (req: AuthRequest, res: Response) => {
  const { message_id } = req.body as { message_id: string };
  const result = await query(`SELECT * FROM message_analyses WHERE message_id = $1`, [message_id]);
  if (result.rows.length) return res.json(result.rows[0]) as unknown as void;
  return res.status(404).json({ error: 'Analysis not found. Send the message via /api/messages/inbound first.' }) as unknown as void;
});

export default router;
