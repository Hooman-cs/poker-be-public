'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  id: string;
  currentStatus: string;
}

export default function DeskRowActions({ id, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(
    currentStatus === 'closed' ? 'active' : currentStatus
  );
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pokerDesks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json();
        setError(body.message ?? 'Update failed');
      }
    } catch {
      setError('Update failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pokerDesks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json();
        setError(body.message ?? 'Delete failed');
        setConfirmDelete(false);
      }
    } catch {
      setError('Delete failed');
      setConfirmDelete(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={loading}
          className="text-sm border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
        <button
          onClick={handleUpdate}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
        >
          Update
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className={`text-xs font-medium px-2.5 py-1 rounded transition-colors disabled:opacity-50 ${
            confirmDelete
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {confirmDelete ? 'Confirm' : 'Delete'}
        </button>
        {confirmDelete && (
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
