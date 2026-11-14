import { Router, Response } from 'express';
import { query } from '../config/database';
import { validate } from '../middleware/validate';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { CreateApplicationSchema } from '../types/schemas';
import { bootstrapRequiredFields } from '../services/messageService';

const router = Router();
router.use(authMiddleware);

// POST /api/applications — recruiter creates an application (sends job proposal)
router.post('/', validate(CreateApplicationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { candidate_id, job_role_id } = req.body;
    const recruiter_id = req.recruiter!.recruiter_id;

    const appResult = await query(
      `INSERT INTO applications (candidate_id, job_role_id, recruiter_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [candidate_id, job_role_id, recruiter_id]
    );
    const application = appResult.rows[0];

    await query(
      `INSERT INTO application_details (application_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [application.application_id]
    );

    const threadResult = await query(
      `INSERT INTO conversation_threads (application_id, channel) VALUES ($1,'email') RETURNING *`,
      [application.application_id]
    );

    await bootstrapRequiredFields(application.application_id);

    res.status(201).json({
      application,
      thread: threadResult.rows[0],
    });
  } catch (err) {
    console.error('[applications] POST /:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/applications — list all applications for this recruiter
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
         a.*,
         c.full_name   AS candidate_name,
         c.email       AS candidate_email,
         c.phone,
         jr.role_title,
         jr.department,
         ad.notice_period_days,
         ad.experience_years,
         ad.expected_salary,
         ad.available_from
       FROM applications a
       JOIN candidates   c  ON c.candidate_id  = a.candidate_id
       JOIN job_roles    jr ON jr.job_role_id  = a.job_role_id
       LEFT JOIN application_details ad ON ad.application_id = a.application_id
       WHERE a.recruiter_id = $1
       ORDER BY a.updated_at DESC`,
      [req.recruiter!.recruiter_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[applications] GET /:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/applications/:id — single application with full details (includes thread_id)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [appResult, fieldsResult, questionsResult] = await Promise.all([
      query(
        `SELECT a.*, c.full_name AS candidate_name, c.email AS candidate_email,
                jr.role_title, ad.*,
                ct.thread_id, ct.channel, ct.thread_status, ct.last_message_at
         FROM applications a
         JOIN candidates c ON c.candidate_id = a.candidate_id
         JOIN job_roles jr ON jr.job_role_id = a.job_role_id
         LEFT JOIN application_details ad ON ad.application_id = a.application_id
         LEFT JOIN conversation_threads ct ON ct.application_id = a.application_id
         WHERE a.application_id = $1 AND a.recruiter_id = $2
         LIMIT 1`,
        [req.params.id, req.recruiter!.recruiter_id]
      ),
      query(
        `SELECT fd.field_key, fd.field_label, arf.collection_status,
                afa.normalized_text, afa.normalized_number, afa.normalized_date, afa.confidence_score
         FROM application_required_fields arf
         JOIN field_definitions fd ON fd.field_id = arf.field_id
         LEFT JOIN application_field_answers afa
           ON afa.application_id = arf.application_id AND afa.field_id = arf.field_id AND afa.is_current = true
         WHERE arf.application_id = $1`,
        [req.params.id]
      ),
      query(
        `SELECT * FROM candidate_questions WHERE application_id = $1 ORDER BY created_at ASC`,
        [req.params.id]
      ),
    ]);

    if (!appResult.rows.length) {
      return res.status(404).json({ error: 'Application not found' }) as unknown as void;
    }
    res.json({
      application: appResult.rows[0],
      collected_fields: fieldsResult.rows,
      candidate_questions: questionsResult.rows,
    });
  } catch (err) {
    console.error('[applications] GET /:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/applications/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { application_status } = req.body as { application_status: string };
    const result = await query(
      `UPDATE applications SET application_status = $1, updated_at = NOW()
       WHERE application_id = $2 AND recruiter_id = $3 RETURNING *`,
      [application_status, req.params.id, req.recruiter!.recruiter_id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Application not found' }) as unknown as void;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[applications] PATCH /:id/status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
