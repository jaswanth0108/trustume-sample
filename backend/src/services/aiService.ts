import { genai, GEMINI_MODEL } from '../config/gemini';
import {
  MessageAnalysisResult,
  MessageAnalysisResultSchema,
} from '../types/schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Timeout helper — prevents Gemini API calls from hanging indefinitely
// ─────────────────────────────────────────────────────────────────────────────
const AI_TIMEOUT_MS = 25_000;

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Analyse an inbound candidate message
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeMessage(
  messageBody: string,
  conversationHistory: Array<{ direction: string; message_body: string; sent_at: Date }>
): Promise<MessageAnalysisResult> {
  const historyText = conversationHistory
    .slice(-10) // last 10 messages for context
    .map(
      (m) =>
        `[${m.direction === 'inbound' ? 'CANDIDATE' : 'RECRUITER'} @ ${m.sent_at}]: ${m.message_body}`
    )
    .join('\n');

  const systemPrompt = `You are an expert recruitment AI assistant. 
Analyse the latest candidate message and return a structured JSON analysis.

Respond ONLY with valid JSON matching this exact schema:
{
  "primary_intent": one of ["interested","not_interested","asking_salary","asking_role_details","confirming_availability","providing_notice_period","requesting_callback","unknown"],
  "detected_interest": one of ["high","medium","low","none","unknown"],
  "confidence_score": float 0–1,
  "extracted_data": {
    "notice_period_days": number or null,
    "current_role": string or null,
    "current_company": string or null,
    "experience_years": number or null,
    "expected_salary": number or null,
    "current_salary": number or null,
    "available_from": "YYYY-MM-DD" or null,
    "preferred_location": string or null,
    "questions_asked": [{"category":"salary|role_details|work_location|benefits|interview_process|timeline|other","question_text":"..."}],
    "interview_slots": [{"description":"..."}]
  },
  "missing_fields": ["field_key", ...],
  "suggested_action": one of ["schedule_interview","follow_up","share_salary","share_jd","close_application","send_field_question","no_action"],
  "suggested_action_reason": "brief explanation"
}

For missing_fields, include any of: notice_period_days, current_role_title, experience_years, expected_salary, available_from`;

  const userPrompt = `Conversation History:
${historyText || '(No previous messages)'}

Latest Candidate Message:
"${messageBody}"

Analyse the latest message and return JSON.`;

  try {
    const interaction = await withTimeout(
      genai.interactions.create({
        model: GEMINI_MODEL,
        system_instruction: systemPrompt,
        input: userPrompt,
        store: false,
      })
    );

    const rawText = interaction.output_text || '';
    // Extract JSON from possible markdown code block
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
                      rawText.match(/```\s*([\s\S]*?)\s*```/) ||
                      rawText.match(/(\{[\s\S]*\})/);

    const jsonStr = jsonMatch ? jsonMatch[1] : rawText;
    const parsed = JSON.parse(jsonStr);
    return MessageAnalysisResultSchema.parse(parsed);
  } catch (err) {
    console.error('[AI] analyzeMessage failed, using fallback:', err);
    // Deterministic fallback
    return {
      primary_intent: 'unknown',
      detected_interest: 'unknown',
      confidence_score: 0,
      extracted_data: {
        notice_period_days: null,
        current_role: null,
        current_company: null,
        experience_years: null,
        expected_salary: null,
        current_salary: null,
        available_from: null,
        preferred_location: null,
        questions_asked: [],
        interview_slots: [],
      },
      missing_fields: [],
      suggested_action: 'follow_up',
      suggested_action_reason: 'AI analysis unavailable — manual review required.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Generate a recruiter reply draft
// ─────────────────────────────────────────────────────────────────────────────
export async function generateRecruiterReply(opts: {
  candidateName: string;
  candidateMessage: string;
  analysis: MessageAnalysisResult;
  jobRoleTitle: string;
  recruiterName: string;
  missingFieldQuestions: string[];
  conversationHistory: Array<{ direction: string; message_body: string }>;
}): Promise<string> {
  const historyText = opts.conversationHistory
    .slice(-6)
    .map((m) => `[${m.direction === 'inbound' ? 'CANDIDATE' : 'RECRUITER'}]: ${m.message_body}`)
    .join('\n');

  const missingFieldsSection =
    opts.missingFieldQuestions.length > 0
      ? `\nAlso politely ask about: ${opts.missingFieldQuestions.join(', ')}`
      : '';

  const prompt = `You are a professional recruiter named ${opts.recruiterName}.
Write a warm, professional email reply to the candidate.

Role: ${opts.jobRoleTitle}
Candidate name: ${opts.candidateName}
AI Understanding:
  - Intent: ${opts.analysis.primary_intent}
  - Interest level: ${opts.analysis.detected_interest}
  - Suggested action: ${opts.analysis.suggested_action} (${opts.analysis.suggested_action_reason})

Conversation so far:
${historyText || '(No previous messages)'}

Candidate's latest message:
"${opts.candidateMessage}"

Instructions:
- Address the candidate by first name
- Acknowledge their specific points (notice period, questions, etc.)
- Follow the suggested action: ${opts.analysis.suggested_action}${missingFieldsSection}
- Keep it concise (3-5 sentences max)
- End with "Best regards,\n${opts.recruiterName}"
- Do NOT include a subject line

Reply:`;

  try {
    const interaction = await withTimeout(
      genai.interactions.create({
        model: GEMINI_MODEL,
        input: prompt,
        store: false,
      })
    );
    return interaction.output_text?.trim() || 'Unable to generate reply. Please compose manually.';
  } catch (err) {
    console.error('[AI] generateRecruiterReply failed:', err);
    return `Hi ${opts.candidateName},\n\nThank you for your response. We will get back to you shortly.\n\nBest regards,\n${opts.recruiterName}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Recruiter chatbot — natural language query over candidate data
// ─────────────────────────────────────────────────────────────────────────────
function formatDeterministicFallback(
  query: string,
  candidateData: Record<string, unknown>[]
): string {
  const lq = query.toLowerCase();

  // 1. Join within 30 days
  if (lq.includes('30 day') || lq.includes('notice period') || (lq.includes('join') && lq.includes('within'))) {
    const matches = candidateData.filter(c => {
      const np = Number(c.notice_period_days);
      const isInterested = String(c.interest_status || '').toLowerCase() === 'interested';
      return isInterested && !isNaN(np) && np <= 30;
    });
    if (!matches.length) return 'No interested candidates found with a notice period of 30 days or less.';
    return (
      `Here are the interested candidates who can join within 30 days:\n\n` +
      matches
        .map(c => `• **${c.candidate_name}** — ${c.role_title} (${c.department || 'Engineering'})\n  Notice Period: ${Number(c.notice_period_days) === 0 ? '0 days (Available immediately)' : `${c.notice_period_days} days`}\n  Status: ${c.application_status} • Interest: Interested\n  Location: ${c.candidate_location || c.location || 'Remote'}`)
        .join('\n\n')
    );
  }

  // 2. Follow-ups due today
  if (lq.includes('follow up') || lq.includes('today') || lq.includes('tasks')) {
    const matches = candidateData.filter(c => c.pending_task_type || c.task_type || c.task_description);
    if (!matches.length) return 'You have no pending follow-up tasks due today. All caught up!';
    return (
      `Here are your follow-up tasks due today:\n\n` +
      matches
        .map(c => {
          const name = c.candidate_name || 'Candidate';
          const role = c.role_title || 'Role';
          const desc = String(c.pending_task_desc || c.task_description || c.pending_task_type || 'Follow up with candidate');
          const priority = (c.pending_task_priority || c.priority || 'medium').toString().toUpperCase();
          const cleanDesc = desc.replace(/^\[SEED\]\s*/i, '');
          return `• **${name}** — ${role} [${priority} Priority]\n  Action: ${cleanDesc}`;
        })
        .join('\n\n')
    );
  }

  // 3. Salary inquiry
  if (lq.includes('salary') || lq.includes('compensation') || lq.includes('pay')) {
    const matches = candidateData.filter(c => {
      const q = String(c.question_text || c.last_message || '').toLowerCase();
      const task = String(c.pending_task_type || c.task_type || '').toLowerCase();
      return q.includes('salary') || q.includes('compensation') || task.includes('salary');
    });
    if (!matches.length) return 'No candidates have asked about salary in your current pipeline.';
    return (
      `Here are the candidates who inquired about salary:\n\n` +
      matches
        .map(c => {
          const name = c.candidate_name || 'Candidate';
          const role = c.role_title || 'Role';
          const qText = c.question_text || c.last_message || 'Inquired about the salary range';
          const curSal = c.current_salary ? `₹${Number(c.current_salary).toLocaleString('en-IN')}` : 'Not shared';
          const expSal = c.expected_salary ? `₹${Number(c.expected_salary).toLocaleString('en-IN')}` : 'Not shared';
          return `• **${name}** — ${role}\n  Inquiry: "${qText}"\n  Current: ${curSal} • Expected: ${expSal}`;
        })
        .join('\n\n')
    );
  }

  // 4. Waiting for response
  if (lq.includes('waiting') || lq.includes('response from me') || lq.includes('awaiting')) {
    const matches = candidateData.filter(c => {
      const dir = String(c.last_message_direction || c.direction || '');
      const status = String(c.interest_status || '');
      return dir === 'inbound' || status === 'interested';
    });
    if (!matches.length) return 'No candidates are currently waiting for a response from you.';
    return (
      `Here are the candidates waiting for your response:\n\n` +
      matches
        .map(c => {
          const name = c.candidate_name || 'Candidate';
          const role = c.role_title || 'Role';
          const msg = c.last_message || c.last_candidate_message || 'Awaiting response';
          const cleanMsg = typeof msg === 'string' && msg.length > 100 ? msg.substring(0, 100) + '...' : msg;
          return `• **${name}** — ${role}\n  Last Message: "${cleanMsg}"\n  Status: ${c.application_status || 'Screening'}`;
        })
        .join('\n\n')
    );
  }

  // 5. Interested but not contacted in 3 days
  if (lq.includes('not contacted') || lq.includes('contacted in')) {
    const matches = candidateData.filter(c => String(c.interest_status || '').toLowerCase() === 'interested');
    if (!matches.length) return 'All interested candidates have been contacted recently.';
    return (
      `Here are the interested candidates awaiting contact:\n\n` +
      matches
        .map(c => {
          const name = c.candidate_name || 'Candidate';
          const role = c.role_title || 'Role';
          const np = c.notice_period_days !== undefined ? ` • ${c.notice_period_days} days notice` : '';
          return `• **${name}** — ${role} (Interested${np})\n  Application Status: ${c.application_status || 'screening'}`;
        })
        .join('\n\n')
    );
  }

  // 6. Available for interview this week
  if (lq.includes('interview') && (lq.includes('week') || lq.includes('available'))) {
    const matches = candidateData.filter(c => {
      const text = `${c.last_message || ''} ${c.pending_task_desc || ''} ${c.candidate_name || ''}`.toLowerCase();
      return text.includes('interview') || Number(c.notice_period_days) <= 30;
    });
    if (!matches.length) return 'No candidates currently scheduled for interviews this week.';
    return (
      `Here are the candidates ready or available for an interview:\n\n` +
      matches
        .map(c => `• **${c.candidate_name}** — ${c.role_title}\n  Availability: ${Number(c.notice_period_days) === 0 ? 'Immediate' : `${c.notice_period_days || 30} days notice`}\n  Status: ${c.application_status || 'Interview'}`)
        .join('\n\n')
    );
  }

  // General pipeline summary fallback
  if (!candidateData.length) return 'No candidates found matching your criteria in the pipeline.';
  return (
    `Here are the candidates in your pipeline (${candidateData.length} total):\n\n` +
    candidateData
      .slice(0, 8)
      .map(c => `• **${c.candidate_name || 'Candidate'}** — ${c.role_title || 'Role'}\n  Status: ${c.application_status || 'active'} • Interest: ${c.interest_status || 'unknown'}`)
      .join('\n\n')
  );
}

export async function answerRecruiterQuery(
  query: string,
  candidateData: Record<string, unknown>[]
): Promise<string> {
  const dataStr = JSON.stringify(candidateData, null, 2);

  const prompt = `You are the Trustume AI Recruitment Assistant.
Below is the current candidate pipeline data in JSON format:

CANDIDATE DATA:
${dataStr}

RECRUITER QUERY: "${query}"

Instructions:
- Answer the query using ONLY the provided data.
- Be concise, structured, professional, and directly actionable.
- Format with clear bullet points: • **Candidate Name** — Role Title (Department) followed by key details (Notice period, status, salary, or pending task).
- If no candidates match, clearly state that no matching candidates were found.
- Never hallucinate data that is not in the JSON.

Answer:`;

  try {
    const interaction = await withTimeout(
      genai.interactions.create({
        model: GEMINI_MODEL,
        input: prompt,
        store: false,
      })
    );
    const output = interaction.output_text?.trim();
    if (output && output.length > 10) {
      return output;
    }
    return formatDeterministicFallback(query, candidateData);
  } catch (err) {
    console.warn('[AI] Gemini call failed or timed out, using deterministic grounded answer:', err);
    return formatDeterministicFallback(query, candidateData);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Build auto follow-up message for a missing field
// ─────────────────────────────────────────────────────────────────────────────
export async function generateFieldQuestion(
  candidateName: string,
  fieldLabel: string,
  defaultQuestion: string,
  conversationContext: string
): Promise<string> {
  const prompt = `You are a recruiter. Write a single-sentence follow-up question to ask the candidate about their "${fieldLabel}".

Default question: "${defaultQuestion}"
Conversation context: "${conversationContext}"
Candidate name: ${candidateName}

Write a natural, polite single question. Do NOT include greetings or sign-offs — just the question sentence.`;

  try {
    const interaction = await withTimeout(
      genai.interactions.create({
        model: GEMINI_MODEL,
        input: prompt,
        store: false,
      })
    );
    return interaction.output_text?.trim() || defaultQuestion;
  } catch {
    return defaultQuestion;
  }
}
