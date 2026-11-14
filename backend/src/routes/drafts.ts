import { Router, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/drafts — list pending drafts for recruiter
router.get('/', async (req: AuthRequest, res: Response) => {
  const result = await query(
    `SELECT rd.*, c.full_name AS candidate_name, jr.role_title
     FROM reply_drafts rd
     JOIN applications a ON a.application_id = rd.application_id
     JOIN candidates   c ON c.candidate_id   = a.candidate_id
     JOIN job_roles   jr ON jr.job_role_id   = a.job_role_id
     WHERE a.recruiter_id = $1 AND rd.draft_status = 'pending'
     ORDER BY rd.created_at DESC`,
    [req.recruiter!.recruiter_id]
  );
  res.json(result.rows);
});

// GET /api/drafts/:draftId
router.get('/:draftId', async (req: AuthRequest, res: Response) => {
  const result = await query(
    `SELECT rd.* FROM reply_drafts rd
     JOIN applications a ON a.application_id = rd.application_id
     WHERE rd.draft_id = $1 AND a.recruiter_id = $2`,
    [req.params.draftId, req.recruiter!.recruiter_id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Draft not found' }) as unknown as void;
  res.json(result.rows[0]);
});

// PATCH /api/drafts/:draftId — recruiter edits the AI draft
router.patch('/:draftId', async (req: AuthRequest, res: Response) => {
  const { draft_content, subject } = req.body as { draft_content?: string; subject?: string };
  const result = await query(
    `UPDATE reply_drafts
     SET draft_content = COALESCE($1, draft_content),
         subject       = COALESCE($2, subject),
         draft_status  = 'reviewed',
         reviewed_by   = $3
     WHERE draft_id = $4 RETURNING *`,
    [draft_content, subject, req.recruiter!.recruiter_id, req.params.draftId]
  );
  res.json(result.rows[0]);
});

// DELETE /api/drafts/:draftId — discard draft
router.delete('/:draftId', async (req: AuthRequest, res: Response) => {
  await query(
    `UPDATE reply_drafts SET draft_status = 'discarded' WHERE draft_id = $1`, [req.params.draftId]
  );
  res.json({ message: 'Draft discarded' });
});

export default router;
