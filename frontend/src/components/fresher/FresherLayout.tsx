import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useFresherAuth } from '../../context/FresherAuthContext';
import toast from 'react-hot-toast';

export default function FresherLayout() {
  const { candidate, logout, isLoading } = useFresherAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!candidate) {
    navigate('/fresher/login');
    return null;
  }

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    navigate('/fresher/login');
  };

  const navLinks = [
    { to: '/fresher/dashboard', label: '📋 My Applications' },
    { to: '/fresher/explore',   label: '🔍 Explore Jobs' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <header className="bg-indigo-700 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/fresher/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <span className="text-white font-bold text-lg">Trustume</span>
              <span className="text-indigo-200 text-xs ml-2">Candidate Portal</span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition ${
                  location.pathname === link.to
                    ? 'bg-white/20 text-white'
                    : 'text-indigo-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-white font-semibold text-sm">{candidate.full_name}</p>
              <p className="text-indigo-200 text-xs">{candidate.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex gap-1 px-4 pb-2">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                location.pathname === link.to
                  ? 'bg-white/20 text-white'
                  : 'text-indigo-300 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
