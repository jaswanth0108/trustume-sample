-- Extended candidate profile fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS headline VARCHAR(200);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS experience_years NUMERIC(4,1);

-- Candidate skills
CREATE TABLE IF NOT EXISTS candidate_skills (
  skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  skill_name VARCHAR(100) NOT NULL,
  proficiency VARCHAR(20) DEFAULT 'intermediate' CHECK (proficiency IN ('beginner','intermediate','advanced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_candidate_skills ON candidate_skills(candidate_id);

-- Candidate projects  
CREATE TABLE IF NOT EXISTS candidate_projects (
  project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  technologies TEXT,
  repo_url TEXT,
  live_url TEXT,
  contribution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_candidate_projects ON candidate_projects(candidate_id);

-- Application submission snapshot
CREATE TABLE IF NOT EXISTS application_submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID UNIQUE NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  full_name VARCHAR(150),
  email CITEXT,
  phone VARCHAR(30),
  location VARCHAR(200),
  headline VARCHAR(200),
  education TEXT,
  experience_years NUMERIC(4,1),
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  resume_filename VARCHAR(255),
  resume_mimetype VARCHAR(100),
  resume_data TEXT,
  skills_snapshot JSONB DEFAULT '[]',
  projects_snapshot JSONB DEFAULT '[]',
  motivation TEXT,
  suitability TEXT,
  notice_period_days INT,
  willing_to_relocate BOOLEAN DEFAULT false,
  additional_info TEXT,
  recruiter_notes TEXT,
  verification_status VARCHAR(30) DEFAULT 'submitted'
    CHECK (verification_status IN ('submitted','under_review','shortlisted','rejected','interview_scheduled','selected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_submissions_app ON application_submissions(application_id);
