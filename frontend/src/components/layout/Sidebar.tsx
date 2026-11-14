import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, MessageSquare,
  FileText, CheckSquare, Bot, Settings,
} from 'lucide-react';

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/candidates',    icon: Users,            label: 'Candidates'    },
  { to: '/jobs',          icon: Briefcase,        label: 'Job Roles'     },
  { to: '/conversations', icon: MessageSquare,    label: 'Conversations' },
  { to: '/drafts',        icon: FileText,         label: 'Drafts'        },
  { to: '/tasks',         icon: CheckSquare,      label: 'Follow-ups'    },
  { to: '/ai-assistant',  icon: Bot,              label: 'AI Assistant'  },
];

export default function Sidebar() {
  return (
    <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1.25rem 1.25rem', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ width: 32, height: 32, background: '#2563eb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>T</span>
        </div>
        <span style={{ fontWeight: 700, color: '#111827', fontSize: 17 }}>Trustume</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.75rem 0.625rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0.6rem 0.75rem', borderRadius: 8, fontSize: 13.5, fontWeight: 500,
            textDecoration: 'none', transition: 'all 0.15s',
            background: isActive ? '#eff6ff' : 'transparent',
            color: isActive ? '#1d4ed8' : '#6b7280',
          })}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '0.75rem 0.625rem', borderTop: '1px solid #f3f4f6' }}>
        <NavLink to="/settings" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.75rem', borderRadius: 8, fontSize: 13.5, fontWeight: 500, textDecoration: 'none', color: '#9ca3af' }}>
          <Settings size={17} />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
