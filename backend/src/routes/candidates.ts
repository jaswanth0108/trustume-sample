import { Router, Response } from 'express';
import { query } from '../config/database';
import { validate } from '../middleware/validate';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { CreateCandidateSchema } from '../types/schemas';

const router = Router();
router.use(authMiddleware);

// POST /api/candidates  — create candidate
router.post('/', validate(CreateCandidateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { full_name, email, phone, location, linkedin_url } = req.body;
    const result = await query(
      `INSERT INTO candidates (full_name, email, phone, location, linkedin_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [full_name, email, phone, location, linkedin_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === '23505') {
      return res.status(409).json({ error: 'Candidate with this email already exists' }) as unknown as void;
    }
    console.error('[candidates] POST /:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/candidates  — list all candidates visible to this recruiter
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT DISTINCT c.*
       FROM candidates c
       JOIN applications a ON a.candidate_id = c.candidate_id
       WHERE a.recruiter_id = $1
       ORDER BY c.created_at DESC`,
      [req.recruiter!.recruiter_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[candidates] GET /:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/candidates/:id  — single candidate with their applications
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [candResult, appsResult] = await Promise.all([
      query(`SELECT * FROM candidates WHERE candidate_id = $1`, [id]),
      query(
        `SELECT a.*, jr.role_title, ad.*
         FROM applications a
         JOIN job_roles jr ON jr.job_role_id = a.job_role_id
         LEFT JOIN application_details ad ON ad.application_id = a.application_id
         WHERE a.candidate_id = $1 AND a.recruiter_id = $2`,
        [id, req.recruiter!.recruiter_id]
      ),
    ]);
    if (!candResult.rows.length) {
      return res.status(404).json({ error: 'Candidate not found' }) as unknown as void;
    }
    res.json({ candidate: candResult.rows[0], applications: appsResult.rows });
  } catch (err) {
    console.error('[candidates] GET /:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
