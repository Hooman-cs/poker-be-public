'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/admin/Modal';

interface Props {
  id: string;
  currentStatus: string;
  currentStake: string;
  currentMinBuyIn: string;
  currentMaxBuyIn: string;
  currency: string;
}

export default function ModeRowActions({
  id,
  currentStatus,
  currentStake,
  currentMinBuyIn,
  currentMaxBuyIn,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editStake, setEditStake] = useState(currentStake.replace(/[^0-9.]/g, ''));
  const [editMinBuyIn, setEditMinBuyIn] = useState(currentMinBuyIn.replace(/[^0-9.]/g, ''));
  const [editMaxBuyIn, setEditMaxBuyIn] = useState(currentMaxBuyIn.replace(/[^0-9.]/g, ''));
  const [editError, setEditError] = useState<string | null>(null);

  async function handleUpdate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pokerModes/${id}`, {
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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pokerModes/${id}`, { method: 'DELETE' });
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
    const stake = parseFloat(editStake);
    const minBuyIn = parseFloat(editMinBuyIn);
    const maxBuyIn = parseFloat(editMaxBuyIn);

    if (!stake || stake <= 0 || !minBuyIn || minBuyIn <= 0 || !maxBuyIn || maxBuyIn <= 0) {
      setEditError('All values must be greater than 0');
      return;
    }
    if (maxBuyIn <= minBuyIn) {
      setEditError('Max buy-in must be greater than min buy-in');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pokerModes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stake: Math.round(stake * 100),
          minBuyIn: Math.round(minBuyIn * 100),
          maxBuyIn: Math.round(maxBuyIn * 100),
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
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={loading}
            className="text-sm border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
          <button
            type="button"
            disabled={loading}
            onClick={handleUpdate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
          >
            Update
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setEditOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
          >
            Edit
          </button>

          {confirmDelete ? (
            <>
              <span className="text-xs text-slate-600">Confirm?</span>
              <button
                type="button"
                disabled={loading}
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
              >
                Yes, delete
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmDelete(true)}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit mode">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Stake SB (₹)</label>
            <input
              type="number"
              value={editStake}
              onChange={(e) => setEditStake(e.target.value)}
              min="0.01"
              step="0.01"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Min buy-in (₹)</label>
            <input
              type="number"
              value={editMinBuyIn}
              onChange={(e) => setEditMinBuyIn(e.target.value)}
              min="0.01"
              step="0.01"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Max buy-in (₹)</label>
            <input
              type="number"
              value={editMaxBuyIn}
              onChange={(e) => setEditMaxBuyIn(e.target.value)}
              min="0.01"
              step="0.01"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
