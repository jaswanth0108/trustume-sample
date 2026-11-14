import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../api';
import { PageLoader, EmptyState, Badge } from '../components/ui';
import { CheckSquare, Check, X, Clock, AlertTriangle } from 'lucide-react';
import { timeAgo, getPriorityColor, cn } from '../utils';
import type { FollowUpTask } from '../types';
import toast from 'react-hot-toast';

const TASK_ICONS: Record<string, string> = {
  schedule_interview: '📅',
  send_follow_up: '💬',
  share_salary: '💰',
  share_jd: '📄',
  close_application: '❌',
  manual: '📝',
};

export default function TasksPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'completed'>('pending');

  const { data, isLoading } = useQuery({
    queryKey: ['follow-ups-all'],
    queryFn: () => dashboardApi.followUps().then(r => r.data),
    refetchInterval: 30000,
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      dashboardApi.updateTask(taskId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow-ups-all'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Task updated');
    },
  });

  if (isLoading) return <PageLoader />;

  const tasks: FollowUpTask[] = data?.tasks || [];
  const filtered = tasks.filter(t =>
    filter === 'pending' ? t.task_status === 'pending' || t.task_status === 'in_progress' : t.task_status === 'completed'
  );

  const overdue = filtered.filter(t => new Date(t.due_at) < new Date() && t.task_status === 'pending');

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-2">
        {(['pending', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('btn text-sm', filter === f ? 'btn-primary' : 'btn-secondary')}>
            {f === 'pending' ? 'Active' : 'Completed'}
          </button>
        ))}
        {overdue.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-red-600 text-sm">
            <AlertTriangle size={15} /> {overdue.length} overdue
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<CheckSquare size={48} />}
          title={filter === 'pending' ? 'No pending tasks' : 'No completed tasks'}
          description={filter === 'pending' ? 'All caught up! 🎉' : 'Complete tasks to see them here'} />
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const isOverdue = new Date(task.due_at) < new Date() && task.task_status === 'pending';
            return (
              <div key={task.task_id}
                className={cn('card p-4 flex items-start gap-4',
                  isOverdue ? 'border-red-200 bg-red-50' : '')}>
                <div className="text-2xl">{TASK_ICONS[task.task_type] || '📋'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900">{task.candidate_name}</p>
                    <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{task.task_description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className={cn('flex items-center gap-1', isOverdue ? 'text-red-600 font-medium' : '')}>
                      <Clock size={11} />
                      {isOverdue ? 'Overdue • ' : 'Due '}{timeAgo(task.due_at)}
                    </span>
                    <span className="capitalize">{task.task_type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                {task.task_status === 'pending' && (
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => updateTask.mutate({ taskId: task.task_id, status: 'completed' })}
                      title="Mark done" className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center transition-colors">
                      <Check size={14} />
                    </button>
                    <button onClick={() => updateTask.mutate({ taskId: task.task_id, status: 'cancelled' })}
                      title="Cancel" className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
