# Problem Statement 2: AI Candidate Response & Conversational Follow-Up Assistant

## 1. Background & Problem Statement

Recruiters reach out to hundreds of candidates across email and messaging channels, receiving unstructured replies in varied formats:
* *"Yes, I'm interested."*
* *"I'm interested, but I can join only after 60 days."*
* *"Please share the salary range."*
* *"I'm currently not looking."*
* *"Can we schedule the interview next week?"*
* Complete silence (no response).

Critical details—such as candidate interest level, notice period, salary expectations, and pending recruiter actions—get buried inside long email threads. Recruiters spend hours manually reading messages, triaging next steps, and writing repetitive follow-ups.

The objective of this challenge is to build an **AI Candidate Response & Follow-Up Assistant** that:
1. Automatically classifies incoming candidate messages and extracts structured intent, notice periods, and suggested actions.
2. Generates contextual, one-click follow-up replies for recruiter review and dispatch.
3. Provides a **natural language conversational assistant** allowing recruiters to query their entire candidate communication history for actionable answers.

---

## 2. Core Functional Requirements

### A. Automated Message Parsing & Triage Dashboard
The system ingests candidate email/message threads, extracts key entities, and surfaces an actionable dashboard.

#### Example Parsing:
* **Candidate:** Rahul
* **Message:** *"Hi, thanks for reaching out. I'm interested in the opportunity. However, my notice period is 60 days. Please let me know if that works."*
* **AI Extraction:**
  * **Intent:** Interested
  * **Notice Period:** 60 days
  * **Suggested Action:** Recruiter follow-up required

#### Example Recruiter Triage Dashboard:

| Candidate | AI Understanding | Suggested Action |
| :--- | :--- | :--- |
| **Rahul** | Interested – 60-day notice | Follow up |
| **Priya** | Interested – Available immediately | Schedule interview |
| **Arjun** | Not interested | Close / No action |
| **Sneha** | Wants salary details | Share compensation details |
| **Kiran** | Available next month | Follow up later |
| **Anil** | No response (72 hrs elapsed) | Send follow-up |

---

### B. One-Click Contextual Follow-Up Generation
For any candidate requiring action, the recruiter can click **"Generate Response"** to draft an appropriate, context-aware reply.

#### Example Generated Draft (for Rahul):
> *Hi Rahul,*  
> *Thanks for your response. The team is open to discussing the 60-day notice period. Could you please share your availability for an initial discussion?*  
> *Best regards,*

The recruiter can review, edit, and send the message directly from the interface.

---

### C. Natural Language Assistant Over Candidate Conversations
The system must analyze conversation threads across all candidates to track:
* Candidate interest level & last communication status
* Availability / joining date & notice period
* Salary expectations & candidate questions
* Pending recruiter responses & follow-up urgency

Recruiters can query their inbox in plain English:
* *"Show me all interested candidates who can join within 30 days."*
* *"Who is waiting for a response from me?"*
* *"Which candidates asked about salary?"*
* *"Who should I follow up with today?"*
* *"Show candidates who are interested but haven't been contacted in the last 3 days."*
* *"Who said they are available for an interview this week?"*

#### Example Conversational Output:
* **Recruiter Query:** *"Who should I follow up with today?"*
* **AI Response:**  
  *3 candidates require follow-up today:*
  1. **Rahul Kumar** — Interested, waiting for interview schedule
  2. **Priya Sharma** — Asked about salary range, no response sent
  3. **Arjun Rao** — Interested, requested a call next week

---

## 3. Expected AI Workflow

```text
Candidate Email / Message Threads (Mocked Dataset)
                       │
                       ▼
   NLP / LLM Intent & Entity Extraction Engine
   (Interest, Notice Period, Salary, Pending Status)
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
Triage Dashboard &            Conversational Inbox
1-Click Reply Generator       Natural Language Q&A
        │                             │
        └──────────────┬──────────────┘
                       ▼
      Recruiter Reviews, Edits & Takes Action
```

---

## 4. Technology Flexibility & Data

* **No Model Training Required:** Teams can leverage any pre-trained LLMs, open-source models (Llama, Mistral, Qwen via Ollama), free-tier APIs (Gemini, OpenAI, Groq, Hugging Face), or RAG/embedding pipelines.
* **Sample Data:** No dataset is provided. Teams must create a rich mock dataset of multi-turn candidate email/message threads covering diverse intents, edge cases, and unanswered follow-ups.

---

## 5. Minimum Expected Outcome (Acceptance Checklist)

Your live demo and repository submission must demonstrate that a recruiter can:
- [ ] View a structured dashboard automatically classifying mocked candidate replies by intent, notice period, and suggested next action.
- [ ] Click **Generate Response** to produce a contextually tailored reply that can be edited before sending.
- [ ] Ask natural language questions across all candidate conversations (e.g., *"Who is waiting for a response from me?"*) and receive accurate, grounded candidate lists with explanations.