import type { DashboardData } from '@/types/adminTypes';

interface Props {
  bankTransactions: DashboardData['bankTransactions'];
}

export default function BankStats({ bankTransactions }: Props) {
  const stats = [
    { label: 'Pending Deposits',     value: bankTransactions.pendingDeposits,    pending: true },
    { label: 'Pending Withdrawals',  value: bankTransactions.pendingWithdrawals, pending: true },
    { label: 'Completed Today',      value: bankTransactions.completedToday,     pending: false },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map(({ label, value, pending }) => (
        <div key={label} className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-semibold mt-1 ${pending && value > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
