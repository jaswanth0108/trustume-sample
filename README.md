# 🏢 Trustume — AI-Powered Recruitment Management Platform

<div align="center">

[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://trustume-frontend.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render)](https://trustume-backend.onrender.com)
[![DB](https://img.shields.io/badge/Database-PostgreSQL-316192?logo=postgresql)](https://neon.tech)
[![AI](https://img.shields.io/badge/AI-Gemini%20API-4285F4?logo=google)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Trustume** is a full-stack AI-powered recruitment management system that bridges recruiters and candidates through intelligent workflows, real-time messaging, and AI-driven insights.

[🔗 Live Demo](https://trustume-frontend.vercel.app) · [📡 API](https://trustume-backend.onrender.com/health) · [🐛 Issues](https://github.com/jaswanth0108/trustume-sample/issues)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Getting Started](#-getting-started)
- [🗄️ Database Schema](#️-database-schema)
- [🤖 AI Capabilities](#-ai-capabilities)
- [👤 User Portals](#-user-portals)
- [🔌 API Reference](#-api-reference)
- [🌐 Deployment](#-deployment)
- [🧪 Test Credentials](#-test-credentials)
- [📊 Hackathon Feature Highlights](#-hackathon-feature-highlights)

---

## ✨ Features

### 🎯 For Recruiters
| Feature | Description |
|---------|-------------|
| **Dashboard** | Real-time pipeline overview with candidate stats, interview counts, and offer tracking |
| **Candidate Pipeline** | Browse, search, and manage all candidate applications in one place |
| **Job Role Management** | Create roles with salary ranges, employment types, and lifecycle status (Active / Draft / Close) |
| **AI Reply Generator** | Click "Generate Reply" on any candidate message — Gemini AI drafts a professional response instantly |
| **AI Assistant Chatbot** | Natural language queries: *"Who should I follow up with today?"*, *"Which candidates asked about salary?"* |
| **Conversation Threads** | Full email-style conversation history per candidate with timestamps and direction indicators |
| **Follow-Up Tasks** | AI-extracted follow-up tasks from conversations, sortable by priority |
| **Draft Management** | Save, edit, and send AI-generated reply drafts from a central Drafts page |
| **Message Simulation** | Simulate incoming candidate messages for demo/testing without an actual email system |

### 🎓 For Candidates (Fresher Portal)
| Feature | Description |
|---------|-------------|
| **Explore Jobs** | Browse all active job listings with search by title, location, and type |
| **One-Click Apply** | Apply to any job instantly; duplicate-apply prevention built in |
| **My Applications** | Real-time dashboard showing all applied jobs with application status |
| **Conversation View** | Read recruiter messages and reply directly from the portal |
| **Status Tracking** | See pipeline status (New → Screening → Interview → Offer → Hired) |

### 👑 For CEO
| Feature | Description |
|---------|-------------|
| **Global View** | See all candidates, applications, and jobs across all recruiters |
| **AI Assistant** | Org-wide queries: *"Show all candidates interviewing this week"* |
| **Pipeline Analytics** | Cross-recruiter candidate pipeline with salary, notice period, and interest data |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│                                                                   │
│  ┌─────────────────────┐    ┌──────────────────────────────┐    │
│  │  Recruiter / CEO    │    │     Candidate (Fresher)       │    │
│  │   Portal (React)    │    │        Portal (React)         │    │
│  │  /dashboard         │    │  /fresher/explore             │    │
│  │  /candidates        │    │  /fresher/dashboard           │    │
│  │  /jobs              │    │  /fresher/conversation/:id    │    │
│  │  /conversations/:id │    │                               │    │
│  │  /ai-assistant      │    └──────────────────────────────┘    │
│  └─────────────────────┘                                         │
│           │ HTTPS/REST (Axios)          │ HTTPS/REST (Axios)     │
└───────────┼─────────────────────────────┼────────────────────────┘
            │                             │
┌───────────▼─────────────────────────────▼────────────────────────┐
│                      API LAYER (Render)                            │
│                                                                     │
│  Node.js + Express + TypeScript                                     │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │  /auth   │ │/candidates│ │/job-roles│ │  /ai     │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │/messages │ │/fresher  │ │/dashboard│ │  /drafts │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│       │                          │                                  │
│  JWT Auth Middleware         Gemini AI SDK                          │
└───────┼──────────────────────────┼──────────────────────────────────┘
        │                          │
┌───────▼──────────────┐  ┌───────▼──────────────────────────────┐
│   PostgreSQL (Neon)  │  │         Google Gemini API              │
│                      │  │   gemini-2.5-flash-preview-05-20       │
│  16 tables           │  │   - analyzeMessage()                   │
│  SSL-encrypted       │  │   - generateRecruiterReply()           │
│  Connection pooling  │  │   - answerRecruiterQuery()             │
└──────────────────────┘  └──────────────────────────────────────┘
```

### Request Flow — Generate AI Reply

```
Recruiter clicks "Generate Reply"
         │
         ▼
POST /api/ai/generate-reply
  { application_id, message_id }
         │
         ├─── Fetch message text from DB
         ├─── Fetch conversation history (last 15 msgs)
         ├─── Check for existing AI analysis
         │        └─ If none: run analyzeMessage() inline → save to DB
         │
         ├─── generateRecruiterReply() → Gemini API
         │        └─ Fallback: "Thank you, we'll be in touch"
         │
         ├─── Save draft to reply_drafts table
         │
         └─── Return { draft, draft_content }
                  │
                  ▼
           Frontend shows editable draft
           Recruiter edits → clicks Send
                  │
                  ▼
         POST /api/messages/outbound
         → Saved to messages table
         → Thread status → awaiting_candidate
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 18 + Vite + TypeScript | Fast HMR, type safety, modern DX |
| **State/Data** | TanStack Query (React Query) | Server state, caching, background refetch |
| **Styling** | Tailwind CSS + custom design tokens | Utility-first, rapid prototyping |
| **Routing** | React Router v6 | SPA routing with nested layouts |
| **HTTP Client** | Axios | Interceptors for JWT auto-attach & 401 logout |
| **Backend** | Node.js + Express + TypeScript | Typed, battle-tested REST framework |
| **ORM/DB** | Raw `pg` with `Pool` | Full SQL control, optimal for complex joins |
| **Database** | PostgreSQL 16 on Neon.tech | Serverless Postgres, free tier, SSL support |
| **Auth** | JWT (jsonwebtoken) + bcryptjs | Stateless, secure, two separate token namespaces |
| **AI** | Google Gemini API (`@google/genai`) | `interactions.create()` for structured generation |
| **Validation** | Zod | Schema-first runtime validation + TypeScript inference |
| **Hosting** | Vercel (frontend) + Render (backend) | Free tier, auto-deploy on git push |
| **Notifications** | react-hot-toast | Non-intrusive, beautiful toast notifications |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- PostgreSQL (or a [Neon.tech](https://neon.tech) free account)
- Google Gemini API key (free at [ai.google.dev](https://ai.google.dev))

### 1. Clone the repository

```bash
git clone https://github.com/jaswanth0108/trustume-sample.git
cd trustume-sample
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://user:pass@host/trustume?sslmode=require
JWT_SECRET=your-super-secret-jwt-key
GEMINI_API_KEY=your-gemini-api-key
FRONTEND_URL=http://localhost:3000
```

Compile and run:

```bash
npm run build      # Compile TypeScript → dist/
npm start          # Production server
# OR
npm run dev        # Development with ts-node-dev (hot reload)
```

### 3. Database setup

The schema creates all 16 tables automatically. Run against your Postgres instance:

```bash
psql $DATABASE_URL -f backend/src/db/schema.sql
```

**Seed sample data** (creates 3 recruiters + 5 candidates + 5 jobs + applications):

```bash
# Start the backend first, then:
curl -X POST "http://localhost:4000/api/seed?secret=trustume-seed-2024"
```

### 4. Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

Run dev server:

```bash
npm run dev        # Starts on http://localhost:3000
```

---

## 🗄️ Database Schema

The database consists of **16 tables** organized around the core recruitment workflow:

```
recruiters ──────────────────────────────────────────────┐
    │                                                     │
    │ (recruiter_id FK)                                   │
    ▼                                                     │
job_roles          candidates                             │
    │                   │                                 │
    └──── applications ─┘ ◄───────────────────────────── ┘
              │               recruiter_id FK
              │
     ┌────────┼──────────────┐
     │        │              │
     ▼        ▼              ▼
application  conversation  follow_up
_details     _threads       _tasks
                │
                ▼
            messages ──► message_analyses
                │
                ▼
            reply_drafts
```

### Key Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `recruiters` | Recruiter/CEO accounts | `recruiter_id`, `email`, `role` (recruiter/ceo) |
| `candidates` | Candidate profiles | `candidate_id`, `email`, `password_hash`, `location` |
| `job_roles` | Job listings | `job_role_id`, `role_title`, `status` (active/paused/closed), `salary_min/max` |
| `applications` | Candidate-Job links | `application_id`, `candidate_id`, `job_role_id`, `recruiter_id`, `application_status` |
| `conversation_threads` | Message threads | `thread_id`, `application_id`, `thread_status`, `channel` |
| `messages` | Individual messages | `message_id`, `direction` (inbound/outbound), `message_body`, `sender_type` |
| `message_analyses` | Gemini AI analysis | `primary_intent`, `detected_interest`, `confidence_score`, `suggested_action` |
| `reply_drafts` | AI-generated drafts | `draft_id`, `draft_content`, `draft_status`, `based_on_message_id` |
| `follow_up_tasks` | Recruiter tasks | `task_type`, `task_description`, `priority`, `task_status` |
| `application_details` | Candidate details | `notice_period_days`, `expected_salary`, `experience_years` |

---

## 🤖 AI Capabilities

Trustume uses the **Google Gemini API** (`gemini-2.5-flash-preview-05-20`) for three distinct AI functions:

### 1. Message Analysis (`analyzeMessage`)

When a candidate message arrives, Gemini parses it and returns structured JSON:

```json
{
  "primary_intent": "asking_salary",
  "detected_interest": "high",
  "confidence_score": 0.92,
  "extracted_data": {
    "notice_period_days": 30,
    "expected_salary": 1500000,
    "current_role": "Software Engineer"
  },
  "suggested_action": "share_salary",
  "suggested_action_reason": "Candidate is highly interested and asking about compensation"
}
```

**Fallback:** If Gemini times out, a deterministic fallback returns `unknown` intent with `follow_up` action — the app keeps working.

### 2. Reply Generation (`generateRecruiterReply`)

```
Input:  candidate message + AI analysis + conversation history + job details
Output: Professional recruiter reply (3-5 sentences)
```

**Smart features:**
- Addresses candidate by first name
- Acknowledges specific details (notice period, salary ask)
- Follows the AI-suggested action
- Ends with recruiter's signature
- If no analysis exists yet → runs analysis inline, then generates reply

### 3. Recruiter AI Assistant (`answerRecruiterQuery`)

Natural language Q&A over real candidate data. Routes queries to optimized DB functions:

| Query | DB Function | Returns |
|-------|------------|---------|
| *"Who needs a follow-up?"* | `getFollowUpsDueToday()` | Tasks with candidate + priority |
| *"Which candidates asked about salary?"* | `getSalaryAskers()` | Candidates with salary inquiries |
| *"Who's waiting for my response?"* | `getWaitingForResponse()` | Threads where last message is outbound |
| *"Show candidates who can join in 30 days"* | Pipeline filter | Interested candidates, notice ≤ 30 days |
| *"Who hasn't been contacted?"* | `getInterestedNotContacted()` | Candidates with no outbound messages |

**Deterministic fallback:** If Gemini is unavailable, queries are answered directly from DB data without AI.

---

## 👤 User Portals

### Recruiter Portal (`/login`)

```
/dashboard          → Pipeline overview, stats, follow-up tasks
/candidates         → All candidate profiles
/jobs               → Job role management (Active/Draft/Close lifecycle)
/conversations      → All active conversation threads
/conversations/:id  → Full conversation with AI tools
/ai-assistant       → Natural language chatbot
/drafts             → Manage AI-generated reply drafts
/tasks              → All pending follow-up tasks
/settings           → Account settings
```

### Candidate (Fresher) Portal (`/fresher/login`)

```
/fresher/dashboard          → My applications, status tracking
/fresher/explore            → Browse & apply to active jobs
/fresher/conversation/:id   → View messages, send replies
```

### Auth Flow

```
Recruiter Login:                    Fresher Login:
POST /api/auth/login                POST /api/fresher/login
  → JWT stored as                     → JWT stored as
    'trustume_token'                    'trustume_fresher_token'
  → Role: 'recruiter' or 'ceo'       → Candidate profile decoded
  → CEO sees all data                 → Scoped to own applications
```

---

## 🔌 API Reference

Base URL: `https://trustume-backend.onrender.com/api`

All recruiter endpoints require `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Body | Description |
|--------|---------|------|-------------|
| `POST` | `/auth/login` | `{ email, password }` | Recruiter/CEO login |
| `POST` | `/auth/register` | `{ full_name, email, password }` | Register recruiter |
| `POST` | `/fresher/login` | `{ email, password }` | Candidate login |

### Jobs

| Method | Endpoint | Description |
|--------|---------|-------------|
| `GET` | `/job-roles` | List all non-closed job roles |
| `POST` | `/job-roles` | Create new job role |
| `PATCH` | `/job-roles/:id/status` | Set status: `active` / `paused` (Draft) / `closed` (removes) |
| `GET` | `/fresher/jobs` | Public list of active jobs |
| `POST` | `/fresher/jobs/:jobId/apply` | Candidate applies to job |

### Applications

| Method | Endpoint | Description |
|--------|---------|-------------|
| `GET` | `/applications` | List applications (recruiter's own, or all if CEO) |
| `GET` | `/applications/:id` | Full application detail with thread + collected fields |
| `PATCH` | `/applications/:id/status` | Update pipeline status |
| `GET` | `/fresher/applications` | Candidate's own applications |

### Messages & AI

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/messages/inbound` | Receive candidate message → triggers AI analysis |
| `POST` | `/messages/outbound` | Send recruiter reply |
| `GET` | `/messages/thread/:threadId` | Get conversation history |
| `POST` | `/ai/generate-reply` | Generate AI draft reply for a candidate message |
| `POST` | `/ai/recruiter-query` | Natural language AI assistant query |

### Dashboard

| Method | Endpoint | Description |
|--------|---------|-------------|
| `GET` | `/dashboard/stats` | Counts: total candidates, interviews, offers |
| `GET` | `/dashboard/triage` | Candidates needing immediate attention |
| `GET` | `/dashboard/follow-ups` | Pending follow-up tasks |
| `GET` | `/dashboard/salary-queries` | Candidates who asked about salary |
| `GET` | `/dashboard/waiting-response` | Threads awaiting recruiter reply |

---

## 🌐 Deployment

### Frontend — Vercel

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Set root directory to `frontend/`
3. Add environment variable: `VITE_API_URL=https://your-render-backend.onrender.com/api`
4. The `vercel.json` already configures SPA routing rewrites

### Backend — Render

1. Connect repo to [Render](https://render.com) → New Web Service
2. Root directory: `backend/`
3. Build command: `npm install && npx tsc`
4. Start command: `node dist/index.js`
5. Add environment variables:

```
DATABASE_URL=postgresql://...neon.tech/trustume?sslmode=require
JWT_SECRET=<strong-random-string>
GEMINI_API_KEY=<your-gemini-key>
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
```

### Database — Neon.tech

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the connection string (includes SSL by default)
3. Run `schema.sql` from the Neon SQL editor or via `psql`
4. Seed data via: `POST /api/seed?secret=trustume-seed-2024`

---

## 🧪 Test Credentials

> These accounts are pre-seeded in the live demo database.

### Recruiters / CEO

| Role | Email | Password |
|------|-------|---------|
| Recruiter | `sarah@gmail.com` | `Recruiter@123` |
| Recruiter | `michael@gmail.com` | `Recruiter@123` |
| CEO | `ceo@gmail.com` | `CEO@123456` |

### Candidates (Fresher Portal at `/fresher/login`)

| Name | Email | Password |
|------|-------|---------|
| Rahul Sharma | `rahul@gmail.com` | `Fresher@123` |
| Priya Patel | `priya@gmail.com` | `Fresher@123` |
| Arjun Mehta | `arjun@gmail.com` | `Fresher@123` |
| Sneha Reddy | `sneha@gmail.com` | `Fresher@123` |
| Kiran Kumar | `kiran@gmail.com` | `Fresher@123` |

---

## 📊 Hackathon Feature Highlights

### 🧠 AI-First Design
- **3 distinct AI use cases**: message analysis, reply generation, natural language querying
- **Graceful degradation**: every AI feature has a deterministic fallback — the app never breaks if Gemini is unavailable
- **Real data only**: AI queries are grounded in actual DB records, never hallucinated

### ⚡ Full-Stack in 48 Hours
- 16-table PostgreSQL schema designed from scratch
- Dual portal architecture (recruiter + candidate) with separate auth flows
- End-to-end apply workflow: job listing → application → conversation → offer

### 🔐 Production-Grade Security
- JWT authentication with separate token namespaces per portal
- bcrypt password hashing
- SSL-enforced database connections (Neon)
- CORS scoped to specific origins

### 📈 Scalable Architecture
- Stateless REST API — horizontally scalable
- Connection pooling via `pg.Pool`
- TanStack Query for client-side caching (reduces redundant API calls)
- Background refetch every 10 seconds for live conversation updates

### 💸 100% Free Resources
| Service | Free Tier Used |
|---------|--------------|
| Vercel | Unlimited hobby deployments |
| Render | 750 hrs/month free web service |
| Neon.tech | 512 MB PostgreSQL, 10 branches |
| Google Gemini | 15 RPM free tier |

---

## 📁 Project Structure

```
trustume-sample/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts      # pg Pool + SSL config
│   │   │   └── gemini.ts        # Gemini client init
│   │   ├── db/
│   │   │   ├── schema.sql       # Full 16-table schema
│   │   │   └── seed.mjs         # Sample data seeder
│   │   ├── middleware/
│   │   │   ├── auth.ts          # JWT middleware (recruiter/CEO)
│   │   │   ├── fresherAuth.ts   # JWT middleware (candidate)
│   │   │   ├── errorHandler.ts  # Global error handler
│   │   │   └── validate.ts      # Zod request validation
│   │   ├── routes/
│   │   │   ├── auth.ts          # Login/register
│   │   │   ├── candidates.ts    # Candidate CRUD
│   │   │   ├── jobRoles.ts      # Job role lifecycle
│   │   │   ├── applications.ts  # Application management
│   │   │   ├── messages.ts      # Inbound/outbound messages
│   │   │   ├── ai.ts            # Generate reply + AI assistant
│   │   │   ├── dashboard.ts     # Dashboard data endpoints
│   │   │   ├── drafts.ts        # Reply draft management
│   │   │   ├── tasks.ts         # Follow-up task management
│   │   │   ├── fresher.ts       # Candidate portal routes
│   │   │   └── seed.ts          # One-time seed endpoint
│   │   ├── services/
│   │   │   ├── aiService.ts     # Gemini API wrappers + fallbacks
│   │   │   ├── dashboardService.ts  # Dashboard data aggregation
│   │   │   └── messageService.ts    # Inbound message processing
│   │   ├── types/
│   │   │   └── schemas.ts       # Zod schemas + TypeScript types
│   │   └── index.ts             # Express app entry point
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   ├── index.ts          # Recruiter API (Axios + interceptors)
    │   │   └── fresherApi.ts     # Candidate API
    │   ├── components/
    │   │   ├── layout/
    │   │   │   └── AppLayout.tsx # Recruiter sidebar layout
    │   │   ├── fresher/
    │   │   │   └── FresherLayout.tsx  # Candidate top-nav layout
    │   │   └── ui/               # Shared UI components (Badge, Modal, etc.)
    │   ├── context/
    │   │   ├── AuthContext.tsx       # Recruiter auth state
    │   │   └── FresherAuthContext.tsx # Candidate auth state
    │   ├── pages/
    │   │   ├── DashboardPage.tsx
    │   │   ├── CandidatesPage.tsx
    │   │   ├── JobRolesPage.tsx      # Active/Draft/Close management
    │   │   ├── ConversationPage.tsx  # AI reply generator
    │   │   ├── AIAssistantPage.tsx   # Natural language chatbot
    │   │   └── fresher/
    │   │       ├── FresherDashboardPage.tsx   # My Applications
    │   │       ├── FresherExploreJobsPage.tsx # Browse & Apply
    │   │       ├── FresherLoginPage.tsx
    │   │       └── FresherConversationPage.tsx
    │   ├── types/                # TypeScript interfaces
    │   ├── utils/                # Formatting helpers
    │   ├── App.tsx               # Route definitions
    │   └── main.tsx              # Vite entry point
    ├── vercel.json               # SPA routing rewrites
    └── package.json
```

---

## 🤝 Contributing

This is a hackathon project. For suggestions or bugs, open an issue.

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built with ❤️ for the hackathon · Powered by Google Gemini AI
</div>
