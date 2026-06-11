'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PgTransactionsFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setStatus(val);
    const sp = new URLSearchParams();
    sp.set('page', '1');
    if (val) sp.set('status', val);
    router.push(`/admin/pgTransactions?${sp.toString()}`);
  }

  return (
    <div className="flex gap-3 items-center px-4 py-3 border-b border-slate-200 bg-white">
      <select
        value={status}
        onChange={handleStatusChange}
        className="text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-9"
      >
        <option value="">All status</option>
        <option value="created">Created</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>
    </div>
  );
}
