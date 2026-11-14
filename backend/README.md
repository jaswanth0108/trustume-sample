# Trustume Backend — Setup Guide

## Prerequisites
- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14 (running locally or remote)
- **Gemini API key** — get one at https://aistudio.google.com/app/apikey

---

## 1. Configure Environment

```bash
# In backend/
cp .env.example .env
```

Open `.env` and fill in:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trustume          # create this DB first (see step 2)
DB_USER=postgres
DB_PASSWORD=your_pg_password

GEMINI_API_KEY=your_key_here

JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d

PORT=4000
```

---

## 2. Create the PostgreSQL Database

```sql
-- In psql or pgAdmin:
CREATE DATABASE trustume;
```

---

## 3. Apply the Schema (all 16 tables)

```bash
cd backend
npm run db:migrate
```

This runs `src/db/schema.sql` and seeds default field definitions + message templates.

---

## 4. Start the Dev Server

```bash
npm run dev
```

Server starts at **http://localhost:4000**

---

## API Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register recruiter |
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/candidates` | Add candidate |
| GET | `/api/candidates` | List candidates |
| POST | `/api/job-roles` | Create job role |
| GET | `/api/job-roles` | List active roles |
| POST | `/api/applications` | Create application + thread |
| GET | `/api/applications` | List applications |
| **POST** | **`/api/messages/inbound`** | **Receive candidate msg → AI pipeline** |
| POST | `/api/messages/outbound` | Send recruiter message |
| GET | `/api/messages/thread/:id` | Conversation history |
| **POST** | **`/api/ai/generate-reply`** | **Generate AI draft reply** |
| **POST** | **`/api/ai/recruiter-query`** | **NL chatbot ("Show interested candidates")** |
| GET | `/api/dashboard/triage` | Full triage dashboard |
| GET | `/api/dashboard/stats` | Summary numbers |
| GET | `/api/dashboard/follow-ups` | Tasks due today |
| GET | `/api/dashboard/waiting-response` | Waiting for recruiter reply |
| GET | `/api/dashboard/salary-queries` | Candidates who asked about salary |
| GET | `/api/dashboard/not-contacted?days=3` | Interested but not contacted |
| GET | `/api/drafts` | Pending AI drafts |
| PATCH | `/api/drafts/:id` | Edit draft content |
| GET | `/health` | Health check |

---

## AI Workflow (per inbound message)

```
Candidate Message
      ↓
POST /api/messages/inbound
      ↓
1. Store message in DB
2. Fetch conversation history (last 20 msgs)
3. Gemini AI → structured JSON analysis
4. Zod validation + deterministic fallback
5. Store analysis in message_analyses
6. Update application_field_answers
7. Update application interest_status
8. Store candidate_questions
9. Create follow_up_task
10. Return full result to frontend
      ↓
Recruiter clicks "Generate Reply"
POST /api/ai/generate-reply
      ↓
Gemini generates contextual reply draft
Saved to reply_drafts (editable)
      ↓
Recruiter edits + sends
POST /api/messages/outbound
```

---

## Recruiter Chatbot Examples

```json
POST /api/ai/recruiter-query
{ "query": "Show me all interested candidates who can join within 30 days" }

{ "query": "Who should I follow up with today?" }

{ "query": "Which candidates asked about salary?" }

{ "query": "Who is waiting for a response from me?" }

{ "query": "Show candidates who are interested but haven't been contacted in 3 days" }
```
