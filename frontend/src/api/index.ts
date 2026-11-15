import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('trustume_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('trustume_token');
      localStorage.removeItem('trustume_recruiter');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  login:    (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (full_name: string, email: string, password: string) =>
    api.post('/auth/register', { full_name, email, password }),
};

// ── Candidates ───────────────────────────────────────────────
export const candidatesApi = {
  list:   ()         => api.get('/candidates'),
  get:    (id: string) => api.get(`/candidates/${id}`),
  create: (data: object) => api.post('/candidates', data),
};

// ── Job Roles ────────────────────────────────────────────────
export const jobRolesApi = {
  list:   ()         => api.get('/job-roles'),
  get:    (id: string) => api.get(`/job-roles/${id}`),
  create: (data: object) => api.post('/job-roles', data),
  setStatus: (id: string, status: string) => api.patch(`/job-roles/${id}/status`, { status }),
};

// ── Applications ─────────────────────────────────────────────
export const applicationsApi = {
  list:       ()         => api.get('/applications'),
  get:        (id: string) => api.get(`/applications/${id}`),
  create:     (data: object) => api.post('/applications', data),
  setStatus:  (id: string, status: string) =>
    api.patch(`/applications/${id}/status`, { application_status: status }),
};

// ── Messages ─────────────────────────────────────────────────
export const messagesApi = {
  sendInbound:       (data: object) => api.post('/messages/inbound', data),
  sendOutbound:      (data: object) => api.post('/messages/outbound', data),
  getThread:         (threadId: string) => api.get(`/messages/thread/${threadId}`),
  getAnalysis:       (messageId: string) => api.get(`/messages/${messageId}/analysis`),
  getThreadsByApp:   (applicationId: string) => api.get(`/messages/threads/application/${applicationId}`),
};

// ── AI ────────────────────────────────────────────────────────
export const aiApi = {
  generateReply:   (application_id: string, message_id: string) =>
    api.post('/ai/generate-reply', { application_id, message_id }),
  recruiterQuery:  (query: string) => api.post('/ai/recruiter-query', { query }),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  triage:          () => api.get('/dashboard/triage'),
  stats:           () => api.get('/dashboard/stats'),
  followUps:       () => api.get('/dashboard/follow-ups'),
  waitingResponse: () => api.get('/dashboard/waiting-response'),
  salaryQueries:   () => api.get('/dashboard/salary-queries'),
  notContacted:    (days = 3) => api.get(`/dashboard/not-contacted?days=${days}`),
  updateTask:      (taskId: string, status: string) =>
    api.patch(`/dashboard/follow-ups/${taskId}`, { task_status: status }),
};

// ── Drafts ────────────────────────────────────────────────────
export const draftsApi = {
  list:    () => api.get('/drafts'),
  get:     (id: string) => api.get(`/drafts/${id}`),
  update:  (id: string, data: object) => api.patch(`/drafts/${id}`, data),
  discard: (id: string) => api.delete(`/drafts/${id}`),
};

// ── Profile / Applications ─────────────────────────────────────────────────
export const profileApi = {
  getJobApplicants: (jobId: string) => api.get(`/profile/recruiter/jobs/${jobId}/applicants`),
  getApplicationDetail: (applicationId: string) => api.get(`/profile/recruiter/applications/${applicationId}`),
  getResume: (applicationId: string) => `${api.defaults.baseURL}/profile/recruiter/applications/${applicationId}/resume`,
  updateApplicationStatus: (applicationId: string, data: object) => api.patch(`/profile/recruiter/applications/${applicationId}/status`, data),
  getAllApplicants: () => api.get('/profile/recruiter/all-applicants'),
};
