import React from 'react';
import { Loader2 } from 'lucide-react';

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} style={{ display: 'inline-block' }} />;
}

export function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '16rem' }}>
      <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: '#2563eb' }} />
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', textAlign: 'center' }}>
      {icon && <div style={{ marginBottom: '1rem', color: '#d1d5db' }}>{icon}</div>}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>{title}</h3>
      {description && <p style={{ fontSize: '0.875rem', color: '#6b7280', maxWidth: '24rem' }}>{description}</p>}
      {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
    </div>
  );
}

const STAT_COLORS: Record<string, { bg: string; color: string }> = {
  brand:  { bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)', color: '#1e40af' },
  green:  { bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', color: '#065f46' },
  red:    { bg: 'linear-gradient(135deg, #fef2f2, #fee2e2)', color: '#991b1b' },
  yellow: { bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', color: '#92400e' },
  purple: { bg: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', color: '#5b21b6' },
  gray:   { bg: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', color: '#374151' },
};

export function StatCard({ label, value, sub, color = 'brand' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  const c = STAT_COLORS[color] || STAT_COLORS.brand;
  return (
    <div className="card" style={{ padding: '1.25rem', background: c.bg }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.color, opacity: 0.7 }}>{label}</p>
      <p style={{ fontSize: '1.875rem', fontWeight: 700, marginTop: '0.125rem', color: c.color }}>{value}</p>
      {sub && <p style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.125rem', color: c.color }}>{sub}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, maxWidth = '32rem' }: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="card animate-slide-in" style={{ position: 'relative', width: '100%', maxWidth, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{title}</h2>
          <button onClick={onClose} style={{ color: '#9ca3af', fontSize: '1.25rem', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>{children}</div>
      </div>
    </div>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('badge', className)}>{children}</span>;
}

const AVATAR_COLORS = [
  { bg: '#dbeafe', color: '#1e40af' },
  { bg: '#d1fae5', color: '#065f46' },
  { bg: '#ede9fe', color: '#5b21b6' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#fee2e2', color: '#991b1b' },
  { bg: '#cffafe', color: '#164e63' },
];

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const c = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const dim = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
  const fs = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;
  return (
    <div style={{
      width: dim, height: dim, borderRadius: '50%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 700, fontSize: fs, flexShrink: 0,
      background: c.bg, color: c.color,
    }}>
      {initials}
    </div>
  );
}
