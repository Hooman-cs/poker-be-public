'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TransactionsFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [type, setType] = useState(params.get('type') ?? '');

  function pushParams(nextStatus: string, nextType: string) {
    const sp = new URLSearchParams();
    sp.set('page', '1');
    if (nextStatus) sp.set('status', nextStatus);
    if (nextType) sp.set('type', nextType);
    router.push(`/admin/transactions?${sp.toString()}`);
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setStatus(val);
    pushParams(val, type);
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setType(val);
    pushParams(status, val);
  }

  return (
    <div className="flex gap-3 items-center px-4 py-3 border-b border-slate-200 bg-white">
      <select
        value={status}
        onChange={handleStatusChange}
        className="text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-9"
      >
        <option value="">All status</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>
      <select
        value={type}
        onChange={handleTypeChange}
        className="text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-9"
      >
        <option value="">All types</option>
        <option value="deposit">Deposit</option>
        <option value="withdraw">Withdraw</option>
      </select>
    </div>
  );
}
