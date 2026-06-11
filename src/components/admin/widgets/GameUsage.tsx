import type { DashboardData } from '@/types/adminTypes';

interface Props {
  games: DashboardData['games'];
}

export default function GameUsage({ games }: Props) {
  const { activeDesksNow, totalActiveDesks } = games;
  const pct = totalActiveDesks > 0 ? (activeDesksNow / totalActiveDesks) * 100 : 0;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Desk Utilization</p>
      {totalActiveDesks === 0 ? (
        <p className="text-sm text-slate-500 mt-2">No active desks configured</p>
      ) : (
        <>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {activeDesksNow} of {totalActiveDesks} desks active
          </p>
          <div className="mt-3 bg-slate-100 rounded-full h-1.5">
            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
