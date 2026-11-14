import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CandidatesPage from './pages/CandidatesPage';
import JobRolesPage from './pages/JobRolesPage';
import ConversationsListPage from './pages/ConversationsListPage';
import ConversationPage from './pages/ConversationPage';
import DraftsPage from './pages/DraftsPage';
import TasksPage from './pages/TasksPage';
import AIAssistantPage from './pages/AIAssistantPage';
import SettingsPage from './pages/SettingsPage';

// Fresher Portal
import { FresherAuthProvider } from './context/FresherAuthContext';
import FresherLayout from './components/fresher/FresherLayout';
import FresherLoginPage from './pages/fresher/FresherLoginPage';
import FresherDashboardPage from './pages/fresher/FresherDashboardPage';
import FresherConversationPage from './pages/fresher/FresherConversationPage';

export default function App() {
  return (
    <Routes>
      {/* ── Recruiter / CEO Portal ───────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"            element={<DashboardPage />} />
        <Route path="/candidates"           element={<CandidatesPage />} />
        <Route path="/jobs"                 element={<JobRolesPage />} />
        <Route path="/conversations"        element={<ConversationsListPage />} />
        <Route path="/conversations/:applicationId" element={<ConversationPage />} />
        <Route path="/drafts"              element={<DraftsPage />} />
        <Route path="/tasks"               element={<TasksPage />} />
        <Route path="/ai-assistant"        element={<AIAssistantPage />} />
        <Route path="/settings"            element={<SettingsPage />} />
      </Route>

      {/* ── Fresher / Candidate Portal ───────────────── */}
      <Route path="/fresher/login" element={
        <FresherAuthProvider>
          <FresherLoginPage />
        </FresherAuthProvider>
      } />
      <Route path="/fresher" element={
        <FresherAuthProvider>
          <FresherLayout />
        </FresherAuthProvider>
      }>
        <Route index element={<Navigate to="/fresher/dashboard" replace />} />
        <Route path="dashboard"                    element={<FresherDashboardPage />} />
        <Route path="conversation/:applicationId"  element={<FresherConversationPage />} />
      </Route>

      {/* ── Catch-all ────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
