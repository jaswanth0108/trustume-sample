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
export async function answerRecruiterQuery(
  query: string,
  candidateData: Record<string, unknown>[]
): Promise<string> {
  const dataStr = JSON.stringify(candidateData, null, 2);

  const prompt = `You are a smart recruitment assistant for a recruiter.
Below is the current candidate pipeline data in JSON format.

CANDIDATE DATA:
${dataStr}

RECRUITER QUERY: "${query}"

Instructions:
- Answer the query using ONLY the provided data
- Be concise and structured
- If listing candidates, use bullet points with: Name — Status — Key detail
- If no candidates match, say so clearly
- Never hallucinate data not in the JSON

Answer:`;

  try {
    const interaction = await withTimeout(
      genai.interactions.create({
        model: GEMINI_MODEL,
        input: prompt,
        store: false,
      })
    );
    return interaction.output_text?.trim() || 'No answer generated.';
  } catch (err) {
    console.error('[AI] answerRecruiterQuery failed:', err);
    return 'Unable to process your query at the moment. Please try again.';
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
