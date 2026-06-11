'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  userId: string;
  lockedBonus: string;
}

export default function UserBalanceControl({ userId, lockedBonus: initialLockedBonus }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [displayBonus, setDisplayBonus] = useState(initialLockedBonus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(direction: 1 | -1) {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed === 0) {
      setError('Enter a valid non-zero amount');
      return;
    }
    const bonusAmount = Math.round(parsed * 100) * direction;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bonusAmount }),
      });
      const body = await res.json();
      if (res.ok) {
        setDisplayBonus(body.lockedBonus);
        setAmount('');
        router.refresh();
      } else {
        setError(body.message ?? 'Action failed');
      }
    } catch {
      setError('Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-700 mb-3">Locked bonus</p>
      <p className="text-sm text-slate-600 mb-3">
        Current: <span className="font-medium text-slate-900">{displayBonus}</span>
      </p>
      <div className="space-y-3">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (e.g. 50)"
          min="0.01"
          step="0.01"
          className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAction(1)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
          >
            Credit
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAction(-1)}
            className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
          >
            Debit
          </button>
        </div>
      </div>
    </div>
  );
}
