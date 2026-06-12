import Link from 'next/link';
import type { DashboardData } from '@/types/adminTypes';

interface Props {
  entries: DashboardData['leaderboard'];
}

export default function LeaderBoard({ entries }: Props) {
  const top10 = entries.slice(0, 10);

  return (
    <Link href="/admin/statistics" className="block bg-white rounded-lg border border-slate-200 p-5 hover:border-indigo-300 transition-colors">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Leaderboard</p>
      {top10.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No games played yet</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {top10.map((entry, i) => {
            const isNegative =
              entry.totalWinnings.startsWith('₹-') || entry.totalWinnings.startsWith('-');
            return (
              <li key={entry.userId} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 w-6">{i + 1}</span>
                  <span className="text-sm text-slate-900">{entry.username}</span>
                </div>
                <span className={`font-medium ${isNegative ? 'text-red-500' : 'text-emerald-600'}`}>
                  {entry.totalWinnings}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Link>
  );
}
