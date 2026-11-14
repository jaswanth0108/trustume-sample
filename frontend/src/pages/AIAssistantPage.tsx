import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiApi, dashboardApi } from '../api';
import { Spinner, Badge } from '../components/ui';
import { Bot, Send, User, Sparkles, TrendingUp, Users, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../utils';
import toast from 'react-hot-toast';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  candidateCount?: number;
}

const QUICK_QUERIES = [
  { icon: Users,        label: 'Show interested candidates who can join within 30 days', color: 'text-emerald-500' },
  { icon: Clock,        label: 'Who should I follow up with today?',                      color: 'text-amber-500' },
  { icon: DollarSign,   label: 'Which candidates asked about salary?',                    color: 'text-blue-500' },
  { icon: AlertCircle,  label: 'Who is waiting for a response from me?',                  color: 'text-orange-500' },
  { icon: TrendingUp,   label: 'Show candidates interested but not contacted in 3 days',  color: 'text-purple-500' },
  { icon: Bot,          label: 'Who said they are available for an interview this week?',  color: 'text-brand-500' },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! I'm your AI Recruitment Assistant 👋\n\nI have full visibility into your candidate pipeline. Ask me anything like:\n• \"Who should I follow up with today?\"\n• \"Show all interested candidates who can join within 30 days\"\n• \"Which candidates asked about salary?\"\n\nHow can I help?",
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (query: string) => aiApi.recruiterQuery(query),
    onSuccess: (res, query) => {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: res.data.answer,
          candidateCount: res.data.candidate_count,
        },
      ]);
    },
    onError: () => toast.error('Failed to get AI response'),
  });

  const send = (q?: string) => {
    const query = q ?? input.trim();
    if (!query) return;
    setMessages(prev => [...prev, { id: Date.now().toString() + 'u', role: 'user', content: query }]);
    setInput('');
    ask.mutate(query);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, ask.isPending]);

  return (
    <div className="flex gap-5 h-[calc(100vh-7rem)] animate-fade-in">
      {/* Chat */}
      <div className="flex-1 flex flex-col card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-50 to-purple-50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Trustume AI Assistant</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Sparkles size={10} className="text-brand-500" />
              Powered by Gemini • Real-time pipeline data
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {messages.map(msg => (
            <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={15} className="text-white" />
                </div>
              )}
              <div className={cn('max-w-[78%]', msg.role === 'user' ? 'items-end flex flex-col' : '')}>
                <div className={cn('rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                )}>
                  {msg.content}
                </div>
                {msg.candidateCount !== undefined && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                    <Users size={11} />
                    {msg.candidateCount} candidate{msg.candidateCount !== 1 ? 's' : ''} in context
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={15} className="text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {ask.isPending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot size={15} className="text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Spinner className="w-3.5 h-3.5 text-brand-500" />
                  Analysing your pipeline...
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="flex gap-3">
            <input
              className="input flex-1 text-sm"
              placeholder="Ask anything about your candidate pipeline..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={ask.isPending}
            />
            <button onClick={() => send()} disabled={!input.trim() || ask.isPending}
              className="btn-primary px-4">
              {ask.isPending ? <Spinner className="w-4 h-4" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Quick queries panel */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Quick Queries</h3>
          <div className="space-y-2">
            {QUICK_QUERIES.map(q => (
              <button key={q.label} onClick={() => send(q.label)}
                disabled={ask.isPending}
                className="w-full text-left flex items-start gap-2.5 p-3 rounded-xl hover:bg-gray-50 transition-colors text-sm text-gray-700 group">
                <q.icon size={15} className={cn(q.color, 'mt-0.5 flex-shrink-0')} />
                <span className="group-hover:text-gray-900 transition-colors leading-snug">{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">How it works</h3>
          <div className="space-y-2.5 text-xs text-gray-500">
            {[
              ['🧠', 'Understands natural language queries'],
              ['📊', 'Reads your live candidate pipeline'],
              ['🎯', 'Filters and ranks by your criteria'],
              ['💬', 'Returns structured, actionable answers'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-start gap-2">
                <span>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
