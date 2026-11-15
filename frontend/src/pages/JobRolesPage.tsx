import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobRolesApi } from '../api';
import { PageLoader, EmptyState, Badge, Modal } from '../components/ui';
import { Briefcase, Plus, Search, MapPin, DollarSign, Clock } from 'lucide-react';
import { timeAgo, formatSalary } from '../utils';
import type { JobRole } from '../types';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  role_title: '', department: '', job_description: '', min_experience: '',
  max_experience: '', salary_min: '', salary_max: '', currency_code: 'INR',
  location: '', employment_type: 'full-time',
};

export default function JobRolesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');

  const { data: roles = [], isLoading } = useQuery<JobRole[]>({
    queryKey: ['job-roles'],
    queryFn: () => jobRolesApi.list().then(r => r.data),
  });

  const addRole = useMutation({
    mutationFn: (data: object) => jobRolesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-roles'] });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      toast.success('Job role created');
    },
    onError: () => toast.error('Failed to create job role'),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => jobRolesApi.setStatus(id, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['job-roles'] });
      if (vars.status === 'closed') {
        toast.success('Job role closed and removed');
      } else if (vars.status === 'paused') {
        toast.success('Job role saved as Draft');
      } else {
        toast.success('Job role activated');
      }
    },
  });

  const filtered = roles.filter(r => {
    const matchesSearch =
      r.role_title.toLowerCase().includes(search.toLowerCase()) ||
      (r.department || '').toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'active') return r.status === 'active';
    if (statusFilter === 'draft') return r.status === 'paused' || r.status === 'draft';
    return true;
  });

  const activeCount = roles.filter(r => r.status === 'active').length;
  const draftCount = roles.filter(r => r.status === 'paused' || r.status === 'draft').length;

  if (isLoading) return <PageLoader />;

  const statusColor = (s: string) => (s === 'active' ? 'badge-green' : 'badge-yellow');
  const statusLabel = (s: string) => (s === 'active' ? 'Active' : 'Draft');

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search roles..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
            All ({roles.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'active' ? 'bg-white shadow-sm text-emerald-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'draft' ? 'bg-white shadow-sm text-amber-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
            Draft ({draftCount})
          </button>
        </div>

        <button className="btn-primary ml-auto" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Role
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Briefcase size={48} />} title="No job roles yet"
          action={<button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} />Add Role</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(role => (
            <div key={role.job_role_id} className="card p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{role.role_title}</h3>
                  {role.department && <p className="text-sm text-gray-500">{role.department}</p>}
                </div>
                <Badge className={statusColor(role.status)}>{statusLabel(role.status)}</Badge>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                {role.location && (
                  <div className="flex items-center gap-2"><MapPin size={13} className="text-gray-400" />{role.location}</div>
                )}
                {(role.salary_min || role.salary_max) && (
                  <div className="flex items-center gap-2">
                    <DollarSign size={13} className="text-gray-400" />
                    {formatSalary(role.salary_min, role.currency_code)} – {formatSalary(role.salary_max, role.currency_code)}
                  </div>
                )}
                {(role.min_experience != null) && (
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-gray-400" />
                    {role.min_experience}–{role.max_experience} yrs exp
                  </div>
                )}
                {role.employment_type && (
                  <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">
                    {role.employment_type}
                  </span>
                )}
              </div>

              {role.job_description && (
                <p className="text-xs text-gray-500 line-clamp-2 mb-4">{role.job_description}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">Created {timeAgo(role.created_at)}</span>
                <select
                  value={role.status === 'draft' ? 'paused' : role.status}
                  onChange={e => setStatus.mutate({ id: role.job_role_id, status: e.target.value })}
                  onClick={e => e.stopPropagation()}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium bg-white">
                  <option value="active">Active</option>
                  <option value="paused">Draft</option>
                  <option value="closed">Close & Remove</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create Job Role" maxWidth="max-w-xl">
        <form onSubmit={e => {
          e.preventDefault();
          addRole.mutate({
            ...form,
            min_experience: form.min_experience ? parseFloat(form.min_experience) : undefined,
            max_experience: form.max_experience ? parseFloat(form.max_experience) : undefined,
            salary_min: form.salary_min ? parseFloat(form.salary_min) : undefined,
            salary_max: form.salary_max ? parseFloat(form.salary_max) : undefined,
          });
        }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Job Title *</label>
              <input className="input" required value={form.role_title}
                onChange={e => setForm(f => ({ ...f, role_title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <label className="label">Employment Type</label>
              <select className="input" value={form.employment_type}
                onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency_code}
                onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="label">Salary Min</label>
              <input className="input" type="number" value={form.salary_min}
                onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))} />
            </div>
            <div>
              <label className="label">Salary Max</label>
              <input className="input" type="number" value={form.salary_max}
                onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))} />
            </div>
            <div>
              <label className="label">Min Experience (yrs)</label>
              <input className="input" type="number" step="0.5" value={form.min_experience}
                onChange={e => setForm(f => ({ ...f, min_experience: e.target.value }))} />
            </div>
            <div>
              <label className="label">Max Experience (yrs)</label>
              <input className="input" type="number" step="0.5" value={form.max_experience}
                onChange={e => setForm(f => ({ ...f, max_experience: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Job Description</label>
              <textarea className="input min-h-[80px] resize-none" value={form.job_description}
                onChange={e => setForm(f => ({ ...f, job_description: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addRole.isPending}>
              {addRole.isPending ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
