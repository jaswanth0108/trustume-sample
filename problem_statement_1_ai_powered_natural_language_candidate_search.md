# Problem Statement 1: AI-Powered Natural Language Candidate Search & "Find Candidates Like Me"

## 1. Background & Problem Statement

Recruiters typically search for candidates by manually selecting multiple rigid filters such as job title, skills, experience, location, education, employment type, notice period, and other criteria. This manual workflow is time-consuming and breaks down when a recruiter has a nuanced hiring requirement or wants to source talent resembling an existing top performer.

The objective of this challenge is to build an **AI-Powered Natural Language Candidate Search Assistant** that allows recruiters to:
1. Describe their hiring requirements in plain English (or voice) and convert them into structured, editable search criteria.
2. Reference an existing candidate profile (*"Find candidates like [Candidate Name]"*) to automatically extract profile attributes and discover similar talent.
3. Inspect **explainable match breakdowns** and refine searches conversationally without resetting filters.

---

## 2. Core Functional Requirements

### A. Plain-English Requirement Extraction & Recruiter Confirmation
Instead of manually toggling multiple UI filters, a recruiter can enter a natural language prompt:

> *"Find me a Senior Java Developer in Hyderabad with 6 to 10 years of experience, strong Java and Spring Boot skills, AWS experience, and someone who can join within 30 days."*

The AI parses the intent and extracts structured parameters:

* **Role:** Senior Java Developer
* **Location:** Hyderabad
* **Experience:** 6–10 years
* **Required Skills:** Java, Spring Boot, AWS
* **Notice Period:** $\le 30$ days

**Human-in-the-Loop Step:** The recruiter must be able to review, edit, and click **Confirm Search** before the query executes against the candidate database.

---

### B. Explainable Candidate Match Breakdown
The system must not return an opaque black-box score. It must explicitly explain **why** each candidate matches or partially misses the criteria.

#### Example Output:

**Candidate A — Senior Java Developer**
* Experience: 8 years ($\checkmark$)
* Location: Hyderabad ($\checkmark$)
* Java ($\checkmark$)
* Spring Boot ($\checkmark$)
* AWS ($\checkmark$)
* Notice Period: 15 days ($\checkmark$)
* **Match:** `5/5 required criteria met`

**Candidate B — Java Backend Developer**
* Experience: 7 years ($\checkmark$)
* Location: Hyderabad ($\checkmark$)
* Java ($\checkmark$)
* Spring Boot ($\checkmark$)
* AWS ($\checkmark$)
* Notice Period: 60 days ($\times$)
* **Match:** `4/5 required criteria met` — *Notice period exceeds the specified 30-day requirement.*

---

### C. Conversational Search Refinement
The recruiter must be able to iteratively narrow or adjust results using follow-up prompts without restarting the search or manually resetting filters:

* **Recruiter:** *"Find Java developers with 5+ years of experience in Hyderabad."*
  * **AI:** *"I found 146 candidates matching your criteria."*
* **Recruiter:** *"Only show candidates with Spring Boot and AWS."*
  * **AI:** *"42 candidates match the updated criteria."*
* **Recruiter:** *"Now show only candidates who can join within 30 days."*
  * **AI:** *"18 candidates match the updated criteria."*

---

### D. "Find Candidates Like Me" (Reference-Based Search)
Recruiters can select or search for an existing ideal candidate by name and ask:

> *"Find candidates like Poornima Jasti"*

The system automatically analyzes the reference candidate's profile attributes:
* Current job title & previous roles
* Total years of experience
* Technical & professional skills
* Industry / domain background
* Location, education, and certifications

The recruiter can review the extracted profile criteria, confirm the search, view similarity scores with clear explanations (e.g., *"94% similarity — matching backend architecture, Java/Spring Boot stack, and 8 years tenure"*), and refine the cohort conversationally (e.g., *"Find candidates like Poornima Jasti with AWS experience"*).

---

## 3. Expected AI Workflow

```text
Recruiter Enters Requirement (Text / Voice / Reference Candidate)
                           │
                           ▼
            AI Understands Intent & Context
                           │
                           ▼
         Extracts Structured Search Criteria
                           │
                           ▼
        Recruiter Reviews / Edits Parameters
                           │
                           ▼
                    Confirm Search
                           │
                           ▼
      Candidate Database / Vector Store Query
                           │
                           ▼
     Ranked Candidates + Explainable Match Breakdown
                           │
                           ▼
       Multi-Turn Conversational Refinement
```

---

## 4. Technology Flexibility & Data

* **No Model Training Required:** Teams do **not** need to build or train an LLM from scratch.
* **Approved Stack:** You may use any open-source LLMs (Llama, Mistral, Qwen), locally hosted runners (Ollama), free-tier AI APIs (Gemini, OpenAI, Groq, Hugging Face), embedding models, vector databases (FAISS, ChromaDB), or NLP libraries.
* **Sample Data:** No dataset is provided. Teams must generate, mock, or structure their own realistic sample candidate database (JSON, CSV, SQLite, or Vector DB) to demonstrate the prototype.

---

## 5. Minimum Expected Outcome (Acceptance Checklist)

Your live demo and repository submission must demonstrate that a recruiter can:
- [ ] Enter a candidate requirement in plain English (or select a reference candidate).
- [ ] View the structured search criteria extracted by the AI.
- [ ] Edit and confirm the criteria before running the search.
- [ ] Retrieve matching candidates from a mock/sample candidate database.
- [ ] View transparent, criterion-by-criterion explanations for why each candidate matched.
- [ ] Refine the active search results using follow-up conversational prompts.