import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { applicationsApi } from '../api';
import { PageLoader, EmptyState, Avatar, Badge } from '../components/ui';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { timeAgo, getInterestColor, getInterestLabel, cn } from '../utils';
import type { Application } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ConversationsListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const filter = params.get('filter');

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.list().then(r => r.data),
    refetchInterval: 20000,
  });

  if (isLoading) return <PageLoader />;

  let filtered = applications;
  if (filter === 'waiting') filtered = applications.filter(a => a.interest_status === 'interested' || a.interest_status === 'unknown');
  if (filter === 'salary') filtered = applications; // would need candidate_questions in the list
  if (filter === 'available') filtered = applications.filter(a => a.interest_status === 'interested');

  return (
    <div className="space-y-4 animate-fade-in">
      {filtered.length === 0 ? (
        <EmptyState icon={<MessageSquare size={48} />}
          title="No conversations yet"
          description="Create an application to start a conversation with a candidate" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Candidate</th>
                <th className="text-left px-3 py-3">Role</th>
                <th className="text-left px-3 py-3">Interest</th>
                <th className="text-left px-3 py-3">Status</th>
                <th className="text-left px-3 py-3">Updated</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(app => (
                <tr key={app.application_id}
                  onClick={() => navigate(`/conversations/${app.application_id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={app.candidate_name || 'U'} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">{app.candidate_name}</p>
                        <p className="text-xs text-gray-400">{app.candidate_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-gray-700">{app.role_title}</td>
                  <td className="px-3 py-3.5">
                    <Badge className={getInterestColor(app.interest_status)}>
                      {getInterestLabel(app.interest_status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="text-xs capitalize text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {app.application_status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-gray-400">{timeAgo(app.updated_at)}</td>
                  <td className="px-3 py-3.5 text-gray-300"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
