import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFresherAuth } from '../../context/FresherAuthContext';
import toast from 'react-hot-toast';

export default function FresherLoginPage() {
  const { login } = useFresherAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/fresher/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Trustume</h1>
          <p className="text-indigo-600 font-semibold mt-1">Candidate Portal</p>
          <p className="text-gray-500 text-sm mt-2">Sign in to view your job applications and messages from recruiters</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition shadow-md hover:shadow-lg"
            >
              {loading ? 'Signing in…' : 'Sign In as Candidate'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-5 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <p className="text-xs font-semibold text-indigo-700 mb-2">🧪 Demo Credentials</p>
            <div className="space-y-1 text-xs text-indigo-600 font-mono">
              <p>rahul@seed.trustume.com</p>
              <p>priya@seed.trustume.com</p>
              <p>sneha@seed.trustume.com</p>
              <p className="text-indigo-500">Password: <span className="font-semibold">Fresher@123</span></p>
            </div>
          </div>

          <div className="mt-5 text-center pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Are you a Recruiter?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-semibold">
                Sign in here →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
