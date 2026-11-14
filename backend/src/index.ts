import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes       from './routes/auth';
import candidateRoutes  from './routes/candidates';
import jobRoleRoutes    from './routes/jobRoles';
import applicationRoutes from './routes/applications';
import messageRoutes    from './routes/messages';
import aiRoutes         from './routes/ai';
import dashboardRoutes  from './routes/dashboard';
import draftsRoutes     from './routes/drafts';
import { errorHandler } from './middleware/errorHandler';
import { pool }         from './config/database';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Core middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/candidates',   candidateRoutes);
app.use('/api/job-roles',    jobRoleRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/messages',     messageRoutes);
app.use('/api/ai',           aiRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/drafts',       draftsRoutes);

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Trustume API running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard:     http://localhost:${PORT}/api/dashboard/triage`);
  console.log(`🤖 AI Chatbot:    http://localhost:${PORT}/api/ai/recruiter-query`);
  console.log(`💬 Messages:      http://localhost:${PORT}/api/messages/inbound`);
  console.log(`❤️  Health:        http://localhost:${PORT}/health\n`);
});

export default app;
