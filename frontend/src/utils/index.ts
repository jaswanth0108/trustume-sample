import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function formatDate(dateStr: string | undefined, fmt = 'dd MMM yyyy'): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return '—';
  }
}

export function formatSalary(amount: number | undefined, currency = 'INR'): string {
  if (!amount) return '—';
  if (currency === 'INR') {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getInterestColor(status: string): string {
  const map: Record<string, string> = {
    interested: 'badge-green',
    not_interested: 'badge-red',
    maybe: 'badge-yellow',
    unknown: 'badge-gray',
    no_response: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}

export function getInterestLabel(status: string): string {
  const map: Record<string, string> = {
    interested: 'Interested',
    not_interested: 'Not Interested',
    maybe: 'Maybe',
    unknown: 'Pending',
    no_response: 'No Response',
  };
  return map[status] || status;
}

export function getActionBadge(action: string): string {
  const map: Record<string, string> = {
    schedule_interview: 'badge-green',
    follow_up: 'badge-yellow',
    share_salary: 'badge-blue',
    share_jd: 'badge-blue',
    close_application: 'badge-red',
    send_field_question: 'badge-purple',
    no_action: 'badge-gray',
  };
  return map[action] || 'badge-gray';
}

export function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    schedule_interview: 'Schedule Interview',
    follow_up: 'Follow Up',
    share_salary: 'Share Salary',
    share_jd: 'Share JD',
    close_application: 'Close',
    send_field_question: 'Ask Question',
    no_action: 'No Action',
  };
  return map[action] || action;
}

export function getPriorityColor(priority: string): string {
  const map: Record<string, string> = {
    urgent: 'badge-red',
    high: 'badge-yellow',
    medium: 'badge-blue',
    low: 'badge-gray',
  };
  return map[priority] || 'badge-gray';
}
