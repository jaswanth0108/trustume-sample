import { Router, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  getCandidatePipeline,
  getFollowUpsDueToday,
  getWaitingForResponse,
  getSalaryAskers,
  getInterestedNotContacted,
} from '../services/dashboardService';

const router = Router();
router.use(authMiddleware);

// GET /api/dashboard/triage — full recruiter triage dashboard
router.get('/triage', async (req: AuthRequest, res: Response) => {
  try {
    const recruiterId = req.recruiter!.recruiter_id;
    const pipeline = await getCandidatePipeline(recruiterId);

    const groups = {
      interested:     pipeline.filter((c: { interest_status: string }) => c.interest_status === 'interested'),
      unknown:        pipeline.filter((c: { interest_status: string }) => c.interest_status === 'unknown'),
      not_interested: pipeline.filter((c: { interest_status: string }) => c.interest_status === 'not_interested'),
      no_response:    pipeline.filter((c: { interest_status: string }) => c.interest_status === 'no_response'),
      maybe:          pipeline.filter((c: { interest_status: string }) => c.interest_status === 'maybe'),
    };

    res.json({ total: pipeline.length, groups, all: pipeline });
  } catch (err) {
    console.error('[dashboard] GET /triage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/follow-ups — tasks due today
router.get('/follow-ups', async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await getFollowUpsDueToday(req.recruiter!.recruiter_id);
    res.json({ count: tasks.length, tasks });
  } catch (err) {
    console.error('[dashboard] GET /follow-ups:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/waiting-response — candidates awaiting recruiter reply
router.get('/waiting-response', async (req: AuthRequest, res: Response) => {
  try {
    const candidates = await getWaitingForResponse(req.recruiter!.recruiter_id);
    res.json({ count: candidates.length, candidates });
  } catch (err) {
    console.error('[dashboard] GET /waiting-response:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/salary-queries — candidates who asked about salary
router.get('/salary-queries', async (req: AuthRequest, res: Response) => {
  try {
    const candidates = await getSalaryAskers(req.recruiter!.recruiter_id);
    res.json({ count: candidates.length, candidates });
  } catch (err) {
    console.error('[dashboard] GET /salary-queries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/not-contacted?days=3 — interested, not contacted in N days
router.get('/not-contacted', async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt((req.query.days as string) || '3', 10);
    const candidates = await getInterestedNotContacted(req.recruiter!.recruiter_id, days);
    res.json({ count: candidates.length, days, candidates });
  } catch (err) {
    console.error('[dashboard] GET /not-contacted:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/stats — summary numbers
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
         COUNT(*)                                                              AS total,
         COUNT(*) FILTER (WHERE interest_status = 'interested')               AS interested,
         COUNT(*) FILTER (WHERE interest_status = 'not_interested')           AS not_interested,
         COUNT(*) FILTER (WHERE interest_status = 'unknown')                  AS unknown,
         COUNT(*) FILTER (WHERE application_status = 'interview')             AS in_interview,
         COUNT(*) FILTER (WHERE application_status = 'offer')                 AS offer_stage
       FROM applications WHERE recruiter_id = $1
         AND application_status NOT IN ('hired','rejected','closed')`,
      [req.recruiter!.recruiter_id]
    );
    const followUpsResult = await query(
      `SELECT COUNT(*) AS due_today FROM follow_up_tasks
       WHERE recruiter_id = $1 AND task_status = 'pending'
         AND due_at <= NOW() + INTERVAL '24 hours'`,
      [req.recruiter!.recruiter_id]
    );
    res.json({ ...result.rows[0], follow_ups_due_today: followUpsResult.rows[0].due_today });
  } catch (err) {
    console.error('[dashboard] GET /stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/dashboard/follow-ups/:taskId — update task status
router.patch('/follow-ups/:taskId', async (req: AuthRequest, res: Response) => {
  try {
    const { task_status } = req.body as { task_status: string };
    const result = await query(
      `UPDATE follow_up_tasks
       SET task_status = $1,
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE NULL END
       WHERE task_id = $2 AND recruiter_id = $3 RETURNING *`,
      [task_status, req.params.taskId, req.recruiter!.recruiter_id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Task not found' }) as unknown as void;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[dashboard] PATCH /follow-ups/:taskId:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
