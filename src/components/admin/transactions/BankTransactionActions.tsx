'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  transactionId: string;
  currentStatus: string;
}

export default function BankTransactionActions({ transactionId, currentStatus }: Props) {
  const router = useRouter();
  const [loadingApprove, setLoadingApprove] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);

  if (currentStatus !== 'pending') return null;

  const isLoading = loadingApprove || loadingReject;

  async function handleAction(status: 'completed' | 'failed') {
    const setLoading = status === 'completed' ? setLoadingApprove : setLoadingReject;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bankTransactions/${transactionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        console.error('Transaction action failed:', await res.json());
      }
    } catch (err) {
      console.error('Transaction action failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        disabled={isLoading}
        onClick={() => handleAction('completed')}
        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
      >
        {loadingApprove ? '…' : 'Approve'}
      </button>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => handleAction('failed')}
        className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
      >
        {loadingReject ? '…' : 'Reject'}
      </button>
    </div>
  );
}
