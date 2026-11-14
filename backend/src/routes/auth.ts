import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { validate } from '../middleware/validate';
import { LoginSchema, CreateRecruiterSchema } from '../types/schemas';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(CreateRecruiterSchema), async (req: Request, res: Response) => {
  try {
    const { full_name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO recruiters (full_name, email, password_hash) VALUES ($1,$2,$3) RETURNING recruiter_id, full_name, email, created_at`,
      [full_name, email, hash]
    );
    const recruiter = result.rows[0];
    const token = jwt.sign(
      { recruiter_id: recruiter.recruiter_id, email: recruiter.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
    );
    res.status(201).json({ recruiter, token });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === '23505') return res.status(409).json({ error: 'Email already exists' }) as unknown as void;
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login - single implementation with detailed logging
router.post('/login', validate(LoginSchema), async (req: Request, res: Response) => {
  console.log('Login request received:', { body: req.body });
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      console.warn('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' }) as unknown as void;
    }
    const result = await query(
      `SELECT recruiter_id, full_name, email, password_hash FROM recruiters WHERE email = $1`,
      [email]
    );
    const recruiter = result.rows[0];
    if (!recruiter) {
      console.warn('Recruiter not found for email:', email);
      return res.status(401).json({ error: 'Invalid email or password' }) as unknown as void;
    }
    const passwordMatch = await bcrypt.compare(password, recruiter.password_hash);
    if (!passwordMatch) {
      console.warn('Password mismatch for recruiter_id:', recruiter.recruiter_id);
      return res.status(401).json({ error: 'Invalid email or password' }) as unknown as void;
    }
    const token = jwt.sign(
      { recruiter_id: recruiter.recruiter_id, email: recruiter.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
    );
    console.log('Login successful for recruiter_id:', recruiter.recruiter_id);
    res.json({
      recruiter: { recruiter_id: recruiter.recruiter_id, full_name: recruiter.full_name, email: recruiter.email },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
