'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PokerCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gameType, setGameType] = useState("Texas Hold'em");
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/poker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType, description: description || undefined }),
      });
      if (res.ok) {
        setOpen(false);
        setGameType("Texas Hold'em");
        setDescription('');
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
        onClick={() => { setOpen(!open); setError(null); }}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        {open ? 'Cancel' : '+ Add game type'}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Game type</label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Texas Hold'em">Texas Hold&apos;em</option>
              <option value="Omaha">Omaha</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}
    </div>
  );
}
