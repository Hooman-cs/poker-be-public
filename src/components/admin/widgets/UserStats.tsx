import type { DashboardData } from '@/types/adminTypes';

interface Props {
  users: DashboardData['users'];
}

export default function UserStats({ users }: Props) {
  const stats = [
    { label: 'Total Users',      value: users.total },
    { label: 'Active',           value: users.active },
    { label: 'New Today',        value: users.newToday },
    { label: 'New This Week',    value: users.newThisWeek },
    { label: 'New This Month',   value: users.newThisMonth },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {stats.map(({ label, value }) => (
        <div key={label} className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
        </div>
      ))}
    </div>
  );
}
