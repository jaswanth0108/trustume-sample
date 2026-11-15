import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFresherAuth } from '../../context/FresherAuthContext';
import { fresherApi } from '../../api/fresherApi';
import toast from 'react-hot-toast';

interface Job {
  job_role_id: string;
  role_title: string;
  employment_type: string | null;
  department: string | null;
  location: string | null;
}

interface WizardProps {
  job: Job;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface Skill { name: string; proficiency: 'beginner' | 'intermediate' | 'advanced'; }
interface Project { title: string; description: string; technologies: string; repo_url: string; live_url: string; contribution: string; }

const STEPS = [
  'Personal Info',
  'Professional Links',
  'Resume Upload',
  'Technical Skills',
  'Projects',
  'Additional Info',
  'Review & Submit',
];

const isTechnical = (job: Job) => {
  const keywords = ['engineer', 'developer', 'software', 'technical', 'backend', 'frontend', 'fullstack', 'data', 'ai', 'ml'];
  const title = (job.role_title + ' ' + (job.department || '')).toLowerCase();
  return keywords.some(k => title.includes(k)) || job.employment_type !== 'internship';
};

export default function FresherApplyWizard({ job, onClose, onSuccess }: WizardProps) {
  const { candidate } = useFresherAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const technical = isTechnical(job);

  // Form state
  const [personal, setPersonal] = useState({
    phone: candidate?.phone || '',
    location: candidate?.location || '',
    headline: '',
    education: '',
    experience_years: '',
  });
  const [links, setLinks] = useState({ linkedin_url: '', github_url: '', portfolio_url: '' });
  const [resume, setResume] = useState<{ filename: string; mimetype: string; data: string } | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkill, setNewSkill] = useState({ name: '', proficiency: 'intermediate' as const });
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProject, setNewProject] = useState<Project>({ title: '', description: '', technologies: '', repo_url: '', live_url: '', contribution: '' });
  const [addingProject, setAddingProject] = useState(false);
  const [additional, setAdditional] = useState({ motivation: '', suitability: '', notice_period_days: '', willing_to_relocate: false, additional_info: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!personal.phone.trim()) e.phone = 'Phone is required';
      if (!personal.headline.trim()) e.headline = 'Professional headline is required';
      if (!personal.education.trim()) e.education = 'Education is required';
    }
    if (step === 2) {
      if (!links.linkedin_url || !links.linkedin_url.includes('linkedin.com')) e.linkedin_url = 'Valid LinkedIn URL required (must contain linkedin.com)';
      if (technical && links.github_url && !links.github_url.includes('github.com')) e.github_url = 'GitHub URL must contain github.com';
      if (links.portfolio_url && !links.portfolio_url.startsWith('http')) e.portfolio_url = 'Portfolio URL must start with http:// or https://';
    }
    if (step === 3) {
      if (!resume) e.resume = 'Resume is required (PDF or DOCX, max 5MB)';
    }
    if (step === 4) {
      if (technical && skills.length === 0) e.skills = 'Add at least one technical skill';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    setStep(s => (s < 7 ? (s + 1) as Step : s));
  };
  const handleBack = () => setStep(s => (s > 1 ? (s - 1) as Step : s));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) { toast.error('Only PDF or DOCX files allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setResume({ filename: file.name, mimetype: file.type, data: base64 });
      toast.success('Resume uploaded: ' + file.name);
    };
    reader.readAsDataURL(file);
  };

  const addSkill = () => {
    if (!newSkill.name.trim()) return;
    if (skills.find(s => s.name.toLowerCase() === newSkill.name.toLowerCase())) { toast.error('Skill already added'); return; }
    setSkills(prev => [...prev, { name: newSkill.name.trim(), proficiency: newSkill.proficiency }]);
    setNewSkill({ name: '', proficiency: 'intermediate' });
  };

  const addProject = () => {
    if (!newProject.title.trim()) { toast.error('Project title is required'); return; }
    setProjects(prev => [...prev, { ...newProject }]);
    setNewProject({ title: '', description: '', technologies: '', repo_url: '', live_url: '', contribution: '' });
    setAddingProject(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fresherApi.submitApplication(job.job_role_id, {
        ...personal,
        experience_years: personal.experience_years ? parseFloat(personal.experience_years) : undefined,
        ...links,
        resume_filename: resume?.filename,
        resume_mimetype: resume?.mimetype,
        resume_data: resume?.data,
        skills: skills.map(s => ({ skill_name: s.name, proficiency: s.proficiency })),
        projects,
        ...additional,
        notice_period_days: additional.notice_period_days ? parseInt(additional.notice_period_days) : undefined,
      });
      toast.success('Application submitted successfully! 🎉');
      onSuccess();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string }; status?: number } };
      if (error?.response?.status === 409) {
        toast('You have already applied to this job.', { icon: 'ℹ️' });
        onClose();
      } else {
        toast.error(error?.response?.data?.error || 'Failed to submit application');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const proficiencyColor = (p: string) => p === 'advanced' ? 'bg-green-100 text-green-800' : p === 'intermediate' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Apply for {job.role_title}</h2>
              {job.department && <p className="text-sm text-indigo-600">{job.department}</p>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <React.Fragment key={i}>
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              </React.Fragment>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>Step {step} of {STEPS.length}</span>
            <span className="font-medium text-indigo-600">{STEPS[step - 1]}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-2">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-500" value={candidate?.full_name || ''} disabled />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-500" value={candidate?.email || ''} disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input className={`w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.phone ? 'border-red-400' : 'border-gray-200'}`} placeholder="+91 98765 43210" value={personal.phone} onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))} />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Location</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="City, State" value={personal.location} onChange={e => setPersonal(p => ({ ...p, location: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Professional Headline *</label>
                  <input className={`w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.headline ? 'border-red-400' : 'border-gray-200'}`} placeholder="e.g. Full Stack Developer | React & Node.js" value={personal.headline} onChange={e => setPersonal(p => ({ ...p, headline: e.target.value }))} />
                  {errors.headline && <p className="text-red-500 text-xs mt-1">{errors.headline}</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Education / Qualification *</label>
                  <input className={`w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.education ? 'border-red-400' : 'border-gray-200'}`} placeholder="e.g. B.Tech Computer Science, IIT Delhi (2024)" value={personal.education} onChange={e => setPersonal(p => ({ ...p, education: e.target.value }))} />
                  {errors.education && <p className="text-red-500 text-xs mt-1">{errors.education}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                  <input type="number" min="0" max="50" step="0.5" className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="0" value={personal.experience_years} onChange={e => setPersonal(p => ({ ...p, experience_years: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Professional Links */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-2">Professional Links</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile *</label>
                <input className={`w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.linkedin_url ? 'border-red-400' : 'border-gray-200'}`} placeholder="https://linkedin.com/in/yourname" value={links.linkedin_url} onChange={e => setLinks(l => ({ ...l, linkedin_url: e.target.value }))} />
                {errors.linkedin_url && <p className="text-red-500 text-xs mt-1">{errors.linkedin_url}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Profile {technical ? '*' : '(optional)'}</label>
                <input className={`w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.github_url ? 'border-red-400' : 'border-gray-200'}`} placeholder="https://github.com/username" value={links.github_url} onChange={e => setLinks(l => ({ ...l, github_url: e.target.value }))} />
                {errors.github_url && <p className="text-red-500 text-xs mt-1">{errors.github_url}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio / Website (optional)</label>
                <input className={`w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.portfolio_url ? 'border-red-400' : 'border-gray-200'}`} placeholder="https://yourportfolio.com" value={links.portfolio_url} onChange={e => setLinks(l => ({ ...l, portfolio_url: e.target.value }))} />
                {errors.portfolio_url && <p className="text-red-500 text-xs mt-1">{errors.portfolio_url}</p>}
              </div>
              <p className="text-xs text-gray-400 bg-amber-50 border border-amber-200 rounded-lg p-3">ℹ️ URLs are format-validated only. Recruiters will manually verify your profiles during the review process.</p>
            </div>
          )}

          {/* Step 3: Resume */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-2">Resume Upload</h3>
              <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${resume ? 'border-green-400 bg-green-50' : errors.resume ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-indigo-400'}`}>
                {resume ? (
                  <div>
                    <div className="text-4xl mb-2">📄</div>
                    <p className="font-semibold text-green-700">{resume.filename}</p>
                    <p className="text-sm text-gray-500 mt-1">{resume.mimetype === 'application/pdf' ? 'PDF' : 'DOCX'} uploaded successfully</p>
                    <button onClick={() => { setResume(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="mt-3 text-sm text-red-500 hover:text-red-700 underline">Remove and re-upload</button>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl mb-2">📎</div>
                    <p className="font-semibold text-gray-700">Drag & drop or click to upload</p>
                    <p className="text-sm text-gray-400 mt-1">PDF preferred · DOCX accepted · Max 5MB</p>
                    <button onClick={() => fileInputRef.current?.click()} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition">Choose File</button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleFileChange} />
              </div>
              {errors.resume && <p className="text-red-500 text-sm">{errors.resume}</p>}
            </div>
          )}

          {/* Step 4: Skills */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-2">Technical Skills {technical ? '*' : '(optional)'}</h3>
              {/* Add skill */}
              <div className="flex gap-2">
                <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="e.g. Python, React, SQL..." value={newSkill.name} onChange={e => setNewSkill(s => ({ ...s, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addSkill()} />
                <select className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none" value={newSkill.proficiency} onChange={e => setNewSkill(s => ({ ...s, proficiency: e.target.value as 'beginner' | 'intermediate' | 'advanced' }))}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <button onClick={addSkill} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium">Add</button>
              </div>
              {errors.skills && <p className="text-red-500 text-sm">{errors.skills}</p>}
              {/* Skills list */}
              <div className="flex flex-wrap gap-2 min-h-[60px] border border-gray-100 rounded-xl p-3 bg-gray-50">
                {skills.length === 0 && <p className="text-sm text-gray-400 m-auto">No skills added yet</p>}
                {skills.map((s, i) => (
                  <span key={i} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${proficiencyColor(s.proficiency)}`}>
                    {s.name}
                    <span className="text-xs opacity-70 capitalize">({s.proficiency})</span>
                    <button onClick={() => setSkills(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-current opacity-50 hover:opacity-100">×</button>
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400">Press Enter or click Add. Proficiency is self-declared and will be evaluated by the recruiter.</p>
            </div>
          )}

          {/* Step 5: Projects */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Projects & Experience (optional)</h3>
                <button onClick={() => setAddingProject(true)} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg">+ Add Project</button>
              </div>
              {/* Add project form */}
              {addingProject && (
                <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
                  <h4 className="font-medium text-sm text-indigo-800">New Project</h4>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Project Title *" value={newProject.title} onChange={e => setNewProject(p => ({ ...p, title: e.target.value }))} />
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="Short description" value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} />
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Technologies used (e.g. React, Node.js, PostgreSQL)" value={newProject.technologies} onChange={e => setNewProject(p => ({ ...p, technologies: e.target.value }))} />
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="GitHub repo URL (optional)" value={newProject.repo_url} onChange={e => setNewProject(p => ({ ...p, repo_url: e.target.value }))} />
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Live URL (optional)" value={newProject.live_url} onChange={e => setNewProject(p => ({ ...p, live_url: e.target.value }))} />
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Your role / contribution" value={newProject.contribution} onChange={e => setNewProject(p => ({ ...p, contribution: e.target.value }))} />
                  <div className="flex gap-2">
                    <button onClick={addProject} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg">Save Project</button>
                    <button onClick={() => setAddingProject(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200">Cancel</button>
                  </div>
                </div>
              )}
              {/* Projects list */}
              {projects.length === 0 && !addingProject && (
                <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  No projects added yet. Click "+ Add Project" to add one.
                </div>
              )}
              {projects.map((p, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{p.title}</h4>
                      {p.technologies && <p className="text-xs text-indigo-600 mt-0.5">{p.technologies}</p>}
                      {p.description && <p className="text-sm text-gray-600 mt-1">{p.description}</p>}
                    </div>
                    <button onClick={() => setProjects(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 6: Additional Info */}
          {step === 6 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-2">Additional Information</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Why are you interested in this role?</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" rows={3} placeholder="Tell us what excites you about this opportunity..." value={additional.motivation} onChange={e => setAdditional(a => ({ ...a, motivation: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Why are you suitable for this position?</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" rows={3} placeholder="Highlight your relevant skills, experience, or projects..." value={additional.suitability} onChange={e => setAdditional(a => ({ ...a, suitability: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period (days)</label>
                  <input type="number" min="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="0" value={additional.notice_period_days} onChange={e => setAdditional(a => ({ ...a, notice_period_days: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input type="checkbox" id="relocate" checked={additional.willing_to_relocate} onChange={e => setAdditional(a => ({ ...a, willing_to_relocate: e.target.checked }))} className="rounded" />
                  <label htmlFor="relocate" className="text-sm font-medium text-gray-700">Willing to relocate</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anything else you'd like to share? (optional)</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" rows={2} value={additional.additional_info} onChange={e => setAdditional(a => ({ ...a, additional_info: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Step 7: Review */}
          {step === 7 && (
            <div className="space-y-4 text-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Review Your Application</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide">Personal</h4>
                <p><span className="text-gray-500">Name:</span> {candidate?.full_name}</p>
                <p><span className="text-gray-500">Phone:</span> {personal.phone}</p>
                <p><span className="text-gray-500">Headline:</span> {personal.headline}</p>
                <p><span className="text-gray-500">Education:</span> {personal.education}</p>
                {personal.experience_years && <p><span className="text-gray-500">Experience:</span> {personal.experience_years} yrs</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide">Professional Links</h4>
                <p><span className="text-gray-500">LinkedIn:</span> <a href={links.linkedin_url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{links.linkedin_url || '—'}</a></p>
                <p><span className="text-gray-500">GitHub:</span> <a href={links.github_url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{links.github_url || '—'}</a></p>
                {links.portfolio_url && <p><span className="text-gray-500">Portfolio:</span> <a href={links.portfolio_url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{links.portfolio_url}</a></p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-2">Resume</h4>
                <p>{resume ? `📄 ${resume.filename}` : '❌ Not uploaded'}</p>
              </div>
              {skills.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-2">Skills ({skills.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s, i) => <span key={i} className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${proficiencyColor(s.proficiency)}`}>{s.name} ({s.proficiency})</span>)}
                  </div>
                </div>
              )}
              {projects.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-2">Projects ({projects.length})</h4>
                  {projects.map((p, i) => <p key={i} className="text-gray-700">• {p.title} {p.technologies && <span className="text-gray-400">({p.technologies})</span>}</p>)}
                </div>
              )}
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">Please review before submitting. You cannot edit after submission.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={step === 1 ? onClose : handleBack} className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step < 7 ? (
            <button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2 rounded-xl transition">
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold text-sm px-8 py-2 rounded-xl transition">
              {submitting ? 'Submitting...' : '✓ Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
