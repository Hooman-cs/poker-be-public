import Link from 'next/link';
import type { DashboardData } from '@/types/adminTypes';

interface Props {
  bankTransactions: DashboardData['bankTransactions'];
}

export default function BankTransactionOverview({ bankTransactions }: Props) {
  const rows = [
    { label: 'Deposits pending',    count: bankTransactions.pendingDeposits,    amber: true },
    { label: 'Withdrawals pending', count: bankTransactions.pendingWithdrawals, amber: true },
    { label: 'Settled today',       count: bankTransactions.completedToday,     amber: false },
  ];

  return (
    <Link href="/admin/transactions" className="block bg-white rounded-lg border border-slate-200 p-5 hover:border-indigo-300 transition-colors">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Bank Transactions</p>
      <ul className="divide-y divide-slate-100">
        {rows.map(({ label, count, amber }) => (
          <li key={label} className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-900">{label}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              amber && count > 0
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
            }`}>
              {count}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
