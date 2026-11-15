/**
 * ONE-TIME SEED ROUTE — DELETE AFTER USE
 * POST /api/seed?secret=trustume-seed-2024
 * This runs inside Render using the already-connected Neon pool.
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  // Simple secret guard so random people can't trigger it
  const secret = req.query.secret || req.body.secret;
  if (secret !== 'trustume-seed-2024') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const log: string[] = [];
  const L = (msg: string) => { log.push(msg); console.log(msg); };

  try {
    // ── Schema migrations ────────────────────────────────────────────────────
    L('Running schema migrations...');
    await pool.query(`ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'recruiter'`);
    await pool.query(`ALTER TABLE candidates  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
    L('Schema migrations done');

    // ── Hash passwords ───────────────────────────────────────────────────────
    const COST = 10; // lower cost = faster seed
    const recruiterHash = await bcrypt.hash('Recruiter@123', COST);
    const ceoHash       = await bcrypt.hash('CEO@123456',    COST);
    const fresherHash   = await bcrypt.hash('Fresher@123',   COST);

    // ── Clear old seed data ──────────────────────────────────────────────────
    L('Clearing previous seed data...');
    await pool.query(`DELETE FROM follow_up_tasks   WHERE task_description LIKE '%[SEED]%'`);
    await pool.query(`DELETE FROM reply_drafts      WHERE draft_content    LIKE '%[SEED]%'`);
    await pool.query(`DELETE FROM message_analyses  WHERE model_name = 'seed-data'`);
    await pool.query(`DELETE FROM messages WHERE sender_email LIKE '%@seed.trustume.com'
      OR thread_id IN (
        SELECT t.thread_id FROM conversation_threads t
        JOIN applications a ON t.application_id = a.application_id
        JOIN candidates c ON a.candidate_id = c.candidate_id
        WHERE c.email LIKE '%@seed.trustume.com')`);
    await pool.query(`DELETE FROM conversation_threads WHERE application_id IN (
      SELECT a.application_id FROM applications a
      JOIN candidates c ON a.candidate_id = c.candidate_id
      WHERE c.email LIKE '%@seed.trustume.com')`);
    await pool.query(`DELETE FROM application_details WHERE application_id IN (
      SELECT a.application_id FROM applications a
      JOIN candidates c ON a.candidate_id = c.candidate_id
      WHERE c.email LIKE '%@seed.trustume.com')`);
    await pool.query(`DELETE FROM applications WHERE candidate_id IN (
      SELECT candidate_id FROM candidates WHERE email LIKE '%@seed.trustume.com')`);
    await pool.query(`DELETE FROM candidates WHERE email LIKE '%@seed.trustume.com'`);
    await pool.query(`DELETE FROM job_roles WHERE role_title IN (
      'Frontend Developer','Backend Engineer','Full Stack Developer','Data Analyst','DevOps Engineer')`);
    await pool.query(`DELETE FROM recruiters WHERE email IN (
      'sarah@trustume.com','michael@trustume.com','ceo@trustume.com')`);
    L('Old seed data cleared');

    // ── Field definitions ────────────────────────────────────────────────────
    const fields = [
      ['notice_period_days', 'Notice Period (Days)', 'number', true,  'What is your current notice period in days?'],
      ['current_role_title', 'Current Role Title',  'text',   true,  'What is your current job title?'],
      ['experience_years',   'Years of Experience', 'number', true,  'How many years of relevant experience do you have?'],
      ['expected_salary',    'Expected Salary (INR)','number', true, 'What is your expected annual salary in INR?'],
      ['available_from',     'Available From Date',  'date',   false, 'From what date would you be available to join?'],
    ];
    for (const [key, label, dtype, req, q] of fields) {
      await pool.query(
        `INSERT INTO field_definitions (field_key, field_label, data_type, default_required, default_question, is_active)
         VALUES ($1,$2,$3,$4,$5,true)
         ON CONFLICT (field_key) DO UPDATE SET field_label=$2, default_question=$5`,
        [key, label, dtype, req, q]
      );
    }

    // ── Recruiters ───────────────────────────────────────────────────────────
    L('Inserting recruiters...');
    const r1 = await pool.query(
      `INSERT INTO recruiters (full_name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING recruiter_id`,
      ['Sarah Johnson', 'sarah@trustume.com', recruiterHash, 'recruiter']
    );
    const r2 = await pool.query(
      `INSERT INTO recruiters (full_name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING recruiter_id`,
      ['Michael Chen', 'michael@trustume.com', recruiterHash, 'recruiter']
    );
    await pool.query(
      `INSERT INTO recruiters (full_name, email, password_hash, role) VALUES ($1,$2,$3,$4)`,
      ['Priya Kapoor', 'ceo@trustume.com', ceoHash, 'ceo']
    );
    const sarahId   = r1.rows[0].recruiter_id;
    const michaelId = r2.rows[0].recruiter_id;
    L('Recruiters inserted');

    // ── Candidates ───────────────────────────────────────────────────────────
    L('Inserting candidates...');
    const candidateData = [
      ['Rahul Kumar',  'rahul@seed.trustume.com',  '+91-9876543210', 'Hyderabad', 'https://linkedin.com/in/rahulkumar'],
      ['Priya Sharma', 'priya@seed.trustume.com',  '+91-9876543211', 'Bangalore', 'https://linkedin.com/in/priyasharma'],
      ['Arjun Rao',    'arjun@seed.trustume.com',  '+91-9876543212', 'Chennai',   'https://linkedin.com/in/arjunrao'],
      ['Sneha Patel',  'sneha@seed.trustume.com',  '+91-9876543213', 'Pune',      'https://linkedin.com/in/snehapatel'],
      ['Kiran Mehta',  'kiran@seed.trustume.com',  '+91-9876543214', 'Delhi',     'https://linkedin.com/in/kiranmehta'],
    ];
    const cids: string[] = [];
    for (const [name, email, phone, loc, li] of candidateData) {
      const res = await pool.query(
        `INSERT INTO candidates (full_name, email, phone, location, linkedin_url, password_hash)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING candidate_id`,
        [name, email, phone, loc, li, fresherHash]
      );
      cids.push(res.rows[0].candidate_id);
    }
    const [rahulId, priyaSId, arjunId, snehaId, kiranId] = cids;
    L('Candidates inserted');

    // ── Job Roles ────────────────────────────────────────────────────────────
    L('Inserting job roles...');
    const jobData: [string, string, string, number, number, number, number, string, string, string][] = [
      ['Frontend Developer',   'Engineering',      'React, TypeScript, Node.js frontend role',                   0, 2, 400000,  700000,  'INR', 'Hyderabad', 'full-time'],
      ['Backend Engineer',     'Engineering',      'Node.js, PostgreSQL, REST API backend role',                 0, 3, 500000,  900000,  'INR', 'Bangalore', 'full-time'],
      ['Full Stack Developer', 'Engineering',      'End-to-end web development React + Node.js',                 1, 4, 600000, 1000000,  'INR', 'Remote',    'full-time'],
      ['Data Analyst',         'Analytics',        'SQL, Python, data visualization and reporting',              0, 2, 450000,  750000,  'INR', 'Pune',      'full-time'],
      ['DevOps Engineer',      'Infrastructure',   'CI/CD, Docker, Kubernetes, cloud infrastructure',           1, 3, 550000,  950000,  'INR', 'Delhi',     'full-time'],
    ];
    const jids: string[] = [];
    for (const [title, dept, desc, minE, maxE, sMin, sMax, cur, loc, empType] of jobData) {
      const res = await pool.query(
        `INSERT INTO job_roles (role_title, department, job_description, min_experience, max_experience,
          salary_min, salary_max, currency_code, location, employment_type, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active') RETURNING job_role_id`,
        [title, dept, desc, minE, maxE, sMin, sMax, cur, loc, empType]
      );
      jids.push(res.rows[0].job_role_id);
    }
    const [feId, beId, fsId, daId, dvId] = jids;
    L('Job roles inserted');

    // ── Applications ─────────────────────────────────────────────────────────
    L('Inserting applications...');
    const appData: [string, string, string, string, string][] = [
      [rahulId,  feId, sarahId,   'screening',  'interested'],
      [priyaSId, beId, sarahId,   'interview',  'interested'],
      [arjunId,  fsId, michaelId, 'closed',     'unknown'],
      [snehaId,  daId, michaelId, 'screening',  'interested'],
      [kiranId,  dvId, sarahId,   'screening',  'interested'],
    ];
    const appIds: string[] = [];
    for (const [cid, jid, rid, status, interest] of appData) {
      const res = await pool.query(
        `INSERT INTO applications (candidate_id, job_role_id, recruiter_id, application_status, interest_status)
         VALUES ($1,$2,$3,$4,$5) RETURNING application_id`,
        [cid, jid, rid, status, interest]
      );
      appIds.push(res.rows[0].application_id);
    }
    const [appRahul, appPriya, appArjun, appSneha, appKiran] = appIds;
    L('Applications inserted');

    // ── Application Details ──────────────────────────────────────────────────
    const details: [string, string, string, number, number, number, number, string][] = [
      [appRahul, 'Software Trainee',  'InfoSys',       1.5, 60, 350000, 600000, 'INR'],
      [appPriya, 'Junior Developer',  'Wipro',         0.5,  0, 400000, 700000, 'INR'],
      [appArjun, 'Developer Intern',  'TCS',           1.0, 30, 280000, 500000, 'INR'],
      [appSneha, 'Data Intern',       'HCL',           1.0, 45, 300000, 600000, 'INR'],
      [appKiran, 'Systems Engineer',  'Tech Mahindra', 2.0, 30, 450000, 800000, 'INR'],
    ];
    for (const [aid, role, company, exp, notice, curSal, expSal, cur] of details) {
      await pool.query(
        `INSERT INTO application_details (application_id, current_role_title, current_company,
          experience_years, notice_period_days, current_salary, expected_salary, salary_currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [aid, role, company, exp, notice, curSal, expSal, cur]
      );
    }

    // ── Conversation Threads ─────────────────────────────────────────────────
    L('Inserting threads & messages...');
    const threadData: [string, string][] = [
      [appRahul, 'Frontend Developer Opportunity — Trustume'],
      [appPriya, 'Backend Engineer Opportunity — Trustume'],
      [appArjun, 'Full Stack Developer Opportunity — Trustume'],
      [appSneha, 'Data Analyst Opportunity — Trustume'],
      [appKiran, 'DevOps Engineer Opportunity — Trustume'],
    ];
    const threadIds: string[] = [];
    for (const [aid, subject] of threadData) {
      const res = await pool.query(
        `INSERT INTO conversation_threads (application_id, channel, subject, thread_status)
         VALUES ($1,'email',$2,'open') RETURNING thread_id`,
        [aid, subject]
      );
      threadIds.push(res.rows[0].thread_id);
    }
    const [tRahul, tPriya, tArjun, tSneha, tKiran] = threadIds;

    // ── Messages ─────────────────────────────────────────────────────────────
    const now = new Date();
    const dAgo = (d: number) => new Date(now.getTime() - d * 86400000);
    type MsgSet = { tid: string; msgs: { dir: string; stype: string; rid: string | null; email: string; body: string; at: Date }[] };
    const msgSets: MsgSet[] = [
      { tid: tRahul, msgs: [
        { dir:'outbound', stype:'recruiter', rid:sarahId,   email:'sarah@trustume.com',          body:'Hi Rahul,\n\nWe have an exciting Frontend Developer opportunity. Your profile looks like a great fit. Would you be interested?\n\nBest,\nSarah Johnson',                                                                           at:dAgo(5) },
        { dir:'inbound',  stype:'candidate', rid:null,       email:'rahul@seed.trustume.com',     body:'Hi Sarah,\n\nThank you for reaching out. I am very interested! My current notice period is 60 days. Could you share more about the tech stack?\n\nBest,\nRahul Kumar',                                                             at:dAgo(4) },
        { dir:'outbound', stype:'recruiter', rid:sarahId,   email:'sarah@trustume.com',          body:'Hi Rahul,\n\nThe 60-day notice period works well. We use React, TypeScript, and Node.js. Can we schedule an introductory call this week?\n\nBest,\nSarah Johnson',                                                                   at:dAgo(3) },
      ]},
      { tid: tPriya, msgs: [
        { dir:'outbound', stype:'recruiter', rid:sarahId,   email:'sarah@trustume.com',          body:'Hi Priya,\n\nWe have a Backend Engineer opportunity and your profile looks impressive. Are you open to exploring this role?\n\nBest,\nSarah Johnson',                                                                               at:dAgo(4) },
        { dir:'inbound',  stype:'candidate', rid:null,       email:'priya@seed.trustume.com',    body:'Hi Sarah,\n\nYes, very interested! I am available immediately. I have strong Node.js and PostgreSQL experience. When can we schedule an interview?\n\nBest,\nPriya Sharma',                                                           at:dAgo(3) },
        { dir:'outbound', stype:'recruiter', rid:sarahId,   email:'sarah@trustume.com',          body:'Hi Priya,\n\nWonderful! Could you confirm your availability for Monday or Tuesday 10am-4pm IST for a technical interview?\n\nBest,\nSarah Johnson',                                                                                   at:dAgo(2) },
      ]},
      { tid: tArjun, msgs: [
        { dir:'outbound', stype:'recruiter', rid:michaelId, email:'michael@trustume.com',        body:'Hi Arjun,\n\nWe have a Full Stack Developer role that might be a great match. Would you like to know more?\n\nBest,\nMichael Chen',                                                                                                   at:dAgo(6) },
        { dir:'inbound',  stype:'candidate', rid:null,       email:'arjun@seed.trustume.com',    body:'Hi Michael,\n\nThank you for reaching out. I have already accepted an offer elsewhere. I appreciate your consideration.\n\nBest,\nArjun Rao',                                                                                         at:dAgo(5) },
        { dir:'outbound', stype:'recruiter', rid:michaelId, email:'michael@trustume.com',        body:'Hi Arjun,\n\nCongratulations on your new opportunity! Please feel free to reach out in the future. All the best!\n\nBest,\nMichael Chen',                                                                                             at:dAgo(4) },
      ]},
      { tid: tSneha, msgs: [
        { dir:'outbound', stype:'recruiter', rid:michaelId, email:'michael@trustume.com',        body:'Hi Sneha,\n\nWe are hiring a Data Analyst and your profile stands out. We work with SQL, Python, and BI tools. Are you open to a conversation?\n\nBest,\nMichael Chen',                                                               at:dAgo(2) },
        { dir:'inbound',  stype:'candidate', rid:null,       email:'sneha@seed.trustume.com',    body:'Hi Michael,\n\nI am interested! Could you please share the salary range for this role? I want to make sure the compensation aligns with my expectations.\n\nBest,\nSneha Patel',                                                       at:dAgo(1) },
      ]},
      { tid: tKiran, msgs: [
        { dir:'outbound', stype:'recruiter', rid:sarahId,   email:'sarah@trustume.com',          body:'Hi Kiran,\n\nWe have a DevOps Engineer opening that aligns with your infrastructure background. Are you exploring new opportunities?\n\nBest,\nSarah Johnson',                                                                         at:dAgo(3) },
        { dir:'inbound',  stype:'candidate', rid:null,       email:'kiran@seed.trustume.com',    body:'Hi Sarah,\n\nI am interested! I am serving a 30-day notice period. I work with Docker, Kubernetes, and AWS. Could we schedule a discussion?\n\nBest,\nKiran Mehta',                                                                   at:dAgo(2) },
        { dir:'outbound', stype:'recruiter', rid:sarahId,   email:'sarah@trustume.com',          body:'Hi Kiran,\n\nA 30-day notice period works perfectly for our timeline. I will get back to you shortly with interview details.\n\nBest,\nSarah Johnson',                                                                                   at:dAgo(1) },
      ]},
    ];

    const inboundMsgIds: Record<string, string> = {};
    for (const { tid, msgs } of msgSets) {
      const threadRow = await pool.query(`SELECT application_id FROM conversation_threads WHERE thread_id=$1`, [tid]);
      const appId = threadRow.rows[0].application_id;
      for (const m of msgs) {
        const res = await pool.query(
          `INSERT INTO messages (thread_id, direction, sender_type, recruiter_id, sender_email, message_body, sent_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING message_id`,
          [tid, m.dir, m.stype, m.rid, m.email, m.body, m.at]
        );
        if (m.dir === 'inbound') inboundMsgIds[appId] = res.rows[0].message_id;
      }
      await pool.query(`UPDATE conversation_threads SET last_message_at=$1 WHERE thread_id=$2`, [msgs[msgs.length - 1].at, tid]);
    }
    L('Threads & messages inserted');

    // ── Message Analyses ─────────────────────────────────────────────────────
    const analyses = [
      { appId: appRahul, intent: 'interested',     interest: 'high',   conf: 0.92, data: { notice_period_days: 60, questions_asked: [{ category: 'role_details', question_text: 'Could you share more about the tech stack?' }] } },
      { appId: appPriya, intent: 'interested',     interest: 'high',   conf: 0.95, data: { notice_period_days: 0,  questions_asked: [] } },
      { appId: appArjun, intent: 'not_interested', interest: 'none',   conf: 0.98, data: { questions_asked: [] } },
      { appId: appSneha, intent: 'asking_salary',  interest: 'medium', conf: 0.90, data: { questions_asked: [{ category: 'salary', question_text: 'Could you share the salary range?' }] } },
      { appId: appKiran, intent: 'interested',     interest: 'high',   conf: 0.88, data: { notice_period_days: 30, questions_asked: [] } },
    ];
    for (const a of analyses) {
      const msgId = inboundMsgIds[a.appId];
      if (!msgId) continue;
      await pool.query(
        `INSERT INTO message_analyses (message_id, model_name, primary_intent, detected_interest, confidence_score, extracted_data, analysis_status)
         VALUES ($1,'seed-data',$2,$3,$4,$5,'completed')`,
        [msgId, a.intent, a.interest, a.conf, JSON.stringify(a.data)]
      );
    }

    // ── Follow-Up Tasks ──────────────────────────────────────────────────────
    L('Inserting follow-up tasks...');
    const tomorrow     = new Date(now.getTime() + 86400000);
    const inThreeDays  = new Date(now.getTime() + 3 * 86400000);
    const tasks: [string, string, string, string, string, Date, string, string][] = [
      [appRahul, sarahId,   'schedule_interview', '[SEED] Schedule technical interview with Rahul Kumar — interested, 60-day notice', 'high',   tomorrow,    'pending',   inboundMsgIds[appRahul]],
      [appSneha, michaelId, 'share_salary',       '[SEED] Share salary range with Sneha Patel — waiting for compensation details',    'high',   now,         'pending',   inboundMsgIds[appSneha]],
      [appKiran, sarahId,   'send_follow_up',     '[SEED] Send interview details to Kiran Mehta — available next month',              'medium', inThreeDays, 'pending',   inboundMsgIds[appKiran]],
      [appPriya, sarahId,   'schedule_interview', '[SEED] Schedule interview with Priya Sharma — available immediately',              'high',   tomorrow,    'pending',   inboundMsgIds[appPriya]],
      [appArjun, michaelId, 'close_application',  '[SEED] Application closed — Arjun Rao declined the offer',                        'low',    now,         'completed', inboundMsgIds[appArjun]],
    ];
    for (const [aid, rid, type, desc, pri, due, status, srcMsgId] of tasks) {
      await pool.query(
        `INSERT INTO follow_up_tasks (application_id, recruiter_id, task_type, task_description, priority, due_at, task_status, source_message_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [aid, rid, type, desc, pri, due, status, srcMsgId]
      );
    }
    L('Follow-up tasks inserted');

    // ── Message Templates ────────────────────────────────────────────────────
    const templates = [
      ['seed_job_invite',      'job_proposal',    'Exciting {{role_title}} Opportunity — {{company_name}}',     'Hi {{candidate_name}},\n\nWe have an exciting {{role_title}} opportunity. Would you be interested?\n\nBest,\n{{recruiter_name}}',          'email'],
      ['seed_follow_up',       'follow_up',       'Following Up — {{role_title}} Opportunity',                   'Hi {{candidate_name}},\n\nI wanted to follow up on the {{role_title}} position. Have you had a chance to consider it?\n\nBest,\n{{recruiter_name}}', 'email'],
      ['seed_interview_invite','interview_invite', 'Interview Invitation — {{role_title}}',                      'Hi {{candidate_name}},\n\nWe are pleased to invite you for an interview for the {{role_title}} position.\n\nBest,\n{{recruiter_name}}',    'email'],
      ['seed_salary_info',     'general',         'Compensation Details — {{role_title}}',                      'Hi {{candidate_name}},\n\nThe salary range for {{role_title}} is {{salary_min}}–{{salary_max}} {{currency}} per annum.\n\nBest,\n{{recruiter_name}}', 'email'],
      ['seed_rejection',       'rejection',       'Regarding Your Application — {{role_title}}',                'Hi {{candidate_name}},\n\nAfter careful consideration, we have decided to move forward with other candidates. Best wishes!\n\nBest,\n{{recruiter_name}}', 'email'],
    ];
    for (const [key, type, subj, body, channel] of templates) {
      await pool.query(
        `INSERT INTO message_templates (template_key, template_type, subject_template, body_template, channel, is_active, version)
         VALUES ($1,$2,$3,$4,$5,true,1)
         ON CONFLICT (template_key) DO NOTHING`,
        [key, type, subj, body, channel]
      );
    }
    L('Templates inserted');

    L('✅ SEED COMPLETE!');
    res.json({
      success: true,
      log,
      credentials: {
        recruiters: [
          { email: 'sarah@trustume.com',   password: 'Recruiter@123', role: 'recruiter' },
          { email: 'michael@trustume.com', password: 'Recruiter@123', role: 'recruiter' },
          { email: 'ceo@trustume.com',     password: 'CEO@123456',    role: 'ceo' },
        ],
        freshers: [
          { email: 'rahul@seed.trustume.com', password: 'Fresher@123' },
          { email: 'priya@seed.trustume.com', password: 'Fresher@123' },
          { email: 'arjun@seed.trustume.com', password: 'Fresher@123' },
          { email: 'sneha@seed.trustume.com', password: 'Fresher@123' },
          { email: 'kiran@seed.trustume.com', password: 'Fresher@123' },
        ],
      },
    });
  } catch (err: unknown) {
    const e = err as Error;
    console.error('Seed error:', e);
    res.status(500).json({ error: e.message, log });
  }
});

export default router;
