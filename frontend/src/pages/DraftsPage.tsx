import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { draftsApi, messagesApi } from '../api';
import { PageLoader, EmptyState, Avatar, Badge, Spinner } from '../components/ui';
import { FileText, Edit3, Send, Trash2, Sparkles, Check } from 'lucide-react';
import { timeAgo, cn } from '../utils';
import type { ReplyDraft } from '../types';
import toast from 'react-hot-toast';

export default function DraftsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data: drafts = [], isLoading } = useQuery<ReplyDraft[]>({
    queryKey: ['drafts'],
    queryFn: () => draftsApi.list().then(r => r.data),
    refetchInterval: 15000,
  });

  const updateDraft = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      draftsApi.update(id, { draft_content: content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drafts'] });
      toast.success('Draft saved');
    },
  });

  const discardDraft = useMutation({
    mutationFn: (id: string) => draftsApi.discard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drafts'] });
      toast.success('Draft discarded');
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{drafts.length} pending draft{drafts.length !== 1 ? 's' : ''}</p>
      </div>

      {drafts.length === 0 ? (
        <EmptyState icon={<FileText size={48} />}
          title="No pending drafts"
          description="AI-generated reply drafts will appear here when you process candidate messages" />
      ) : (
        <div className="space-y-4">
          {drafts.map(draft => {
            const isEditing = draft.draft_id in editing;
            const content = isEditing ? editing[draft.draft_id] : draft.draft_content;

            return (
              <div key={draft.draft_id} className="card overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <Avatar name={draft.candidate_name || 'C'} size="sm" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">{draft.candidate_name}</p>
                    <p className="text-xs text-gray-500">{draft.role_title}</p>
                  </div>
                  <Badge className={draft.draft_type === 'ai_generated' ? 'badge-purple' : 'badge-blue'}>
                    {draft.draft_type === 'ai_generated' ? (
                      <><Sparkles size={10} /> AI Generated</>
                    ) : draft.draft_type}
                  </Badge>
                  <span className="text-xs text-gray-400">{timeAgo(draft.created_at)}</span>
                </div>

                {/* Content */}
                <div className="px-5 py-4">
                  {isEditing ? (
                    <textarea
                      className="input w-full min-h-[140px] resize-none text-sm font-mono"
                      value={content}
                      onChange={e => setEditing(prev => ({ ...prev, [draft.draft_id]: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{content}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-5 py-3.5 border-t border-gray-100 bg-gray-50">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => {
                          updateDraft.mutate({ id: draft.draft_id, content: editing[draft.draft_id] });
                          setEditing(prev => { const n = { ...prev }; delete n[draft.draft_id]; return n; });
                        }}
                        className="btn-primary text-xs gap-1.5">
                        <Check size={13} /> Save Changes
                      </button>
                      <button onClick={() => setEditing(prev => { const n = { ...prev }; delete n[draft.draft_id]; return n; })}
                        className="btn-secondary text-xs">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setEditing(prev => ({ ...prev, [draft.draft_id]: draft.draft_content }))}
                      className="btn-secondary text-xs gap-1.5">
                      <Edit3 size={13} /> Edit
                    </button>
                  )}
                  <button onClick={() => discardDraft.mutate(draft.draft_id)}
                    className="btn-ghost text-xs gap-1.5 text-red-500 hover:bg-red-50 ml-auto">
                    <Trash2 size={13} /> Discard
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
