'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  userId: string;
  currentStatus: 'active' | 'inactive' | 'suspended';
}

export default function UserStatusControl({ userId, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Status updated' });
        router.refresh();
      } else {
        const body = await res.json();
        setMessage({ type: 'error', text: body.message ?? 'Update failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Update failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-700 mb-3">Account status</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof currentStatus)}
          className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
        >
          {loading ? 'Updating…' : 'Update status'}
        </button>
      </form>
    </div>
  );
}
