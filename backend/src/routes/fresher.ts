import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { fresherAuthMiddleware, FresherRequest } from '../middleware/fresherAuth';

const router = Router();

// ─── POST /api/fresher/register ───────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { full_name, email, password, phone, location } = req.body;
    if (!full_name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' }) as unknown as void;
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' }) as unknown as void;
    }
    // Check if email already exists
    const existing = await query(`SELECT candidate_id FROM candidates WHERE email = $1`, [email.toLowerCase().trim()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists' }) as unknown as void;
    }
    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO candidates (full_name, email, phone, location, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING candidate_id, full_name, email, phone, location`,
      [full_name.trim(), email.toLowerCase().trim(), phone || null, location || null, password_hash]
    );
    const candidate = result.rows[0];
    const token = jwt.sign(
      { candidate_id: candidate.candidate_id, email: candidate.email, full_name: candidate.full_name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    res.status(201).json({ candidate, token });
  } catch (err) {
    console.error('[Fresher] Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/fresher/login ───────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' }) as unknown as void;
    }
    const result = await query(
      `SELECT candidate_id, full_name, email, phone, location, password_hash FROM candidates WHERE email = $1`,
      [email]
    );
    const candidate = result.rows[0];
    if (!candidate || !candidate.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' }) as unknown as void;
    }
    const passwordMatch = await bcrypt.compare(password, candidate.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' }) as unknown as void;
    }
    const token = jwt.sign(
      { candidate_id: candidate.candidate_id, email: candidate.email, full_name: candidate.full_name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    res.json({
      candidate: {
        candidate_id: candidate.candidate_id,
        full_name: candidate.full_name,
        email: candidate.email,
        phone: candidate.phone,
        location: candidate.location,
      },
      token,
    });
  } catch (err) {
    console.error('[Fresher] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/fresher/profile ──────────────────────────────────────────────
router.get('/profile', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const result = await query(
      `SELECT candidate_id, full_name, email, phone, location, linkedin_url, created_at FROM candidates WHERE candidate_id = $1`,
      [candidate_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Candidate not found' }) as unknown as void;
    res.json({ candidate: result.rows[0] });
  } catch (err) {
    console.error('[Fresher] Profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/fresher/applications ────────────────────────────────────────
router.get('/applications', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const result = await query(
      `SELECT
         a.application_id,
         a.application_status,
         a.interest_status,
         a.applied_at,
         a.updated_at,
         j.job_role_id,
         j.role_title,
         j.department,
         j.location AS job_location,
         j.salary_min,
         j.salary_max,
         j.currency_code,
         j.employment_type,
         r.full_name    AS recruiter_name,
         r.email        AS recruiter_email,
         ad.notice_period_days,
         ad.experience_years,
         ad.expected_salary,
         ad.current_role_title,
         ad.current_company,
         t.thread_id,
         t.thread_status,
         t.last_message_at,
         (SELECT m.message_body FROM messages m WHERE m.thread_id = t.thread_id ORDER BY m.sent_at DESC LIMIT 1) AS latest_message,
         (SELECT m.direction   FROM messages m WHERE m.thread_id = t.thread_id ORDER BY m.sent_at DESC LIMIT 1) AS latest_direction,
         (SELECT m.sent_at     FROM messages m WHERE m.thread_id = t.thread_id ORDER BY m.sent_at DESC LIMIT 1) AS latest_sent_at
       FROM applications a
       JOIN job_roles j ON a.job_role_id = j.job_role_id
       JOIN recruiters r ON a.recruiter_id = r.recruiter_id
       LEFT JOIN application_details ad ON a.application_id = ad.application_id
       LEFT JOIN conversation_threads t ON t.application_id = a.application_id
       WHERE a.candidate_id = $1
       ORDER BY a.updated_at DESC`,
      [candidate_id]
    );
    res.json({ applications: result.rows });
  } catch (err) {
    console.error('[Fresher] Applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/fresher/applications/:applicationId/messages ────────────────
router.get('/applications/:applicationId/messages', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const { applicationId } = req.params;

    // Verify application belongs to this candidate
    const appCheck = await query(
      `SELECT a.application_id, j.role_title, r.full_name AS recruiter_name,
              a.application_status, a.interest_status, t.thread_id
       FROM applications a
       JOIN job_roles j ON a.job_role_id = j.job_role_id
       JOIN recruiters r ON a.recruiter_id = r.recruiter_id
       LEFT JOIN conversation_threads t ON t.application_id = a.application_id
       WHERE a.application_id = $1 AND a.candidate_id = $2`,
      [applicationId, candidate_id]
    );
    if (!appCheck.rows[0]) {
      return res.status(404).json({ error: 'Application not found' }) as unknown as void;
    }
    const app = appCheck.rows[0];
    if (!app.thread_id) {
      return res.json({ application: app, messages: [] });
    }

    const messages = await query(
      `SELECT message_id, direction, sender_type, sender_email, message_body, sent_at
       FROM messages WHERE thread_id = $1 ORDER BY sent_at ASC`,
      [app.thread_id]
    );
    res.json({ application: app, messages: messages.rows });
  } catch (err) {
    console.error('[Fresher] Messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/fresher/applications/:applicationId/reply ──────────────────
router.post('/applications/:applicationId/reply', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id, email } = req.candidate!;
    const { applicationId } = req.params;
    const { message_body } = req.body;

    if (!message_body?.trim()) {
      return res.status(400).json({ error: 'Message body is required' }) as unknown as void;
    }

    // Verify application belongs to this candidate
    const appCheck = await query(
      `SELECT a.application_id, t.thread_id FROM applications a
       LEFT JOIN conversation_threads t ON t.application_id = a.application_id
       WHERE a.application_id = $1 AND a.candidate_id = $2`,
      [applicationId, candidate_id]
    );
    if (!appCheck.rows[0]) {
      return res.status(404).json({ error: 'Application not found' }) as unknown as void;
    }

    let { thread_id } = appCheck.rows[0];

    // Create thread if none exists
    if (!thread_id) {
      const threadRes = await query(
        `INSERT INTO conversation_threads (application_id, channel, thread_status)
         VALUES ($1,'email','open') RETURNING thread_id`,
        [applicationId]
      );
      thread_id = threadRes.rows[0].thread_id;
    }

    // Insert the message
    const msgRes = await query(
      `INSERT INTO messages (thread_id, direction, sender_type, sender_email, message_body)
       VALUES ($1,'inbound','candidate',$2,$3) RETURNING *`,
      [thread_id, email, message_body.trim()]
    );

    // Update thread and application timestamps
    await query(`UPDATE conversation_threads SET last_message_at = NOW(), thread_status = 'awaiting_recruiter' WHERE thread_id = $1`, [thread_id]);
    await query(`UPDATE applications SET updated_at = NOW() WHERE application_id = $1`, [applicationId]);

    res.status(201).json({ message: msgRes.rows[0] });
  } catch (err) {
    console.error('[Fresher] Reply error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/fresher/applied-jobs — returns job IDs the candidate applied to ─
router.get('/applied-jobs', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const result = await query(
      `SELECT job_role_id FROM applications WHERE candidate_id = $1`,
      [candidate_id]
    );
    const appliedJobIds = result.rows.map(r => r.job_role_id as string);
    res.json({ appliedJobIds });
  } catch (err) {
    console.error('[Fresher] Applied jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/fresher/jobs — browse all active job listings ───────────────
router.get('/jobs', async (_req, res: Response) => {
  try {
    const result = await query(
      `SELECT
         job_role_id,
         role_title,
         department,
         job_description,
         min_experience,
         max_experience,
         salary_min,
         salary_max,
         currency_code,
         location,
         employment_type,
         status,
         created_at
       FROM job_roles
       WHERE status = 'active'
       ORDER BY created_at DESC`
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    console.error('[Fresher] Jobs list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/fresher/jobs/:jobId — get one job detail ───────────────────
router.get('/jobs/:jobId', async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM job_roles WHERE job_role_id = $1 AND status = 'active'`,
      [req.params.jobId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Job not found or no longer available' }) as unknown as void;
    }
    res.json({ job: result.rows[0] });
  } catch (err) {
    console.error('[Fresher] Job detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/fresher/jobs/:jobId/apply ─────────────────────────────────
router.post('/jobs/:jobId/apply', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const { jobId } = req.params;

    // 1. Verify job exists and is active
    const jobResult = await query(
      `SELECT job_role_id, role_title, status FROM job_roles WHERE job_role_id = $1`,
      [jobId]
    );
    if (!jobResult.rows.length) {
      return res.status(404).json({ error: 'Job not found' }) as unknown as void;
    }
    const job = jobResult.rows[0];
    if (job.status !== 'active') {
      return res.status(400).json({ error: 'This job is no longer accepting applications' }) as unknown as void;
    }

    // 2. Check if already applied
    const existing = await query(
      `SELECT application_id FROM applications WHERE candidate_id = $1 AND job_role_id = $2`,
      [candidate_id, jobId]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'You have already applied for this job', alreadyApplied: true }) as unknown as void;
    }

    // 3. Find any recruiter to associate (required by applications table FK)
    const recruiterResult = await query(
      `SELECT recruiter_id FROM recruiters WHERE role = 'recruiter' OR role IS NULL ORDER BY created_at ASC LIMIT 1`
    );
    if (!recruiterResult.rows.length) {
      return res.status(500).json({ error: 'No recruiter available' }) as unknown as void;
    }
    const recruiter_id = recruiterResult.rows[0].recruiter_id;

    // 4. Create application
    const appResult = await query(
      `INSERT INTO applications
         (candidate_id, job_role_id, recruiter_id, application_status, interest_status)
       VALUES ($1, $2, $3, 'new', 'interested')
       RETURNING *`,
      [candidate_id, jobId, recruiter_id]
    );

    res.status(201).json({ application: appResult.rows[0], message: `Successfully applied to ${job.role_title}!` });
  } catch (err) {
    console.error('[Fresher] Apply error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
