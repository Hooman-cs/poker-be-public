import type { DashboardData } from '@/types/adminTypes';

interface Props {
  games: DashboardData['games'];
}

export default function GameStats({ games }: Props) {
  const stats = [
    { label: 'Total Archived',      value: games.totalArchived },
    { label: 'Active Desks Now',    value: games.activeDesksNow },
    { label: 'Total Active Desks',  value: games.totalActiveDesks },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map(({ label, value }) => (
        <div key={label} className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
        </div>
      ))}
    </div>
  );
}
