import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fresherApi } from '../../api/fresherApi';
import { useFresherAuth } from '../../context/FresherAuthContext';
import { formatDistanceToNow } from 'date-fns';

interface Application {
  application_id: string;
  application_status: string;
  interest_status: string;
  role_title: string;
  department: string;
  job_location: string;
  salary_min: number;
  salary_max: number;
  currency_code: string;
  employment_type: string;
  recruiter_name: string;
  recruiter_email: string;
  notice_period_days: number | null;
  expected_salary: number | null;
  latest_message: string | null;
  latest_direction: string | null;
  latest_sent_at: string | null;
  thread_id: string | null;
}

const statusColors: Record<string, string> = {
  screening:   'bg-blue-100 text-blue-700',
  interview:   'bg-purple-100 text-purple-700',
  offer:       'bg-green-100 text-green-700',
  hired:       'bg-emerald-100 text-emerald-700',
  rejected:    'bg-red-100 text-red-700',
  closed:      'bg-gray-100 text-gray-600',
  new:         'bg-yellow-100 text-yellow-700',
};

const interestColors: Record<string, string> = {
  interested:     'bg-green-100 text-green-700',
  not_interested: 'bg-red-100 text-red-700',
  unknown:        'bg-gray-100 text-gray-600',
  maybe:          'bg-yellow-100 text-yellow-700',
  no_response:    'bg-orange-100 text-orange-700',
};

export default function FresherDashboardPage() {
  const { candidate } = useFresherAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fresher-applications'],
    queryFn: () => fresherApi.getApplications().then(r => r.data.applications as Application[]),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
            <div className="h-5 w-64 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-40 bg-gray-100 rounded mb-2" />
            <div className="h-4 w-full bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <p className="text-red-600 font-semibold">Failed to load applications. Please refresh.</p>
      </div>
    );
  }

  const apps = data || [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {candidate?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Here are your job applications and recruiter conversations.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Applied', value: apps.length, color: 'bg-indigo-50 text-indigo-700' },
          { label: 'In Progress',   value: apps.filter(a => !['closed','rejected'].includes(a.application_status)).length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Interviews',    value: apps.filter(a => a.application_status === 'interview').length, color: 'bg-purple-50 text-purple-700' },
          { label: 'Offers',        value: apps.filter(a => ['offer','hired'].includes(a.application_status)).length, color: 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 ${s.color} border border-white/50`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium opacity-80 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Application Cards */}
      {apps.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-700">No Applications Yet</h3>
          <p className="text-gray-400 text-sm mt-2 mb-6">Browse available jobs and start applying!</p>
          <Link
            to="/fresher/explore"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition"
          >
            🔍 Explore Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {apps.map(app => (
            <div
              key={app.application_id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all"
            >
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Left: Job Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h2 className="text-lg font-bold text-gray-900">{app.role_title}</h2>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusColors[app.application_status] || 'bg-gray-100 text-gray-600'}`}>
                        {app.application_status.charAt(0).toUpperCase() + app.application_status.slice(1)}
                      </span>
                      {app.interest_status !== 'unknown' && (
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${interestColors[app.interest_status] || ''}`}>
                          {app.interest_status.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap mb-3">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        </svg>
                        {app.job_location}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                        </svg>
                        ₹{(app.salary_min / 100000).toFixed(1)}L – ₹{(app.salary_max / 100000).toFixed(1)}L
                      </span>
                      <span>Recruiter: <span className="font-medium text-gray-700">{app.recruiter_name}</span></span>
                    </div>

                    {/* Latest message preview */}
                    {app.latest_message && (
                      <div className={`text-sm rounded-xl px-4 py-2.5 ${app.latest_direction === 'inbound' ? 'bg-indigo-50 border-l-4 border-indigo-400' : 'bg-gray-50 border-l-4 border-gray-300'}`}>
                        <span className="text-xs font-semibold text-gray-500 mr-2">
                          {app.latest_direction === 'inbound' ? '📤 You:' : '📥 Recruiter:'}
                        </span>
                        <span className="text-gray-700">
                          {app.latest_message.length > 100 ? app.latest_message.slice(0, 100) + '…' : app.latest_message}
                        </span>
                        {app.latest_sent_at && (
                          <span className="text-xs text-gray-400 ml-2">
                            · {formatDistanceToNow(new Date(app.latest_sent_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: CTA */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Link
                      to={`/fresher/conversation/${app.application_id}`}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition whitespace-nowrap"
                    >
                      View Conversation →
                    </Link>
                    {app.notice_period_days !== null && (
                      <p className="text-xs text-gray-400">Notice: {app.notice_period_days} days</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
