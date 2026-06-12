'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/admin/Modal';

interface Props {
  id: string;
  currentStatus: string;
  currentTableName: string;
  currentMinToStart: number;
  currentMinToContinue: number;
  currentMaxPlayerCount: number;
}

export default function DeskRowActions({
  id,
  currentStatus,
  currentTableName,
  currentMinToStart,
  currentMinToContinue,
  currentMaxPlayerCount,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(
    currentStatus === 'closed' ? 'active' : currentStatus
  );
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTableName, setEditTableName] = useState(currentTableName);
  const [editMinToStart, setEditMinToStart] = useState(String(currentMinToStart));
  const [editMinToContinue, setEditMinToContinue] = useState(String(currentMinToContinue));
  const [editMaxPlayerCount, setEditMaxPlayerCount] = useState(String(currentMaxPlayerCount));
  const [editError, setEditError] = useState<string | null>(null);

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

  async function handleEditSave() {
    setEditError(null);
    const minStart = parseInt(editMinToStart);
    const minCont = parseInt(editMinToContinue);
    const maxPlayers = parseInt(editMaxPlayerCount);

    if (!editTableName.trim()) {
      setEditError('Table name is required');
      return;
    }
    if (isNaN(minStart) || minStart < 3 || isNaN(minCont) || minCont < 3 || isNaN(maxPlayers) || maxPlayers < 3) {
      setEditError('All number fields must be ≥ 3');
      return;
    }
    if (maxPlayers < minStart) {
      setEditError('Max players must be ≥ min to start');
      return;
    }
    if (minCont > minStart) {
      setEditError('Min to continue must be ≤ min to start');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pokerDesks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: editTableName.trim(),
          minToStart: minStart,
          minToContinue: minCont,
          maxPlayerCount: maxPlayers,
        }),
      });
      if (res.ok) {
        router.refresh();
        setEditOpen(false);
      } else {
        const body = await res.json();
        setEditError(body.message ?? 'Save failed');
      }
    } catch {
      setEditError('Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
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
            onClick={() => setEditOpen(true)}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
          >
            Edit
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

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit desk">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Table name</label>
            <input
              type="text"
              value={editTableName}
              onChange={(e) => setEditTableName(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Min to start</label>
              <input
                type="number"
                value={editMinToStart}
                onChange={(e) => setEditMinToStart(e.target.value)}
                min="3"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Min to continue</label>
              <input
                type="number"
                value={editMinToContinue}
                onChange={(e) => setEditMinToContinue(e.target.value)}
                min="3"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Max players</label>
              <input
                type="number"
                value={editMaxPlayerCount}
                onChange={(e) => setEditMaxPlayerCount(e.target.value)}
                min="3"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          {editError && <p className="text-red-600 text-sm">{editError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleEditSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
