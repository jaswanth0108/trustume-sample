import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fresherApi } from '../../api/fresherApi';
import { useFresherAuth } from '../../context/FresherAuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Message {
  message_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: string;
  sender_email: string;
  message_body: string;
  sent_at: string;
}

interface ApplicationInfo {
  application_id: string;
  role_title: string;
  recruiter_name: string;
  application_status: string;
  interest_status: string;
  thread_id: string | null;
}

const statusColors: Record<string, string> = {
  screening: 'bg-blue-100 text-blue-700',
  interview: 'bg-purple-100 text-purple-700',
  offer:     'bg-green-100 text-green-700',
  hired:     'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-700',
  closed:    'bg-gray-100 text-gray-600',
  new:       'bg-yellow-100 text-yellow-700',
};

export default function FresherConversationPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { candidate } = useFresherAuth();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [replyText, setReplyText] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fresher-messages', applicationId],
    queryFn: () => fresherApi.getMessages(applicationId!).then(r => r.data as { application: ApplicationInfo; messages: Message[] }),
    refetchInterval: 15000, // auto-refresh every 15s
  });

  const sendReply = useMutation({
    mutationFn: () => fresherApi.sendReply(applicationId!, replyText),
    onSuccess: () => {
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['fresher-messages', applicationId] });
      qc.invalidateQueries({ queryKey: ['fresher-applications'] });
      toast.success('Reply sent!');
    },
    onError: () => toast.error('Failed to send reply'),
  });

  // Auto-scroll to bottom when messages load/update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <p className="text-red-600 font-semibold">Failed to load conversation.</p>
        <Link to="/fresher/dashboard" className="text-indigo-600 text-sm mt-2 inline-block">← Back to Dashboard</Link>
      </div>
    );
  }

  const { application: app, messages } = data;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link to="/fresher/dashboard" className="text-gray-400 hover:text-indigo-600 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </Link>
            <h1 className="text-lg font-bold text-gray-900">{app.role_title}</h1>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusColors[app.application_status] || 'bg-gray-100 text-gray-600'}`}>
              {app.application_status}
            </span>
          </div>
          <p className="text-sm text-gray-500 ml-8">
            Conversation with <span className="font-semibold text-gray-700">{app.recruiter_name}</span>
          </p>
        </div>
        <div className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-medium">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 pb-4">
        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-500">No messages yet. The recruiter will reach out soon.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isFromMe = msg.direction === 'inbound'; // candidate's messages are inbound
            return (
              <div key={msg.message_id} className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isFromMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div
                    className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                      isFromMe
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.message_body}
                  </div>
                  <span className="text-xs text-gray-400 px-1">
                    {isFromMe ? `You · ` : `${app.recruiter_name} · `}
                    {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply Box */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mt-2">
        <textarea
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="Type your reply to the recruiter…"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && replyText.trim()) {
              e.preventDefault();
              sendReply.mutate();
            }
          }}
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">Ctrl+Enter to send</p>
          <button
            onClick={() => sendReply.mutate()}
            disabled={!replyText.trim() || sendReply.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition"
          >
            {sendReply.isPending ? 'Sending…' : 'Send Reply'}
          </button>
        </div>
      </div>
    </div>
  );
}
