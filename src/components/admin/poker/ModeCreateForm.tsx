'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  pokerId: string;
}

export default function ModeCreateForm({ pokerId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'cash' | 'practice'>('cash');
  const [stake, setStake] = useState('');
  const [minBuyIn, setMinBuyIn] = useState('');
  const [maxBuyIn, setMaxBuyIn] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode('cash');
    setStake('');
    setMinBuyIn('');
    setMaxBuyIn('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const stakeVal = parseFloat(stake);
    const minVal = parseFloat(minBuyIn);
    const maxVal = parseFloat(maxBuyIn);

    if (!stake || !minBuyIn || !maxBuyIn || stakeVal <= 0 || minVal <= 0 || maxVal <= 0) {
      setError('All values must be greater than 0');
      return;
    }
    if (maxVal <= minVal) {
      setError('Max buy-in must be greater than min buy-in');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/pokerModes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pokerId,
          stake: Math.round(stakeVal * 100),
          minBuyIn: Math.round(minVal * 100),
          maxBuyIn: Math.round(maxVal * 100),
          mode,
        }),
      });
      if (res.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        const body = await res.json();
        setError(body.message ?? 'Create failed');
      }
    } catch {
      setError('Create failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-dashed border-slate-300 rounded-lg p-4 mb-4">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (open) reset(); }}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        {open ? 'Cancel' : '+ Add mode'}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'cash' | 'practice')}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="cash">Cash</option>
                <option value="practice">Practice</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Stake (SB, ₹)</label>
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder="e.g. 100 for ₹100"
                min="0.01"
                step="0.01"
                required
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Min buy-in (₹)</label>
              <input
                type="number"
                value={minBuyIn}
                onChange={(e) => setMinBuyIn(e.target.value)}
                placeholder="e.g. 500"
                min="0.01"
                step="0.01"
                required
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Max buy-in (₹)</label>
              <input
                type="number"
                value={maxBuyIn}
                onChange={(e) => setMaxBuyIn(e.target.value)}
                placeholder="e.g. 2000"
                min="0.01"
                step="0.01"
                required
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create mode'}
          </button>
        </form>
      )}
    </div>
  );
}
