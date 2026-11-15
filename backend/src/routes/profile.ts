import { Router, Response } from 'express';
import { query } from '../config/database';
import { fresherAuthMiddleware, FresherRequest } from '../middleware/fresherAuth';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/profile/candidate
router.get('/candidate', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const [profileRes, skillsRes, projectsRes] = await Promise.all([
      query(`SELECT candidate_id, full_name, email, phone, location, linkedin_url, github_url, portfolio_url, headline, education, experience_years, created_at FROM candidates WHERE candidate_id = $1`, [candidate_id]),
      query(`SELECT skill_id, skill_name, proficiency FROM candidate_skills WHERE candidate_id = $1 ORDER BY created_at`, [candidate_id]),
      query(`SELECT project_id, title, description, technologies, repo_url, live_url, contribution FROM candidate_projects WHERE candidate_id = $1 ORDER BY created_at`, [candidate_id]),
    ]);
    if (!profileRes.rows.length) return res.status(404).json({ error: 'Candidate not found' }) as unknown as void;
    res.json({ profile: profileRes.rows[0], skills: skillsRes.rows, projects: projectsRes.rows });
  } catch (err) {
    console.error('[profile] GET /candidate:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/profile/candidate
router.put('/candidate', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const { phone, location, headline, education, experience_years, linkedin_url, github_url, portfolio_url } = req.body;
    await query(
      `UPDATE candidates SET phone=COALESCE($1,phone), location=COALESCE($2,location), headline=COALESCE($3,headline), education=COALESCE($4,education), experience_years=COALESCE($5,experience_years), linkedin_url=COALESCE($6,linkedin_url), github_url=COALESCE($7,github_url), portfolio_url=COALESCE($8,portfolio_url), updated_at=NOW() WHERE candidate_id=$9`,
      [phone, location, headline, education, experience_years, linkedin_url, github_url, portfolio_url, candidate_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[profile] PUT /candidate:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/profile/skills
router.post('/skills', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const { skill_name, proficiency } = req.body;
    if (!skill_name?.trim()) return res.status(400).json({ error: 'skill_name required' }) as unknown as void;
    const result = await query(
      `INSERT INTO candidate_skills (candidate_id, skill_name, proficiency) VALUES ($1,$2,$3) RETURNING *`,
      [candidate_id, skill_name.trim(), proficiency || 'intermediate']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[profile] POST /skills:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/profile/skills/:skillId
router.delete('/skills/:skillId', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    await query(`DELETE FROM candidate_skills WHERE skill_id=$1 AND candidate_id=$2`, [req.params.skillId, candidate_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/profile/projects
router.post('/projects', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const { title, description, technologies, repo_url, live_url, contribution } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' }) as unknown as void;
    const result = await query(
      `INSERT INTO candidate_projects (candidate_id, title, description, technologies, repo_url, live_url, contribution) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [candidate_id, title.trim(), description, technologies, repo_url, live_url, contribution]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/profile/projects/:projectId
router.delete('/projects/:projectId', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    await query(`DELETE FROM candidate_projects WHERE project_id=$1 AND candidate_id=$2`, [req.params.projectId, candidate_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/profile/apply/:jobId
router.post('/apply/:jobId', fresherAuthMiddleware, async (req: FresherRequest, res: Response) => {
  try {
    const { candidate_id } = req.candidate!;
    const { jobId } = req.params;
    const {
      phone, location, headline, education, experience_years,
      linkedin_url, github_url, portfolio_url,
      resume_filename, resume_mimetype, resume_data,
      skills, projects,
      motivation, suitability, notice_period_days, willing_to_relocate, additional_info,
    } = req.body;

    if (!linkedin_url || !linkedin_url.includes('linkedin.com')) {
      return res.status(400).json({ error: 'Valid LinkedIn URL is required' }) as unknown as void;
    }
    if (!resume_data) {
      return res.status(400).json({ error: 'Resume is required' }) as unknown as void;
    }
    const allowedMimes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (resume_mimetype && !allowedMimes.includes(resume_mimetype)) {
      return res.status(400).json({ error: 'Resume must be PDF or DOCX' }) as unknown as void;
    }
    if (resume_data.length > 7_000_000) {
      return res.status(400).json({ error: 'Resume file size must be under 5MB' }) as unknown as void;
    }

    const jobResult = await query(`SELECT job_role_id, role_title, status FROM job_roles WHERE job_role_id=$1`, [jobId]);
    if (!jobResult.rows.length) return res.status(404).json({ error: 'Job not found' }) as unknown as void;
    if (jobResult.rows[0].status !== 'active') return res.status(400).json({ error: 'Job is no longer accepting applications' }) as unknown as void;

    const existing = await query(`SELECT application_id FROM applications WHERE candidate_id=$1 AND job_role_id=$2`, [candidate_id, jobId]);
    if (existing.rows.length) return res.status(409).json({ error: 'You have already applied to this job', alreadyApplied: true }) as unknown as void;

    const recruiterResult = await query(`SELECT recruiter_id FROM recruiters LIMIT 1`);
    if (!recruiterResult.rows.length) return res.status(500).json({ error: 'No recruiter found' }) as unknown as void;
    const recruiter_id = recruiterResult.rows[0].recruiter_id;

    const appResult = await query(
      `INSERT INTO applications (candidate_id, job_role_id, recruiter_id, application_status, interest_status) VALUES ($1,$2,$3,'new','interested') RETURNING *`,
      [candidate_id, jobId, recruiter_id]
    );
    const application_id = appResult.rows[0].application_id;

    await query(
      `INSERT INTO application_submissions (application_id, full_name, email, phone, location, headline, education, experience_years, linkedin_url, github_url, portfolio_url, resume_filename, resume_mimetype, resume_data, skills_snapshot, projects_snapshot, motivation, suitability, notice_period_days, willing_to_relocate, additional_info)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [application_id, req.candidate!.full_name, req.candidate!.email, phone, location, headline, education, experience_years, linkedin_url, github_url, portfolio_url, resume_filename, resume_mimetype, resume_data, JSON.stringify(skills || []), JSON.stringify(projects || []), motivation, suitability, notice_period_days, willing_to_relocate || false, additional_info]
    );

    await query(
      `UPDATE candidates SET phone=COALESCE($1,phone), location=COALESCE($2,location), linkedin_url=COALESCE($3,linkedin_url), github_url=COALESCE($4,github_url), portfolio_url=COALESCE($5,portfolio_url), headline=COALESCE($6,headline), education=COALESCE($7,education), experience_years=COALESCE($8,experience_years), updated_at=NOW() WHERE candidate_id=$9`,
      [phone, location, linkedin_url, github_url, portfolio_url, headline, education, experience_years, candidate_id]
    );

    res.status(201).json({ application_id, message: `Successfully applied to ${jobResult.rows[0].role_title}!` });
  } catch (err) {
    console.error('[profile] POST /apply:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/profile/recruiter/jobs/:jobId/applicants
router.get('/recruiter/jobs/:jobId/applicants', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const result = await query(
      `SELECT a.application_id, a.application_status, a.applied_at, c.full_name, c.email,
         sub.headline, sub.education, sub.experience_years, sub.linkedin_url, sub.github_url,
         sub.resume_filename, sub.skills_snapshot, sub.verification_status, sub.submitted_at, jr.role_title
       FROM applications a
       JOIN candidates c ON c.candidate_id = a.candidate_id
       JOIN job_roles jr ON jr.job_role_id = a.job_role_id
       LEFT JOIN application_submissions sub ON sub.application_id = a.application_id
       WHERE a.job_role_id = $1 ORDER BY a.applied_at DESC`,
      [jobId]
    );
    res.json({ applicants: result.rows });
  } catch (err) {
    console.error('[profile] GET applicants:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/profile/recruiter/applications/:applicationId
router.get('/recruiter/applications/:applicationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { applicationId } = req.params;
    const result = await query(
      `SELECT a.application_id, a.application_status, a.applied_at, c.full_name, c.email,
         sub.submission_id, sub.phone, sub.location, sub.headline, sub.education, sub.experience_years,
         sub.linkedin_url, sub.github_url, sub.portfolio_url, sub.resume_filename, sub.resume_mimetype,
         sub.skills_snapshot, sub.projects_snapshot, sub.motivation, sub.suitability,
         sub.notice_period_days, sub.willing_to_relocate, sub.additional_info,
         sub.recruiter_notes, sub.verification_status, sub.submitted_at,
         jr.role_title, jr.employment_type, jr.department
       FROM applications a
       JOIN candidates c ON c.candidate_id = a.candidate_id
       JOIN job_roles jr ON jr.job_role_id = a.job_role_id
       LEFT JOIN application_submissions sub ON sub.application_id = a.application_id
       WHERE a.application_id = $1`,
      [applicationId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Application not found' }) as unknown as void;
    const row: Record<string, unknown> = { ...result.rows[0] };
    const hasResume = !!row.resume_data;
    delete row.resume_data;
    res.json({ application: { ...row, has_resume: hasResume } });
  } catch (err) {
    console.error('[profile] GET application detail:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/profile/recruiter/applications/:applicationId/resume
// Supports both Authorization header AND ?token= query param (for direct browser download links)
router.get('/recruiter/applications/:applicationId/resume', (req, res, next) => {
  // If no Authorization header but token query param provided, inject it
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { applicationId } = req.params;
    const result = await query(
      `SELECT sub.resume_data, sub.resume_filename, sub.resume_mimetype FROM application_submissions sub WHERE sub.application_id = $1`,
      [applicationId]
    );
    if (!result.rows.length || !result.rows[0].resume_data) {
      return res.status(404).json({ error: 'Resume not found' }) as unknown as void;
    }
    const { resume_data, resume_filename, resume_mimetype } = result.rows[0];
    const buffer = Buffer.from(resume_data as string, 'base64');
    res.set('Content-Type', (resume_mimetype as string) || 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${resume_filename || 'resume.pdf'}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[profile] GET resume:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/profile/recruiter/applications/:applicationId/status
router.patch('/recruiter/applications/:applicationId/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { applicationId } = req.params;
    const { verification_status, recruiter_notes, application_status } = req.body;
    if (verification_status) {
      await query(`UPDATE application_submissions SET verification_status=$1, updated_at=NOW() WHERE application_id=$2`, [verification_status, applicationId]);
    }
    if (recruiter_notes !== undefined) {
      await query(`UPDATE application_submissions SET recruiter_notes=$1, updated_at=NOW() WHERE application_id=$2`, [recruiter_notes, applicationId]);
    }
    if (application_status) {
      await query(`UPDATE applications SET application_status=$1, updated_at=NOW() WHERE application_id=$2`, [application_status, applicationId]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[profile] PATCH status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/profile/recruiter/all-applicants
router.get('/recruiter/all-applicants', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const isCeo = req.recruiter?.role === 'ceo';
    const recruiter_id = req.recruiter!.recruiter_id;
    const result = await query(
      `SELECT a.application_id, a.application_status, a.applied_at, c.full_name, c.email,
         sub.headline, sub.education, sub.experience_years, sub.linkedin_url, sub.github_url,
         sub.resume_filename, sub.skills_snapshot, sub.verification_status, jr.role_title
       FROM applications a
       JOIN candidates c ON c.candidate_id = a.candidate_id
       JOIN job_roles jr ON jr.job_role_id = a.job_role_id
       LEFT JOIN application_submissions sub ON sub.application_id = a.application_id
       ${isCeo ? '' : 'WHERE a.recruiter_id = $1'}
       ORDER BY a.applied_at DESC`,
      isCeo ? [] : [recruiter_id]
    );
    res.json({ applicants: result.rows });
  } catch (err) {
    console.error('[profile] GET all-applicants:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
