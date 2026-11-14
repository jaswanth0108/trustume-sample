import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationsApi, messagesApi, aiApi } from '../api';
import { PageLoader, Badge, Avatar, Spinner } from '../components/ui';
import {
  Send, Sparkles, Edit3, Check, X, ChevronLeft,
  User, Bot, Clock, AlertCircle, Info, Zap, RefreshCw, MessageSquare,
} from 'lucide-react';
import {
  timeAgo, formatDate, getInterestColor, getInterestLabel,
  getActionBadge, getActionLabel, cn,
} from '../utils';
import type { Message, MessageAnalysis } from '../types';
import toast from 'react-hot-toast';

export default function ConversationPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [outboundMsg, setOutboundMsg] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<MessageAnalysis | null>(null);
  const [simulateMsg, setSimulateMsg] = useState('');
  const [showSimulate, setShowSimulate] = useState(false);

  /* ─── 1. Load full application detail (now includes thread_id via JOIN) ─── */
  const { data: appData, isLoading: appLoading } = useQuery({
    queryKey: ['application', applicationId],
    queryFn: () => applicationsApi.get(applicationId!).then(r => r.data),
    enabled: !!applicationId,
  });

  const app = appData?.application;
  const collectedFields: Array<{
    field_key: string; field_label: string; collection_status: string;
    normalized_text?: string; normalized_number?: number; normalized_date?: string;
  }> = appData?.collected_fields ?? [];
  const candidateQuestions: Array<{
    question_id: string; question_text: string; question_category: string; response_status: string;
  }> = appData?.candidate_questions ?? [];

  /* ─── 2. Determine thread_id ─── */
  // The updated GET /api/applications/:id now joins conversation_threads → thread_id present directly
  const threadId: string | null = app?.thread_id ?? null;

  /* ─── 3. Load messages (refetch every 10 s) ─── */
  const { data: chatMessages = [], refetch: refetchChat } = useQuery<Message[]>({
    queryKey: ['chat', threadId],
    queryFn: () => messagesApi.getThread(threadId!).then(r => r.data),
    enabled: !!threadId,
    refetchInterval: 10_000,
  });

  /* ─── 4. Load AI analysis for selected message ─── */
  const { data: analysisData, isFetching: analysisFetching } = useQuery<MessageAnalysis>({
    queryKey: ['analysis', selectedAnalysis?.analysis_id ?? null],
    queryFn: () =>
      selectedAnalysis
        ? messagesApi.getAnalysis(selectedAnalysis.message_id).then(r => r.data)
        : Promise.resolve(null as unknown as MessageAnalysis),
    enabled: !!selectedAnalysis,
  });

  /* ─── 5. Auto-scroll ─── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /* ─── 6. Send inbound (simulate candidate message) ─── */
  const sendInbound = useMutation({
    mutationFn: (body: string) =>
      messagesApi.sendInbound({
        application_id: applicationId,
        message_body: body,
        thread_id: threadId || undefined,
      }),
    onSuccess: (res) => {
      setSimulateMsg('');
      setShowSimulate(false);
      qc.invalidateQueries({ queryKey: ['application', applicationId] });
      qc.invalidateQueries({ queryKey: ['chat', threadId ?? res.data.message?.thread_id] });
      qc.invalidateQueries({ queryKey: ['dashboard-triage'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Message received & AI analysis complete');
    },
    onError: () => toast.error('Failed to process message'),
  });

  /* ─── 7. Generate AI reply ─── */
  const generateReply = useMutation({
    mutationFn: (messageId: string) =>
      aiApi.generateReply(applicationId!, messageId),
    onSuccess: (res) => {
      const draftContent = res.data.draft?.draft_content || res.data.draft_content || res.data.reply || '';
      const draftId = res.data.draft?.draft_id || res.data.draft_id || null;
      setOutboundMsg(draftContent);
      if (draftId) setDraftId(draftId);
      setEditingDraft(draftContent);
      toast.success('AI reply generated — review & edit before sending');
    },
    onError: () => toast.error('Failed to generate reply'),
  });

  /* ─── 8. Send outbound ─── */
  const sendOutbound = useMutation({
    mutationFn: () =>
      messagesApi.sendOutbound({
        thread_id: threadId,
        message_body: outboundMsg,
        draft_id: draftId || undefined,
      }),
    onSuccess: () => {
      setOutboundMsg('');
      setDraftId(null);
      setEditingDraft('');
      refetchChat();
      qc.invalidateQueries({ queryKey: ['application', applicationId] });
      toast.success('Message sent');
    },
    onError: () => toast.error('Failed to send message'),
  });

  /* ─── Loading / not found ─── */
  if (appLoading) return <PageLoader />;
  if (!app) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#6b7280' }}>Application not found.</p>
        <button className="btn-primary mt-4" onClick={() => navigate('/applications')}>
          Back to Conversations
        </button>
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          className="btn-ghost p-2"
          onClick={() => navigate('/conversations')}
          title="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <Avatar name={app.candidate_name} size={40} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', margin: 0 }}>
            {app.candidate_name}
          </h1>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
            {app.role_title} · {app.candidate_email}
          </p>
        </div>
        <Badge className={getInterestColor(app.interest_status)}>
          {getInterestLabel(app.interest_status)}
        </Badge>
      </div>

      {/* ── Main 2-column layout ── */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Left: Chat ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Messages list */}
          <div
            className="card"
            style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}
          >
            {chatMessages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: '0.5rem' }}>
                <MessageSquare size={32} />
                <p style={{ fontSize: '0.875rem' }}>No messages yet. Use "Simulate Message" below to begin.</p>
              </div>
            )}

            {chatMessages.map((msg) => {
              const isInbound = msg.direction === 'inbound';
              return (
                <div key={msg.message_id}
                  style={{
                    display: 'flex',
                    flexDirection: isInbound ? 'row' : 'row-reverse',
                    gap: '0.5rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: isInbound ? '#e0e7ff' : '#d1fae5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isInbound
                      ? <User size={16} style={{ color: '#6366f1' }} />
                      : <Bot size={16} style={{ color: '#10b981' }} />}
                  </div>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{
                      padding: '0.625rem 0.875rem',
                      borderRadius: isInbound ? '0 0.75rem 0.75rem 0.75rem' : '0.75rem 0 0.75rem 0.75rem',
                      background: isInbound ? '#f3f4f6' : '#eff6ff',
                      fontSize: '0.875rem',
                      color: '#1f2937',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.message_body}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        {timeAgo(msg.sent_at)}
                      </span>
                      {isInbound && (
                        <button
                          className="btn-ghost"
                          style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => {
                            setSelectedAnalysis({ ...msg, message_id: msg.message_id } as unknown as MessageAnalysis);
                            generateReply.mutate(msg.message_id);
                          }}
                          disabled={generateReply.isPending}
                        >
                          <Sparkles size={11} />
                          Generate Reply
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Analysis panel (shown when analysis is selected) */}
          {selectedAnalysis && (analysisData || analysisFetching) && (
            <div className="card" style={{ padding: '0.875rem', marginBottom: '0.75rem', background: '#fffbeb', border: '1px solid #fcd34d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={13} /> AI Analysis
                </span>
                <button className="btn-ghost p-1" onClick={() => setSelectedAnalysis(null)}><X size={14} /></button>
              </div>
              {analysisFetching
                ? <Spinner className="w-4 h-4" />
                : analysisData && (
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>Intent: </span>
                      <strong style={{ color: '#1f2937', textTransform: 'capitalize' }}>
                        {analysisData.primary_intent?.replace(/_/g, ' ')}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Interest: </span>
                      <strong style={{ color: '#1f2937', textTransform: 'capitalize' }}>
                        {analysisData.detected_interest}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Confidence: </span>
                      <strong style={{ color: '#1f2937' }}>
                        {((analysisData.confidence_score ?? 0) * 100).toFixed(0)}%
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Action: </span>
                      <Badge className={getActionBadge(analysisData.suggested_action)}>
                        {getActionLabel(analysisData.suggested_action)}
                      </Badge>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Draft editor (shows after AI generates a reply) */}
          {editingDraft && (
            <div className="card" style={{ padding: '0.875rem', marginBottom: '0.75rem', background: '#f0fdf4', border: '1px solid #86efac' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#14532d', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Edit3 size={13} /> AI Draft — Review & Edit
                </span>
                <button className="btn-ghost p-1" onClick={() => { setEditingDraft(''); setDraftId(null); }}>
                  <X size={14} />
                </button>
              </div>
              <textarea
                className="input w-full"
                style={{ minHeight: 80, fontSize: '0.825rem', resize: 'vertical' }}
                value={editingDraft}
                onChange={e => { setEditingDraft(e.target.value); setOutboundMsg(e.target.value); }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  className="btn-primary text-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={() => sendOutbound.mutate()}
                  disabled={sendOutbound.isPending || !threadId}
                >
                  {sendOutbound.isPending ? <Spinner className="w-3 h-3" /> : <Send size={13} />}
                  Send Reply
                </button>
                <button className="btn-ghost text-xs" onClick={() => { setOutboundMsg(editingDraft); setEditingDraft(''); }}>
                  <Check size={13} /> Move to composer
                </button>
              </div>
            </div>
          )}

          {/* Simulate candidate message */}
          {showSimulate && (
            <div className="card" style={{ padding: '0.875rem', marginBottom: '0.75rem', background: '#eff6ff', border: '1px solid #93c5fd' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e3a8a', marginBottom: '0.5rem' }}>
                📨 Simulate incoming candidate message
              </p>
              <textarea
                className="input w-full"
                style={{ minHeight: 72, fontSize: '0.825rem', resize: 'vertical' }}
                placeholder='e.g. "Hi, I am interested. I have a 30-day notice period and I am looking for ₹15 LPA."'
                value={simulateMsg}
                onChange={e => setSimulateMsg(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  className="btn-primary text-xs"
                  onClick={() => sendInbound.mutate(simulateMsg)}
                  disabled={!simulateMsg.trim() || sendInbound.isPending}
                >
                  {sendInbound.isPending ? <Spinner className="w-3 h-3" /> : '✓'} Submit & Analyse
                </button>
                <button className="btn-ghost text-xs" onClick={() => setShowSimulate(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Compose outbound */}
          <div className="card" style={{ padding: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                className="btn-ghost text-xs"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => setShowSimulate(s => !s)}
              >
                <RefreshCw size={13} /> Simulate Message
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <textarea
                className="input flex-1"
                style={{ minHeight: 72, resize: 'vertical', fontSize: '0.875rem' }}
                placeholder="Type your reply… or click ✨ Generate Reply on a candidate message"
                value={outboundMsg}
                onChange={e => setOutboundMsg(e.target.value)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  disabled={!outboundMsg.trim() || sendOutbound.isPending || !threadId}
                  onClick={() => sendOutbound.mutate()}
                  className="btn-primary"
                  style={{ height: 40, width: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={!threadId ? 'No conversation thread yet — simulate an inbound message first' : 'Send'}
                >
                  {sendOutbound.isPending ? <Spinner className="w-4 h-4" /> : <Send size={16} />}
                </button>
              </div>
            </div>
            {!threadId && (
              <p style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.3rem' }}>
                ⚠️ No thread yet. Click "Simulate Message" to receive the first candidate message.
              </p>
            )}
          </div>
        </div>

        {/* ── Right: AI Panel ── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>

          {/* Candidate collected fields */}
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Info size={14} style={{ color: '#6366f1' }} /> Collected Info
            </h3>
            {collectedFields.length === 0
              ? <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>No fields collected yet.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {collectedFields.map(f => (
                    <div key={f.field_key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{f.field_label}</span>
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 500,
                        color: f.collection_status === 'answered' ? '#111827' : '#ef4444',
                        fontStyle: f.collection_status !== 'answered' ? 'italic' : 'normal',
                      }}>
                        {f.collection_status === 'answered'
                          ? (f.normalized_text ?? (f.normalized_number !== null && f.normalized_number !== undefined ? String(f.normalized_number) : null) ?? f.normalized_date ?? '—')
                          : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Candidate questions */}
          {candidateQuestions.length > 0 && (
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={14} style={{ color: '#f59e0b' }} />
                Questions ({candidateQuestions.filter(q => q.response_status === 'pending').length} pending)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {candidateQuestions.map(q => (
                  <div key={q.question_id} style={{
                    fontSize: '0.75rem', padding: '0.4rem 0.6rem', borderRadius: '0.4rem',
                    background: q.response_status === 'pending' ? '#fffbeb' : '#f9fafb',
                    color: q.response_status === 'pending' ? '#92400e' : '#9ca3af',
                    textDecoration: q.response_status !== 'pending' ? 'line-through' : 'none',
                  }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{q.question_category}: </span>
                    {q.question_text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Application status */}
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Zap size={14} style={{ color: '#6366f1' }} /> Status
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Pipeline</span>
                <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{app.application_status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>Interest</span>
                <Badge className={getInterestColor(app.interest_status)}>
                  {getInterestLabel(app.interest_status)}
                </Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Applied</span>
                <span style={{ color: '#374151' }}>{formatDate(app.applied_at)}</span>
              </div>
              {app.notice_period_days != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Notice</span>
                  <span style={{ fontWeight: 500 }}>{app.notice_period_days} days</span>
                </div>
              )}
              {app.expected_salary != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Expected Salary</span>
                  <span style={{ fontWeight: 500 }}>{app.salary_currency ?? '₹'}{app.expected_salary?.toLocaleString()}</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f3f4f6' }}>
              <label className="label" style={{ fontSize: '0.72rem', marginBottom: '0.3rem', display: 'block' }}>Update Status</label>
              <select
                className="input"
                style={{ fontSize: '0.78rem' }}
                value={app.application_status}
                onChange={e => {
                  applicationsApi.setStatus(applicationId!, e.target.value)
                    .then(() => { qc.invalidateQueries({ queryKey: ['application', applicationId] }); toast.success('Status updated'); })
                    .catch(() => toast.error('Failed to update status'));
                }}
              >
                {['new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'closed'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Thread info */}
          {threadId && (
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={14} style={{ color: '#6b7280' }} /> Thread Info
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', wordBreak: 'break-all' }}>
                ID: {threadId}
              </p>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                {chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
