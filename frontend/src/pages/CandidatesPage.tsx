import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { candidatesApi, jobRolesApi, applicationsApi } from '../api';
import { PageLoader, EmptyState, Avatar, Badge, Modal } from '../components/ui';
import { Users, Plus, Search, ChevronRight, Mail, Phone, MapPin, Link } from 'lucide-react';
import { timeAgo, getInterestColor, getInterestLabel } from '../utils';
import type { Candidate, Application, JobRole } from '../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function CandidatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showApply, setShowApply] = useState<string | null>(null); // candidate_id
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', location: '', linkedin_url: '' });
  const [applyForm, setApplyForm] = useState({ job_role_id: '' });

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ['candidates'],
    queryFn: () => candidatesApi.list().then(r => r.data),
  });

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.list().then(r => r.data),
  });

  const { data: jobRoles = [] } = useQuery<JobRole[]>({
    queryKey: ['job-roles'],
    queryFn: () => jobRolesApi.list().then(r => r.data),
  });

  const addCandidate = useMutation({
    mutationFn: (data: object) => candidatesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      setShowAdd(false);
      setForm({ full_name: '', email: '', phone: '', location: '', linkedin_url: '' });
      toast.success('Candidate added');
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || 'Failed to add candidate');
    },
  });

  const createApplication = useMutation({
    mutationFn: (data: object) => applicationsApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      setShowApply(null);
      toast.success('Application created!');
      navigate(`/conversations/${res.data.application.application_id}`);
    },
    onError: () => toast.error('Failed to create application'),
  });

  const filtered = candidates.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  // Get interest status for a candidate from their latest application
  const getCandidateStatus = (candidateId: string) => {
    const apps = applications.filter(a => a.candidate_id === candidateId);
    if (!apps.length) return null;
    return apps[apps.length - 1];
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search candidates..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary ml-auto">
          <Plus size={16} /> Add Candidate
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="No candidates yet"
          description="Add your first candidate to get started"
          action={<button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} />Add Candidate</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(candidate => {
            const latestApp = getCandidateStatus(candidate.candidate_id);
            return (
              <div key={candidate.candidate_id} className="card p-5 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(`/candidates/${candidate.candidate_id}`)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={candidate.full_name} size="md" />
                    <div>
                      <p className="font-semibold text-gray-900">{candidate.full_name}</p>
                      <p className="text-xs text-gray-500">Added {timeAgo(candidate.created_at)}</p>
                    </div>
                  </div>
                  {latestApp && (
                    <Badge className={getInterestColor(latestApp.interest_status)}>
                      {getInterestLabel(latestApp.interest_status)}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5 text-sm text-gray-600">
                  {candidate.email && (
                    <div className="flex items-center gap-2"><Mail size={13} className="text-gray-400" />{candidate.email}</div>
                  )}
                  {candidate.phone && (
                    <div className="flex items-center gap-2"><Phone size={13} className="text-gray-400" />{candidate.phone}</div>
                  )}
                  {candidate.location && (
                    <div className="flex items-center gap-2"><MapPin size={13} className="text-gray-400" />{candidate.location}</div>
                  )}
                </div>

                {latestApp && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{latestApp.role_title}</span>
                    <button onClick={e => { e.stopPropagation(); setShowApply(candidate.candidate_id); }}
                      className="btn-secondary text-xs py-1 px-2.5">
                      + New Role
                    </button>
                  </div>
                )}

                {!latestApp && (
                  <button onClick={e => { e.stopPropagation(); setShowApply(candidate.candidate_id); }}
                    className="mt-4 w-full btn-primary text-xs justify-center py-1.5">
                    <Plus size={13} /> Assign to Role
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Candidate Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Candidate">
        <form onSubmit={e => { e.preventDefault(); addCandidate.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" required value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Email *</label>
              <input className="input" type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">LinkedIn URL</label>
              <input className="input" type="url" placeholder="https://linkedin.com/in/..." value={form.linkedin_url}
                onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addCandidate.isPending}>
              {addCandidate.isPending ? 'Adding...' : 'Add Candidate'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign to Role Modal */}
      <Modal open={!!showApply} onClose={() => setShowApply(null)} title="Assign to Job Role">
        <form onSubmit={e => {
          e.preventDefault();
          if (!showApply) return;
          createApplication.mutate({ candidate_id: showApply, job_role_id: applyForm.job_role_id });
        }} className="space-y-4">
          <div>
            <label className="label">Select Job Role *</label>
            <select className="input" required value={applyForm.job_role_id}
              onChange={e => setApplyForm(f => ({ ...f, job_role_id: e.target.value }))}>
              <option value="">Choose a role...</option>
              {jobRoles.map(r => (
                <option key={r.job_role_id} value={r.job_role_id}>{r.role_title} — {r.department}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowApply(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createApplication.isPending}>
              {createApplication.isPending ? 'Creating...' : 'Create Application'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
