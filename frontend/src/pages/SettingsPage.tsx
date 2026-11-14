import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { recruiter } = useAuth();
  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><User size={16} /> Profile</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Name</span>
            <span className="font-medium">{recruiter?.full_name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500 flex items-center gap-1"><Mail size={13} />Email</span>
            <span className="font-medium">{recruiter?.email}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500 flex items-center gap-1"><Shield size={13} />Role</span>
            <span className="badge badge-blue">Recruiter</span>
          </div>
        </div>
      </div>
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-2">Backend Configuration</h2>
        <p className="text-sm text-gray-500">API: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{import.meta.env.VITE_API_URL}</code></p>
      </div>
    </div>
  );
}
