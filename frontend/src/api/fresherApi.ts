import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() { return localStorage.getItem('trustume_fresher_token') || ''; }
function h() { return { Authorization: `Bearer ${getToken()}` }; }

export const fresherApi = {
  login:       (email: string, password: string) =>
    axios.post(`${BASE}/fresher/login`, { email, password }),

  getProfile:  () =>
    axios.get(`${BASE}/fresher/profile`, { headers: h() }),

  getApplications: () =>
    axios.get(`${BASE}/fresher/applications`, { headers: h() }),

  getMessages: (applicationId: string) =>
    axios.get(`${BASE}/fresher/applications/${applicationId}/messages`, { headers: h() }),

  sendReply:   (applicationId: string, message_body: string) =>
    axios.post(`${BASE}/fresher/applications/${applicationId}/reply`, { message_body }, { headers: h() }),
};
