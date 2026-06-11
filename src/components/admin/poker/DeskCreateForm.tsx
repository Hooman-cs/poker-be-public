'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  pokerModeId: string;
}

export default function DeskCreateForm({ pokerModeId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tableName, setTableName] = useState('');
  const [minToStart, setMinToStart] = useState('4');
  const [minToContinue, setMinToContinue] = useState('3');
  const [maxPlayerCount, setMaxPlayerCount] = useState('6');
  const [isPractice, setIsPractice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTableName('');
    setMinToStart('4');
    setMinToContinue('3');
    setMaxPlayerCount('6');
    setIsPractice(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const minStart = parseInt(minToStart);
    const minCont = parseInt(minToContinue);
    const maxPlayers = parseInt(maxPlayerCount);

    if (maxPlayers < minStart) {
      setError('Max players must be ≥ min to start');
      return;
    }
    if (minCont > minStart) {
      setError('Min to continue must be ≤ min to start');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/pokerDesks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pokerModeId,
          tableName,
          minToStart: minStart,
          minToContinue: minCont,
          maxPlayerCount: maxPlayers,
          isPractice,
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
        {open ? 'Cancel' : '+ Add desk'}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Table name</label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. Table 1"
              required
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Min to start</label>
              <input
                type="number"
                value={minToStart}
                onChange={(e) => setMinToStart(e.target.value)}
                min="3"
                required
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Min to continue</label>
              <input
                type="number"
                value={minToContinue}
                onChange={(e) => setMinToContinue(e.target.value)}
                min="3"
                required
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Max players</label>
              <input
                type="number"
                value={maxPlayerCount}
                onChange={(e) => setMaxPlayerCount(e.target.value)}
                min="3"
                required
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isPractice}
              onChange={(e) => setIsPractice(e.target.checked)}
              className="rounded border-slate-300"
            />
            Practice desk
          </label>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create desk'}
          </button>
        </form>
      )}
    </div>
  );
}
