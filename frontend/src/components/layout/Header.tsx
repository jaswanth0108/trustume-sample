import React from 'react';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':     'Recruiter Dashboard',
  '/candidates':    'Candidates',
  '/jobs':          'Job Roles',
  '/conversations': 'Conversations',
  '/drafts':        'Reply Drafts',
  '/tasks':         'Follow-up Tasks',
  '/ai-assistant':  'AI Assistant',
  '/settings':      'Settings',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function Header() {
  const { recruiter, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    location.pathname.startsWith(key)
  )?.[1] ?? 'Trustume';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header style={{ height: 56, background: '#fff', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', flexShrink: 0 }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', borderRadius: 8 }}>
          <Bell size={17} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
            {getInitials(recruiter?.full_name || 'R')}
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: '#374151' }}>{recruiter?.full_name}</span>
        </div>
        <button onClick={handleLogout} title="Logout" style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', borderRadius: 8 }}>
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
