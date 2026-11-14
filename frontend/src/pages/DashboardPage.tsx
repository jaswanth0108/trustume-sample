import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../api';
import { PageLoader, StatCard, Badge, Avatar, EmptyState, Spinner } from '../components/ui';
import { Users, Clock, DollarSign, AlertCircle, Calendar, ChevronRight, RefreshCw, CheckCircle } from 'lucide-react';
import { timeAgo, getInterestColor, getInterestLabel, getActionBadge, getPriorityColor } from '../utils';
import type { TriageCandidate, FollowUpTask } from '../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const ACTION_MAP: Record<string, string> = {
  schedule_interview: '📅 Schedule Interview',
  follow_up: '💬 Follow Up',
  share_salary: '💰 Share Salary',
  close_application: '❌ Close',
  send_field_question: '❓ Ask Info',
};

type TabKey = 'all' | 'interested' | 'unknown' | 'no_response';

export default function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const { data: stats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: triageData, isLoading: triageLoading } = useQuery({
    queryKey: ['dashboard-triage'],
    queryFn: () => dashboardApi.triage().then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: followUpsData } = useQuery({
    queryKey: ['dashboard-followups'],
    queryFn: () => dashboardApi.followUps().then(r => r.data),
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) => dashboardApi.updateTask(taskId, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard-followups'] }); toast.success('Task done!'); },
  });

  if (statsLoading || triageLoading) return <PageLoader />;

  const triage = triageData || { all: [], total: 0, groups: {} };
  const followUps: FollowUpTask[] = followUpsData?.tasks || [];

  const groups = triage.groups as Record<string, TriageCandidate[]>;
  const displayCandidates: TriageCandidate[] = activeTab === 'all' ? triage.all : (groups[activeTab] || []);

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'all',         label: 'All Active',   count: triage.total || 0 },
    { key: 'interested',  label: 'Interested',   count: groups?.interested?.length ?? 0 },
    { key: 'unknown',     label: 'Pending',      count: groups?.unknown?.length ?? 0 },
    { key: 'no_response', label: 'No Response',  count: groups?.no_response?.length ?? 0 },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <StatCard label="Total Active" value={stats.total ?? 0} color="brand" />
        <StatCard label="Interested" value={stats.interested ?? 0} color="green" />
        <StatCard label="In Interview" value={stats.in_interview ?? 0} color="purple" />
        <StatCard label="Offer Stage" value={stats.offer_stage ?? 0} color="yellow" />
        <StatCard label="Not Interested" value={stats.not_interested ?? 0} color="red" />
        <StatCard label="Follow-ups Today" value={stats.follow_ups_due_today ?? 0} color="gray" sub="Due in 24h" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
        {/* Triage table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ fontWeight: 600, fontSize: 15, color: '#111827', margin: 0 }}>Candidate Triage</h2>
            <button onClick={() => qc.invalidateQueries({ queryKey: ['dashboard-triage'] })}
              className="btn btn-ghost" style={{ fontSize: 12, padding: '0.35rem 0.75rem', gap: 5 }}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', padding: '0 1.25rem' }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: '0.75rem 0', marginRight: '1.25rem', fontSize: 13, fontWeight: 500,
                border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === tab.key ? '#1d4ed8' : '#6b7280',
              }}>
                {tab.label}
                <span style={{ marginLeft: 5, padding: '0 5px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: activeTab === tab.key ? '#dbeafe' : '#f3f4f6', color: activeTab === tab.key ? '#1e40af' : '#6b7280' }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            {displayCandidates.length === 0 ? (
              <EmptyState icon={<Users size={40} />} title="No candidates in this group" />
            ) : (
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Candidate', 'Status', 'AI Details', 'Last Message', 'Action'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayCandidates.map((c, i) => (
                    <tr key={c.application_id} onClick={() => navigate(`/conversations/${c.application_id}`)}
                      style={{ borderTop: '1px solid #f9fafb', cursor: 'pointer', background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={c.candidate_name || 'U'} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{c.candidate_name}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.role_title}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.75rem' }}>
                        <Badge className={getInterestColor(c.interest_status)}>{getInterestLabel(c.interest_status)}</Badge>
                      </td>
                      <td style={{ padding: '0.75rem 0.75rem', fontSize: 12, color: '#6b7280' }}>
                        {c.notice_period_days != null && <div>Notice: {c.notice_period_days}d</div>}
                        {Number(c.pending_questions_count) > 0 && <div style={{ color: '#d97706' }}>{c.pending_questions_count} question(s)</div>}
                        {Number(c.missing_fields_count) > 0 && <div style={{ color: '#dc2626' }}>{c.missing_fields_count} field(s) missing</div>}
                      </td>
                      <td style={{ padding: '0.75rem 0.75rem', fontSize: 12, color: '#9ca3af', maxWidth: 160 }}>
                        {c.last_message ? (
                          <>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_message}</div>
                            <div style={{ fontSize: 11, marginTop: 2 }}>{timeAgo(c.last_message_at)}</div>
                          </>
                        ) : <span style={{ color: '#d1d5db' }}>No messages</span>}
                      </td>
                      <td style={{ padding: '0.75rem 0.75rem' }}>
                        {c.pending_task_type && (
                          <span style={{ fontSize: 11 }}>{ACTION_MAP[c.pending_task_type] || c.pending_task_type}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Follow-ups */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.875rem 1.125rem', borderBottom: '1px solid #f3f4f6' }}>
              <Clock size={15} style={{ color: '#d97706' }} />
              <span style={{ fontWeight: 600, fontSize: 13.5, color: '#111827' }}>Follow-ups Due</span>
              <span className="badge badge-yellow" style={{ marginLeft: 'auto' }}>{followUps.length}</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {followUps.length === 0 ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>All caught up! 🎉</div>
              ) : followUps.map(task => (
                <div key={task.task_id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '0.75rem 1.125rem', borderTop: '1px solid #f9fafb' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.candidate_name}</div>
                    <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.task_description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(task.due_at)}</span>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); updateTask.mutate({ taskId: task.task_id, status: 'completed' }); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', marginTop: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#10b981')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                    <CheckCircle size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="card" style={{ padding: '1.125rem' }}>
            <h3 style={{ fontWeight: 600, fontSize: 13.5, color: '#111827', margin: '0 0 0.75rem 0' }}>Quick Actions</h3>
            {[
              { label: 'Waiting for Response', icon: AlertCircle, color: '#f97316', path: '/conversations?filter=waiting' },
              { label: 'Asked About Salary',    icon: DollarSign,   color: '#3b82f6', path: '/conversations?filter=salary'  },
              { label: 'Available This Week',   icon: Calendar,     color: '#10b981', path: '/conversations?filter=available' },
              { label: 'All Candidates',         icon: Users,        color: '#6366f1', path: '/candidates' },
            ].map(item => (
              <button key={item.label} onClick={() => navigate(item.path)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.625rem', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <item.icon size={15} style={{ color: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{item.label}</span>
                <ChevronRight size={13} style={{ color: '#d1d5db' }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
