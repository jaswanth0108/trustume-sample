/**
 * Trustume Seed Script
 * Run: node src/db/seed.mjs
 */
import pkg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pkg;

const client = new Client({
  host: 'ep-soft-shadow-aojneigp-pooler.c-2.ap-southeast-1.aws.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_svlh8Nft2qBe',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('✅ Connected to PostgreSQL\n');

  // ── Schema migration ───────────────────────────────────────────────────────
  console.log('⏳ Running schema migrations...');
  await client.query(`ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'recruiter'`);
  await client.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
  console.log('✅ Schema migrations complete\n');

  // ── Hash passwords ─────────────────────────────────────────────────────────
  const COST = 12;
  const recruiterHash = await bcrypt.hash('Recruiter@123', COST);
  const ceoHash = await bcrypt.hash('CEO@123456', COST);
  const fresherHash = await bcrypt.hash('Fresher@123', COST);

  // ── Clear existing seed data ────────────────────────────────────────────────
  console.log('⏳ Clearing previous seed data...');
  await client.query(`DELETE FROM follow_up_tasks      WHERE task_description LIKE '%[SEED]%'`);
  await client.query(`DELETE FROM reply_drafts         WHERE draft_content    LIKE '%[SEED]%'`);
  await client.query(`DELETE FROM message_analyses     WHERE model_name = 'seed-data'`);
  await client.query(`DELETE FROM application_field_answers WHERE raw_answer LIKE '%seed%'`);
  await client.query(`DELETE FROM application_required_fields WHERE application_id IN (
    SELECT a.application_id FROM applications a
    JOIN candidates c ON a.candidate_id = c.candidate_id
    WHERE c.email LIKE '%@seed.trustume.com')`);
  await client.query(`DELETE FROM candidate_questions WHERE application_id IN (
    SELECT a.application_id FROM applications a
    JOIN candidates c ON a.candidate_id = c.candidate_id
    WHERE c.email LIKE '%@seed.trustume.com')`);
  await client.query(`DELETE FROM messages WHERE sender_email LIKE '%@seed.trustume.com'
    OR thread_id IN (
      SELECT t.thread_id FROM conversation_threads t
      JOIN applications a ON t.application_id = a.application_id
      JOIN candidates c ON a.candidate_id = c.candidate_id
      WHERE c.email LIKE '%@seed.trustume.com')`);
  await client.query(`DELETE FROM conversation_threads WHERE application_id IN (
    SELECT a.application_id FROM applications a
    JOIN candidates c ON a.candidate_id = c.candidate_id
    WHERE c.email LIKE '%@seed.trustume.com')`);
  await client.query(`DELETE FROM application_details WHERE application_id IN (
    SELECT a.application_id FROM applications a
    JOIN candidates c ON a.candidate_id = c.candidate_id
    WHERE c.email LIKE '%@seed.trustume.com')`);
  await client.query(`DELETE FROM applications WHERE candidate_id IN (
    SELECT candidate_id FROM candidates WHERE email LIKE '%@seed.trustume.com')`);
  await client.query(`DELETE FROM candidates WHERE email LIKE '%@seed.trustume.com'`);
  await client.query(`DELETE FROM job_roles WHERE created_at > NOW() - INTERVAL '10 minutes' OR role_title IN (
    'Frontend Developer','Backend Engineer','Full Stack Developer','Data Analyst','DevOps Engineer'
  )`);
  await client.query(`DELETE FROM recruiters WHERE email IN (
    'sarah@trustume.com','michael@trustume.com','ceo@trustume.com')`);
  console.log('✅ Cleared previous seed data\n');

  // ── Field definitions ──────────────────────────────────────────────────────
  console.log('⏳ Inserting field definitions...');
  const fields = [
    ['notice_period_days', 'Notice Period (Days)', 'number', true, 'What is your current notice period in days?'],
    ['current_role_title', 'Current Role Title', 'text', true, 'What is your current job title?'],
    ['experience_years', 'Years of Experience', 'number', true, 'How many years of relevant experience do you have?'],
    ['expected_salary', 'Expected Salary (INR)', 'number', true, 'What is your expected annual salary in INR?'],
    ['available_from', 'Available From Date', 'date', false, 'From what date would you be available to join?'],
  ];
  for (const [key, label, dtype, req, q] of fields) {
    await client.query(
      `INSERT INTO field_definitions (field_key, field_label, data_type, default_required, default_question, is_active)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (field_key) DO UPDATE SET field_label=$2, default_question=$5`,
      [key, label, dtype, req, q]
    );
  }
  console.log('✅ Field definitions ready\n');

  // ── Recruiters ─────────────────────────────────────────────────────────────
  console.log('⏳ Inserting recruiters...');
  const r1 = await client.query(
    `INSERT INTO recruiters (full_name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING recruiter_id`,
    ['Sarah Johnson', 'sarah@trustume.com', recruiterHash, 'recruiter']
  );
  const r2 = await client.query(
    `INSERT INTO recruiters (full_name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING recruiter_id`,
    ['Michael Chen', 'michael@trustume.com', recruiterHash, 'recruiter']
  );
  const r3 = await client.query(
    `INSERT INTO recruiters (full_name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING recruiter_id`,
    ['Priya Kapoor', 'ceo@trustume.com', ceoHash, 'ceo']
  );
  const sarahId = r1.rows[0].recruiter_id;
  const michaelId = r2.rows[0].recruiter_id;
  console.log('✅ Recruiters inserted\n');

  // ── Candidates ─────────────────────────────────────────────────────────────
  console.log('⏳ Inserting candidates...');
  const candidateData = [
    ['Rahul Kumar', 'rahul@seed.trustume.com', '+91-9876543210', 'Hyderabad', 'https://linkedin.com/in/rahulkumar'],
    ['Priya Sharma', 'priya@seed.trustume.com', '+91-9876543211', 'Bangalore', 'https://linkedin.com/in/priyasharma'],
    ['Arjun Rao', 'arjun@seed.trustume.com', '+91-9876543212', 'Chennai', 'https://linkedin.com/in/arjunrao'],
    ['Sneha Patel', 'sneha@seed.trustume.com', '+91-9876543213', 'Pune', 'https://linkedin.com/in/snehapatel'],
    ['Kiran Mehta', 'kiran@seed.trustume.com', '+91-9876543214', 'Delhi', 'https://linkedin.com/in/kiranmehta'],
  ];
  const cids = [];
  for (const [name, email, phone, loc, li] of candidateData) {
    const res = await client.query(
      `INSERT INTO candidates (full_name, email, phone, location, linkedin_url, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING candidate_id`,
      [name, email, phone, loc, li, fresherHash]
    );
    cids.push(res.rows[0].candidate_id);
  }
  const [rahulId, priyaSId, arjunId, snehaId, kiranId] = cids;
  console.log('✅ Candidates inserted\n');

  // ── Job Roles ──────────────────────────────────────────────────────────────
  console.log('⏳ Inserting job roles...');
  const jobData = [
    ['Frontend Developer', 'Engineering', 'React, TypeScript, Node.js frontend role', 0, 2, 400000, 700000, 'INR', 'Hyderabad', 'full-time'],
    ['Backend Engineer', 'Engineering', 'Node.js, PostgreSQL, REST API backend role', 0, 3, 500000, 900000, 'INR', 'Bangalore', 'full-time'],
    ['Full Stack Developer', 'Engineering', 'End-to-end web development React + Node.js', 1, 4, 600000, 1000000, 'INR', 'Remote', 'full-time'],
    ['Data Analyst', 'Analytics', 'SQL, Python, data visualization and reporting', 0, 2, 450000, 750000, 'INR', 'Pune', 'full-time'],
    ['DevOps Engineer', 'Infrastructure', 'CI/CD, Docker, Kubernetes, cloud infrastructure', 1, 3, 550000, 950000, 'INR', 'Delhi', 'full-time'],
  ];
  const jids = [];
  for (const [title, dept, desc, minE, maxE, sMin, sMax, cur, loc, empType] of jobData) {
    const res = await client.query(
      `INSERT INTO job_roles (role_title, department, job_description, min_experience, max_experience,
        salary_min, salary_max, currency_code, location, employment_type, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active') RETURNING job_role_id`,
      [title, dept, desc, minE, maxE, sMin, sMax, cur, loc, empType]
    );
    jids.push(res.rows[0].job_role_id);
  }
  const [feId, beId, fsId, daId, dvId] = jids;
  console.log('✅ Job roles inserted\n');

  // ── Applications ───────────────────────────────────────────────────────────
  console.log('⏳ Inserting applications...');
  const appData = [
    [rahulId, feId, sarahId, 'screening', 'interested'],
    [priyaSId, beId, sarahId, 'interview', 'interested'],
    [arjunId, fsId, michaelId, 'closed', 'unknown'],
    [snehaId, daId, michaelId, 'screening', 'interested'],
    [kiranId, dvId, sarahId, 'screening', 'interested'],];
  const appIds = [];
  for (const [cid, jid, rid, status, interest] of appData) {
    const res = await client.query(
      `INSERT INTO applications (candidate_id, job_role_id, recruiter_id, application_status, interest_status)
       VALUES ($1,$2,$3,$4,$5) RETURNING application_id`,
      [cid, jid, rid, status, interest]
    );
    appIds.push(res.rows[0].application_id);
  }
  const [appRahul, appPriya, appArjun, appSneha, appKiran] = appIds;
  console.log('✅ Applications inserted\n');

  // ── Application Details ────────────────────────────────────────────────────
  console.log('⏳ Inserting application details...');
  const details = [
    [appRahul, 'Software Trainee', 'InfoSys', 1.5, 60, 350000, 600000, 'INR'],
    [appPriya, 'Junior Developer', 'Wipro', 0.5, 0, 400000, 700000, 'INR'],
    [appArjun, 'Developer Intern', 'TCS', 1.0, 30, 280000, 500000, 'INR'],
    [appSneha, 'Data Intern', 'HCL', 1.0, 45, 300000, 600000, 'INR'],
    [appKiran, 'Systems Engineer', 'Tech Mahindra', 2.0, 30, 450000, 800000, 'INR'],
  ];
  for (const [aid, role, company, exp, notice, curSal, expSal, cur] of details) {
    await client.query(
      `INSERT INTO application_details (application_id, current_role_title, current_company,
        experience_years, notice_period_days, current_salary, expected_salary, salary_currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [aid, role, company, exp, notice, curSal, expSal, cur]
    );
  }
  console.log('✅ Application details inserted\n');

  // ── Conversation Threads ───────────────────────────────────────────────────
  console.log('⏳ Inserting conversation threads...');
  const threadData = [
    [appRahul, 'email', 'Frontend Developer Opportunity — Trustume'],
    [appPriya, 'email', 'Backend Engineer Opportunity — Trustume'],
    [appArjun, 'email', 'Full Stack Developer Opportunity — Trustume'],
    [appSneha, 'email', 'Data Analyst Opportunity — Trustume'],
    [appKiran, 'email', 'DevOps Engineer Opportunity — Trustume'],
  ];
  const threadIds = [];
  for (const [aid, channel, subject] of threadData) {
    const res = await client.query(
      `INSERT INTO conversation_threads (application_id, channel, subject, thread_status)
       VALUES ($1,$2,$3,'open') RETURNING thread_id`,
      [aid, channel, subject]
    );
    threadIds.push(res.rows[0].thread_id);
  }
  const [tRahul, tPriya, tArjun, tSneha, tKiran] = threadIds;
  console.log('✅ Threads inserted\n');

  // ── Messages ───────────────────────────────────────────────────────────────
  console.log('⏳ Inserting messages...');
  const now = new Date();
  const daysAgo = (d) => new Date(now - d * 86400000);

  const msgSets = [
    // Rahul - 3 messages
    {
      tid: tRahul, msgs: [
        { dir: 'outbound', stype: 'recruiter', rid: sarahId, email: 'sarah@trustume.com', body: `Hi Rahul,\n\nWe have an exciting Frontend Developer opportunity at our company. Your profile looks like a great fit for our team. Would you be interested in learning more about this role?\n\nBest regards,\nSarah Johnson`, at: daysAgo(5) },
        { dir: 'inbound', stype: 'candidate', rid: null, email: 'rahul@seed.trustume.com', body: `Hi Sarah,\n\nThank you for reaching out. I am very interested in the Frontend Developer position. However, I should mention that my current notice period is 60 days. Could you let me know if that works for your timeline? Also, could you share more about the tech stack you use?\n\nBest regards,\nRahul Kumar`, at: daysAgo(4) },
        { dir: 'outbound', stype: 'recruiter', rid: sarahId, email: 'sarah@trustume.com', body: `Hi Rahul,\n\nThank you for your response! The 60-day notice period works well for us. We primarily use React, TypeScript, and Node.js. Could you please share your availability for a quick introductory call this week?\n\nBest regards,\nSarah Johnson`, at: daysAgo(3) },
      ]
    },
    // Priya Sharma - 3 messages
    {
      tid: tPriya, msgs: [
        { dir: 'outbound', stype: 'recruiter', rid: sarahId, email: 'sarah@trustume.com', body: `Hi Priya,\n\nWe have an exciting Backend Engineer opportunity and your profile looks impressive. Are you open to exploring this role?\n\nBest regards,\nSarah Johnson`, at: daysAgo(4) },
        { dir: 'inbound', stype: 'candidate', rid: null, email: 'priya@seed.trustume.com', body: `Hi Sarah,\n\nYes, I am very much interested! I am currently serving my notice period and will be available immediately in about 2 weeks. I have strong Node.js and PostgreSQL experience from my current role at Wipro. When can we schedule an interview?\n\nBest,\nPriya Sharma`, at: daysAgo(3) },
        { dir: 'outbound', stype: 'recruiter', rid: sarahId, email: 'sarah@trustume.com', body: `Hi Priya,\n\nWonderful! You sound like a great fit for our Backend Engineer role. I will schedule a technical interview for you right away. Could you confirm your availability for next Monday or Tuesday between 10am–4pm IST?\n\nBest regards,\nSarah Johnson`, at: daysAgo(2) },
      ]
    },
    // Arjun - 3 messages
    {
      tid: tArjun, msgs: [
        { dir: 'outbound', stype: 'recruiter', rid: michaelId, email: 'michael@trustume.com', body: `Hi Arjun,\n\nWe have a Full Stack Developer role that might be a perfect match for your skills. Would you like to know more about it?\n\nBest regards,\nMichael Chen`, at: daysAgo(6) },
        { dir: 'inbound', stype: 'candidate', rid: null, email: 'arjun@seed.trustume.com', body: `Hi Michael,\n\nThank you for reaching out. After reviewing the opportunity details, I have decided to pursue other options at this time as I have already accepted an offer elsewhere. I appreciate your consideration.\n\nBest regards,\nArjun Rao`, at: daysAgo(5) },
        { dir: 'outbound', stype: 'recruiter', rid: michaelId, email: 'michael@trustume.com', body: `Hi Arjun,\n\nThank you for your honest response and congratulations on your new opportunity! We completely understand. Please feel free to reach out in the future if your situation changes. Wishing you all the best in your new role.\n\nBest regards,\nMichael Chen`, at: daysAgo(4) },
      ]
    },
    // Sneha - 2 messages (waiting for salary info)
    {
      tid: tSneha, msgs: [
        { dir: 'outbound', stype: 'recruiter', rid: michaelId, email: 'michael@trustume.com', body: `Hi Sneha,\n\nWe are actively hiring a Data Analyst and your profile stands out. We work with SQL, Python, and advanced BI tools. Are you open to a conversation?\n\nBest regards,\nMichael Chen`, at: daysAgo(2) },
        { dir: 'inbound', stype: 'candidate', rid: null, email: 'sneha@seed.trustume.com', body: `Hi Michael,\n\nThank you for reaching out! I am definitely interested in the Data Analyst position. Before moving forward, could you please share the salary range for this role? I want to make sure the compensation aligns with my expectations. Looking forward to hearing from you.\n\nBest,\nSneha Patel`, at: daysAgo(1) },
      ]
    },
    // Kiran - 3 messages
    {
      tid: tKiran, msgs: [
        { dir: 'outbound', stype: 'recruiter', rid: sarahId, email: 'sarah@trustume.com', body: `Hi Kiran,\n\nWe have a DevOps Engineer opening that aligns well with your infrastructure background. Are you currently exploring new opportunities?\n\nBest regards,\nSarah Johnson`, at: daysAgo(3) },
        { dir: 'inbound', stype: 'candidate', rid: null, email: 'kiran@seed.trustume.com', body: `Hi Sarah,\n\nThank you for reaching out. I am interested in the DevOps Engineer role. I am currently serving a 30-day notice period and will be available to join from next month. I work with Docker, Kubernetes, and AWS. Could we schedule a discussion?\n\nBest,\nKiran Mehta`, at: daysAgo(2) },
        { dir: 'outbound', stype: 'recruiter', rid: sarahId, email: 'sarah@trustume.com', body: `Hi Kiran,\n\nThat sounds great! A 30-day notice period works perfectly for our timeline. I will coordinate with our technical team and get back to you shortly with interview details.\n\nBest regards,\nSarah Johnson`, at: daysAgo(1) },
      ]
    },
  ];

  const inboundMsgIds = {}; // keyed by appId
  for (const { tid, msgs } of msgSets) {
    // find which app this thread belongs to
    const threadRow = await client.query(`SELECT application_id FROM conversation_threads WHERE thread_id=$1`, [tid]);
    const appId = threadRow.rows[0].application_id;
    for (const m of msgs) {
      const res = await client.query(
        `INSERT INTO messages (thread_id, direction, sender_type, recruiter_id, sender_email, message_body, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING message_id`,
        [tid, m.dir, m.stype, m.rid, m.email, m.body, m.at]
      );
      if (m.dir === 'inbound') inboundMsgIds[appId] = res.rows[0].message_id;
    }
    // update thread last_message_at
    await client.query(`UPDATE conversation_threads SET last_message_at=$1 WHERE thread_id=$2`, [msgs.at(-1).at, tid]);
  }
  console.log('✅ Messages inserted\n');

  // ── Message Analyses ───────────────────────────────────────────────────────
  console.log('⏳ Inserting message analyses...');
  const analyses = [
    { appId: appRahul, intent: 'interested', interest: 'high', conf: 0.92, action: 'follow_up', data: { notice_period_days: 60, questions_asked: [{ category: 'role_details', question_text: 'Could you share more about the tech stack?' }], interview_slots: [] }, missing: ['available_from'] },
    { appId: appPriya, intent: 'interested', interest: 'high', conf: 0.95, action: 'schedule_interview', data: { notice_period_days: 0, questions_asked: [], interview_slots: [] }, missing: [] },
    { appId: appArjun, intent: 'not_interested', interest: 'none', conf: 0.98, action: 'close_application', data: { questions_asked: [], interview_slots: [] }, missing: [] },
    { appId: appSneha, intent: 'asking_salary', interest: 'medium', conf: 0.90, action: 'share_salary', data: { questions_asked: [{ category: 'salary', question_text: 'Could you please share the salary range for this role?' }], interview_slots: [] }, missing: ['notice_period_days', 'available_from'] },
    { appId: appKiran, intent: 'interested', interest: 'high', conf: 0.88, action: 'follow_up', data: { notice_period_days: 30, questions_asked: [], interview_slots: [] }, missing: ['expected_salary', 'available_from'] },
  ];
  for (const a of analyses) {
    const msgId = inboundMsgIds[a.appId];
    if (!msgId) continue;
    await client.query(
      `INSERT INTO message_analyses (message_id, model_name, primary_intent, detected_interest,
        confidence_score, extracted_data, analysis_status)
       VALUES ($1,'seed-data',$2,$3,$4,$5,'completed')`,
      [msgId, a.intent, a.interest, a.conf, JSON.stringify(a.data)]
    );
  }
  console.log('✅ Message analyses inserted\n');

  // ── Follow-Up Tasks ────────────────────────────────────────────────────────
  console.log('⏳ Inserting follow-up tasks...');
  const tomorrow = new Date(now.getTime() + 86400000);
  const inThreeDays = new Date(now.getTime() + 3 * 86400000);
  const tasks = [
    [appRahul, sarahId, 'schedule_interview', '[SEED] Schedule technical interview with Rahul Kumar — interested, 60-day notice period', 'high', tomorrow, 'pending', inboundMsgIds[appRahul]],
    [appSneha, michaelId, 'share_salary', '[SEED] Share salary range with Sneha Patel — she is waiting for compensation details', 'high', now, 'pending', inboundMsgIds[appSneha]],
    [appKiran, sarahId, 'send_follow_up', '[SEED] Send interview details to Kiran Mehta — available from next month', 'medium', inThreeDays, 'pending', inboundMsgIds[appKiran]],
    [appPriya, sarahId, 'schedule_interview', '[SEED] Schedule interview with Priya Sharma — available immediately, eager candidate', 'high', tomorrow, 'pending', inboundMsgIds[appPriya]],
    [appArjun, michaelId, 'close_application', '[SEED] Application closed — Arjun Rao declined the offer', 'low', now, 'completed', inboundMsgIds[appArjun]],
  ];
  for (const [aid, rid, type, desc, pri, due, status, srcMsgId] of tasks) {
    await client.query(
      `INSERT INTO follow_up_tasks (application_id, recruiter_id, task_type, task_description,
        priority, due_at, task_status, source_message_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [aid, rid, type, desc, pri, due, status, srcMsgId]
    );
  }
  console.log('✅ Follow-up tasks inserted\n');

  // ── Message Templates ──────────────────────────────────────────────────────
  console.log('⏳ Inserting message templates...');
  const templates = [
    ['seed_job_invite', 'job_proposal', null, 'Exciting {{role_title}} Opportunity — {{company_name}}', 'Hi {{candidate_name}},\n\nWe have an exciting {{role_title}} opportunity that aligns well with your profile. Would you be interested in learning more?\n\nBest regards,\n{{recruiter_name}}', 'email'],
    ['seed_follow_up', 'follow_up', null, 'Following Up — {{role_title}} Opportunity', 'Hi {{candidate_name}},\n\nI wanted to follow up on my previous message regarding the {{role_title}} position. Have you had a chance to consider it?\n\nBest regards,\n{{recruiter_name}}', 'email'],
    ['seed_interview_invite', 'interview_invite', null, 'Interview Invitation — {{role_title}}', 'Hi {{candidate_name}},\n\nWe are pleased to invite you for an interview for the {{role_title}} position. Please let us know your availability.\n\nBest regards,\n{{recruiter_name}}', 'email'],
    ['seed_salary_info', 'general', null, 'Compensation Details — {{role_title}}', 'Hi {{candidate_name}},\n\nAs requested, the salary range for the {{role_title}} role is {{salary_min}} – {{salary_max}} {{currency}} per annum.\n\nBest regards,\n{{recruiter_name}}', 'email'],
    ['seed_rejection', 'rejection', null, 'Regarding Your Application — {{role_title}}', 'Hi {{candidate_name}},\n\nThank you for your time and interest. After careful consideration, we have decided to move forward with other candidates. We wish you all the best.\n\nBest regards,\n{{recruiter_name}}', 'email'],
  ];
  for (const [key, type, , subj, body, channel] of templates) {
    await client.query(
      `INSERT INTO message_templates (template_key, template_type, subject_template, body_template, channel, is_active, version)
       VALUES ($1,$2,$3,$4,$5,true,1)
       ON CONFLICT (template_key) DO NOTHING`,
      [key, type, subj, body, channel]
    );
  }
  console.log('✅ Message templates inserted\n');

  // ── Print Summary ──────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  TRUSTUME SEED DATA — LOGIN CREDENTIALS');
  console.log('════════════════════════════════════════════════════════════');
  console.log('\n📋 RECRUITER / CEO PORTAL (http://localhost:3000/login)\n');
  console.log('  Role       Name            Email                Password');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  Recruiter  Sarah Johnson   sarah@trustume.com   Recruiter@123');
  console.log('  Recruiter  Michael Chen    michael@trustume.com Recruiter@123');
  console.log('  CEO        Priya Kapoor    ceo@trustume.com     CEO@123456');
  console.log('\n👩‍💼 FRESHER / CANDIDATE PORTAL (http://localhost:3000/fresher/login)\n');
  console.log('  Name         Email                      Password');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  Rahul Kumar  rahul@seed.trustume.com    Fresher@123');
  console.log('  Priya Sharma priya@seed.trustume.com    Fresher@123');
  console.log('  Arjun Rao    arjun@seed.trustume.com    Fresher@123');
  console.log('  Sneha Patel  sneha@seed.trustume.com    Fresher@123');
  console.log('  Kiran Mehta  kiran@seed.trustume.com    Fresher@123');
  console.log('\n════════════════════════════════════════════════════════════\n');

  await client.end();
  console.log('✅ Seed complete!');
}

run().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
