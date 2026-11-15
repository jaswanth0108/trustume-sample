import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() { return localStorage.getItem('trustume_fresher_token') || ''; }
function h() { return { Authorization: `Bearer ${getToken()}` }; }

export const fresherApi = {
  login:       (email: string, password: string) =>
    axios.post(`${BASE}/fresher/login`, { email, password }),

  register:    (data: { full_name: string; email: string; password: string; phone?: string; location?: string }) =>
    axios.post(`${BASE}/fresher/register`, data),

  // Profile management
  getProfile: () => axios.get(`${BASE}/profile/candidate`, { headers: h() }),
  updateProfile: (data: object) => axios.put(`${BASE}/profile/candidate`, data, { headers: h() }),
  addSkill: (skill_name: string, proficiency: string) => axios.post(`${BASE}/profile/skills`, { skill_name, proficiency }, { headers: h() }),
  deleteSkill: (skillId: string) => axios.delete(`${BASE}/profile/skills/${skillId}`, { headers: h() }),
  addProject: (data: object) => axios.post(`${BASE}/profile/projects`, data, { headers: h() }),
  deleteProject: (projectId: string) => axios.delete(`${BASE}/profile/projects/${projectId}`, { headers: h() }),
  // Apply with full application
  submitApplication: (jobId: string, data: object) => axios.post(`${BASE}/profile/apply/${jobId}`, data, { headers: h() }),

  getApplications: () =>
    axios.get(`${BASE}/fresher/applications`, { headers: h() }),

  getMessages: (applicationId: string) =>
    axios.get(`${BASE}/fresher/applications/${applicationId}/messages`, { headers: h() }),

  sendReply:   (applicationId: string, message_body: string) =>
    axios.post(`${BASE}/fresher/applications/${applicationId}/reply`, { message_body }, { headers: h() }),

  // ── Explore Jobs ────────────────────────────────────────────────────────
  getJobs:     () =>
    axios.get(`${BASE}/fresher/jobs`, { headers: h() }),

  getAppliedJobs: () =>
    axios.get(`${BASE}/fresher/applied-jobs`, { headers: h() }),

  getJobDetail: (jobId: string) =>
    axios.get(`${BASE}/fresher/jobs/${jobId}`, { headers: h() }),

  applyToJob:  (jobId: string) =>
    axios.post(`${BASE}/fresher/jobs/${jobId}/apply`, {}, { headers: h() }),
};
