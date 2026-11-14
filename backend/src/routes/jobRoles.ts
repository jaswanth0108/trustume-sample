import { Router, Response } from 'express';
import { query } from '../config/database';
import { validate } from '../middleware/validate';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { CreateJobRoleSchema } from '../types/schemas';

const router = Router();
router.use(authMiddleware);

// POST /api/job-roles
router.post('/', validate(CreateJobRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const {
      role_title, department, job_description, min_experience, max_experience,
      salary_min, salary_max, currency_code, location, employment_type,
    } = req.body;
    const result = await query(
      `INSERT INTO job_roles
         (role_title, department, job_description, min_experience, max_experience,
          salary_min, salary_max, currency_code, location, employment_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [role_title, department, job_description, min_experience, max_experience,
       salary_min, salary_max, currency_code, location, employment_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[job-roles] POST /:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/job-roles
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(`SELECT * FROM job_roles WHERE status = 'active' ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('[job-roles] GET /:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/job-roles/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`SELECT * FROM job_roles WHERE job_role_id = $1`, [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Job role not found' }) as unknown as void;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[job-roles] GET /:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/job-roles/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body as { status: string };
    const result = await query(
      `UPDATE job_roles SET status = $1 WHERE job_role_id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Job role not found' }) as unknown as void;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[job-roles] PATCH /:id/status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
