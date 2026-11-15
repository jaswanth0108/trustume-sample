import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../api';
import toast from 'react-hot-toast';

interface Applicant {
  application_id: string;
  application_status: string;
  applied_at: string;
  full_name: string;
  email: string;
  headline: string | null;
  education: string | null;
  experience_years: number | null;
  linkedin_url: string | null;
  github_url: string | null;
  resume_filename: string | null;
  skills_snapshot: Array<{ skill_name: string; proficiency: string }> | null;
  verification_status: string | null;
  role_title: string;
}

interface ApplicationDetail extends Applicant {
  phone: string | null;
  location: string | null;
  portfolio_url: string | null;
  projects_snapshot: Array<{ title: string; description: string; technologies: string; repo_url: string; live_url: string; contribution: string }> | null;
  motivation: string | null;
  suitability: string | null;
  notice_period_days: number | null;
  willing_to_relocate: boolean | null;
  additional_info: string | null;
  recruiter_notes: string | null;
  has_resume: boolean;
  submitted_at: string | null;
  department: string | null;
  employment_type: string | null;
}

const verificationColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  shortlisted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  interview_scheduled: 'bg-purple-100 text-purple-700',
  selected: 'bg-emerald-100 text-emerald-700',
};

const verificationLabels: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
  interview_scheduled: 'Interview Scheduled',
  selected: 'Selected',
};

export default function ApplicantsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['all-applicants'],
    queryFn: () => profileApi.getAllApplicants().then(r => r.data.applicants as Applicant[]),
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['applicant-detail', selectedId],
    queryFn: () => selectedId ? profileApi.getApplicationDetail(selectedId).then(r => r.data.application as ApplicationDetail) : null,
    enabled: !!selectedId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, ...data }: { id: string; verification_status?: string; application_status?: string; recruiter_notes?: string }) =>
      profileApi.updateApplicationStatus(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-applicants'] });
      qc.invalidateQueries({ queryKey: ['applicant-detail', selectedId] });
      toast.success('Updated successfully');
      setEditingNotes(false);
    },
    onError: () => toast.error('Update failed'),
  });

  const applicants = data || [];
  const filtered = applicants.filter(a =>
    !search || a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    a.role_title.toLowerCase().includes(search.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const detail = detailData;
  const token = localStorage.getItem('trustume_token') || '';
  const resumeUrl = selectedId ? `${profileApi.getResume(selectedId)}?token=${encodeURIComponent(token)}` : null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="flex gap-5 h-full min-h-0" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Left: Applicant list */}
      <div className="w-96 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Applicants</h1>
          <span className="text-sm text-gray-500">{applicants.length} total</span>
        </div>
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="Search by name, role, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm">{search ? 'No matching applicants' : 'No applicants yet'}</p>
          </div>
        ) : (
          filtered.map(a => (
            <div
              key={a.application_id}
              onClick={() => { setSelectedId(a.application_id); setNotes(''); setEditingNotes(false); }}
              className={`card p-4 cursor-pointer hover:shadow-md transition-all ${selectedId === a.application_id ? 'ring-2 ring-brand-500 shadow-md' : ''}`}
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{a.full_name}</p>
                  <p className="text-xs text-gray-500">{a.email}</p>
                </div>
                {a.verification_status && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${verificationColors[a.verification_status] || 'bg-gray-100 text-gray-600'}`}>
                    {verificationLabels[a.verification_status] || a.verification_status}
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-600 font-medium mb-2">{a.role_title}</p>
              {a.headline && <p className="text-xs text-gray-600 line-clamp-1">{a.headline}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {a.linkedin_url && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">LinkedIn ✓</span>}
                {a.github_url && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">GitHub ✓</span>}
                {a.resume_filename && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">Resume ✓</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Right: Application detail */}
      <div className="flex-1 overflow-y-auto">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-5xl mb-3">👈</p>
              <p>Select an applicant to view their full application</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : !detail ? (
          <p className="text-gray-400 text-center py-12">No detail available</p>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{detail.full_name}</h2>
                  {detail.headline && <p className="text-indigo-600 font-medium">{detail.headline}</p>}
                  <p className="text-sm text-gray-500 mt-0.5">{detail.email} {detail.phone && `· ${detail.phone}`}</p>
                  {detail.location && <p className="text-sm text-gray-500">📍 {detail.location}</p>}
                </div>
                <div className="text-right space-y-2">
                  <p className="text-sm font-semibold text-gray-700">{detail.role_title}</p>
                  {detail.submitted_at && <p className="text-xs text-gray-400">Applied {new Date(detail.submitted_at).toLocaleDateString()}</p>}
                </div>
              </div>
              {/* Status controls */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Verification Status</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    value={detail.verification_status || 'submitted'}
                    onChange={e => updateStatus.mutate({ id: selectedId, verification_status: e.target.value })}
                  >
                    {Object.entries(verificationLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Application Status</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    value={detail.application_status}
                    onChange={e => updateStatus.mutate({ id: selectedId, application_status: e.target.value })}
                  >
                    {['new','screening','interview','offer','hired','rejected','closed'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Professional Links */}
            <div className="card p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">🔗 Professional Links</h3>
              <div className="space-y-2 text-sm">
                {detail.linkedin_url ? <p><span className="text-gray-500 w-20 inline-block">LinkedIn:</span> <a href={detail.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{detail.linkedin_url}</a></p> : <p className="text-gray-400">LinkedIn: not provided</p>}
                {detail.github_url ? <p><span className="text-gray-500 w-20 inline-block">GitHub:</span> <a href={detail.github_url} target="_blank" rel="noreferrer" className="text-gray-800 hover:underline">{detail.github_url}</a></p> : <p className="text-gray-400">GitHub: not provided</p>}
                {detail.portfolio_url && <p><span className="text-gray-500 w-20 inline-block">Portfolio:</span> <a href={detail.portfolio_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{detail.portfolio_url}</a></p>}
              </div>
            </div>

            {/* Resume */}
            <div className="card p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">📄 Resume</h3>
              {detail.has_resume ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-sm font-medium text-green-800">📄 {detail.resume_filename || 'Resume uploaded'}</p>
                  <a
                    href={resumeUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg font-medium"
                  >
                    Download / View
                  </a>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No resume uploaded</p>
              )}
            </div>

            {/* Education + Experience */}
            <div className="card p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">🎓 Education & Experience</h3>
              <div className="space-y-1 text-sm">
                {detail.education && <p><span className="text-gray-500">Education:</span> {detail.education}</p>}
                {detail.experience_years != null && <p><span className="text-gray-500">Experience:</span> {detail.experience_years} years</p>}
                {detail.notice_period_days != null && <p><span className="text-gray-500">Notice Period:</span> {detail.notice_period_days} days</p>}
                {detail.willing_to_relocate != null && <p><span className="text-gray-500">Willing to Relocate:</span> {detail.willing_to_relocate ? 'Yes' : 'No'}</p>}
              </div>
            </div>

            {/* Skills */}
            {detail.skills_snapshot && (Array.isArray(detail.skills_snapshot) ? detail.skills_snapshot : JSON.parse(detail.skills_snapshot as unknown as string)).length > 0 && (
              <div className="card p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">⚡ Technical Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(detail.skills_snapshot) ? detail.skills_snapshot : JSON.parse(detail.skills_snapshot as unknown as string)).map((s: { skill_name: string; proficiency: string }, i: number) => (
                    <span key={i} className={`px-3 py-1 rounded-full text-sm font-medium ${s.proficiency === 'advanced' ? 'bg-green-100 text-green-800' : s.proficiency === 'intermediate' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                      {s.skill_name} <span className="text-xs opacity-70">({s.proficiency})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            {detail.projects_snapshot && (Array.isArray(detail.projects_snapshot) ? detail.projects_snapshot : JSON.parse(detail.projects_snapshot as unknown as string)).length > 0 && (
              <div className="card p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">🚀 Projects</h3>
                <div className="space-y-3">
                  {(Array.isArray(detail.projects_snapshot) ? detail.projects_snapshot : JSON.parse(detail.projects_snapshot as unknown as string)).map((p: { title: string; description: string; technologies: string; repo_url: string; live_url: string; contribution: string }, i: number) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-3">
                      <p className="font-semibold text-gray-900">{p.title}</p>
                      {p.technologies && <p className="text-xs text-indigo-600 mt-0.5">{p.technologies}</p>}
                      {p.description && <p className="text-sm text-gray-600 mt-1">{p.description}</p>}
                      {p.contribution && <p className="text-xs text-gray-500 mt-1">Role: {p.contribution}</p>}
                      <div className="flex gap-3 mt-2">
                        {p.repo_url && <a href={p.repo_url} target="_blank" rel="noreferrer" className="text-xs text-gray-700 hover:underline">GitHub →</a>}
                        {p.live_url && <a href={p.live_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Live →</a>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Motivation */}
            {(detail.motivation || detail.suitability) && (
              <div className="card p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">💬 Candidate Responses</h3>
                {detail.motivation && <div className="mb-3"><p className="text-xs font-medium text-gray-500 mb-1">Why interested in this role?</p><p className="text-sm text-gray-700">{detail.motivation}</p></div>}
                {detail.suitability && <div><p className="text-xs font-medium text-gray-500 mb-1">Why suitable?</p><p className="text-sm text-gray-700">{detail.suitability}</p></div>}
                {detail.additional_info && <div className="mt-3"><p className="text-xs font-medium text-gray-500 mb-1">Additional info</p><p className="text-sm text-gray-700">{detail.additional_info}</p></div>}
              </div>
            )}

            {/* Recruiter Notes (private) */}
            <div className="card p-4 border-2 border-dashed border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">🔒 Recruiter Notes (Private)</h3>
                <button onClick={() => { setNotes(detail.recruiter_notes || ''); setEditingNotes(true); }} className="text-xs text-indigo-600 hover:underline">Edit</button>
              </div>
              {editingNotes ? (\n                <div>
                  <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add private notes about this candidate..." />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => updateStatus.mutate({ id: selectedId, recruiter_notes: notes })} className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg font-medium">Save Notes</button>
                    <button onClick={() => setEditingNotes(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 italic">{detail.recruiter_notes || 'No notes yet. Click Edit to add private recruiter notes.'}</p>
              )}
              <p className="text-xs text-orange-500 mt-2">These notes are only visible to you, never to the candidate.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
