import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fresherApi } from '../../api/fresherApi';
import FresherApplyWizard from './FresherApplyWizard';

interface Job {
  job_role_id: string;
  role_title: string;
  department: string | null;
  job_description: string | null;
  min_experience: number | null;
  max_experience: number | null;
  salary_min: number | null;
  salary_max: number | null;
  currency_code: string;
  location: string | null;
  employment_type: string | null;
  status: string;
  created_at: string;
}

function formatSalaryLocal(val: number | null, currency: string): string {
  if (!val) return '—';
  if (currency === 'INR') return `₹${(val / 100000).toFixed(1)}L`;
  return `${currency} ${val.toLocaleString()}`;
}

export default function FresherExploreJobsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fresher-jobs'],
    queryFn: () => fresherApi.getJobs().then(r => r.data.jobs as Job[]),
  });

  // Fetch already-applied job IDs on mount so the button shows "Applied" immediately
  const { data: appliedData } = useQuery({
    queryKey: ['fresher-applied-jobs'],
    queryFn: () => fresherApi.getAppliedJobs().then(r => (r.data.appliedJobIds || []) as string[]),
  });

  const isApplied = (jobId: string) => appliedIds.has(jobId) || (appliedData?.includes(jobId) ?? false);

  const jobs = data || [];

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    return (
      j.role_title.toLowerCase().includes(q) ||
      (j.department || '').toLowerCase().includes(q) ||
      (j.location || '').toLowerCase().includes(q) ||
      (j.employment_type || '').toLowerCase().includes(q)
    );
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
        <p className="text-red-600 font-semibold">Failed to load jobs. Please refresh.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Explore Jobs 🔍</h1>
        <p className="text-gray-500 mt-1">Browse and apply to active opportunities</p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6 max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          placeholder="Search by title, location, type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Count */}
      <p className="text-sm text-gray-500 mb-4">{filtered.length} job{filtered.length !== 1 ? 's' : ''} available</p>

      {/* Job Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <div className="text-5xl mb-4">🗂️</div>
          <h3 className="text-lg font-semibold text-gray-700">No Jobs Found</h3>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map(job => (
            <div
              key={job.job_role_id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all flex flex-col"
            >
              <div className="p-6 flex-1">
                {/* Title & type badge */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-lg font-bold text-gray-900 leading-snug">{job.role_title}</h2>
                  {job.employment_type && (
                    <span className="shrink-0 text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full capitalize whitespace-nowrap">
                      {job.employment_type}
                    </span>
                  )}
                </div>

                {/* Department */}
                {job.department && (
                  <p className="text-sm text-indigo-600 font-medium mb-3">{job.department}</p>
                )}

                {/* Meta info */}
                <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-4">
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {job.location}
                    </span>
                  )}
                  {(job.salary_min || job.salary_max) && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      {formatSalaryLocal(job.salary_min, job.currency_code)} – {formatSalaryLocal(job.salary_max, job.currency_code)}
                    </span>
                  )}
                  {job.min_experience != null && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {job.min_experience}–{job.max_experience} yrs
                    </span>
                  )}
                </div>

                {/* Description (truncated) */}
                {job.job_description && (
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {job.job_description}
                  </p>
                )}
              </div>

              {/* Footer buttons */}
              <div className="px-6 pb-5 flex items-center gap-3">
                <button
                  onClick={() => setSelectedJob(job)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                >
                  View Details
                </button>
                <div className="flex-1" />
                {isApplied(job.job_role_id) ? (
                  <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl">
                    ✓ Applied
                  </span>
                ) : (
                  <button
                    onClick={() => setApplyingJob(job)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition whitespace-nowrap"
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedJob.role_title}</h2>
                  {selectedJob.department && (
                    <p className="text-indigo-600 font-medium text-sm mt-0.5">{selectedJob.department}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-5">
                {selectedJob.location && (
                  <span className="bg-gray-100 px-3 py-1 rounded-full">📍 {selectedJob.location}</span>
                )}
                {selectedJob.employment_type && (
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full capitalize">
                    {selectedJob.employment_type}
                  </span>
                )}
                {(selectedJob.salary_min || selectedJob.salary_max) && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">
                    💰 {formatSalaryLocal(selectedJob.salary_min, selectedJob.currency_code)} – {formatSalaryLocal(selectedJob.salary_max, selectedJob.currency_code)}
                  </span>
                )}
                {selectedJob.min_experience != null && (
                  <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                    🕐 {selectedJob.min_experience}–{selectedJob.max_experience} yrs exp
                  </span>
                )}
              </div>

              {/* Full description */}
              {selectedJob.job_description ? (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Job Description</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {selectedJob.job_description}
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No detailed description provided.</p>
              )}

              {/* Apply button */}
              <div className="mt-6 flex justify-end">
                {isApplied(selectedJob.job_role_id) ? (
                  <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-6 py-2.5 rounded-xl">
                    ✓ Application Submitted
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setApplyingJob(selectedJob);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-2.5 rounded-xl transition"
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {applyingJob && (
        <FresherApplyWizard
          job={applyingJob}
          onClose={() => setApplyingJob(null)}
          onSuccess={() => {
            setAppliedIds(prev => new Set([...prev, applyingJob.job_role_id]));
            setApplyingJob(null);
            setSelectedJob(null);
            qc.invalidateQueries({ queryKey: ['fresher-applications'] });
            qc.invalidateQueries({ queryKey: ['fresher-applied-jobs'] });
          }}
        />
      )}
    </div>
  );
}
