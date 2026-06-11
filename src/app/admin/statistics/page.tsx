import Link from 'next/link';
import Header from '@/components/admin/Header';
import { fetchAdmin } from '@/lib/admin/fetchAdmin';

interface GamePlayer {
  userId: string;
  username: string;
  isWinner: boolean;
  netChange: string;
}

interface GameEntry {
  id: string;
  gameType: string;
  currency: string;
  totalPot: string;
  playerCount: number;
  durationSeconds: number;
  completedAt: Date;
  players: GamePlayer[];
}

interface GamesData {
  games: GameEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = searchParams.page ?? '1';
  const { games, pagination } = await fetchAdmin<GamesData>('/api/admin/analytics/games', {
    page,
    limit: '20',
  });

  return (
    <>
      <Header title="Statistics" />
      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Total games" value={String(pagination.total)} />
          <StatCard label="This page" value={String(games.length)} />
          <StatCard label="Page" value={`${pagination.page} of ${pagination.totalPages}`} />
        </div>

        <div className="bg-white rounded-lg border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Game ID</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Type</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Total pot</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Players</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Duration</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Completed</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Winners</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {games.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-400">...{g.id.slice(-8)}</span>
                  </td>
                  <td className="text-sm text-slate-600 px-4 py-3">{g.gameType}</td>
                  <td className="text-sm text-slate-900 px-4 py-3">{g.totalPot}</td>
                  <td className="text-sm text-slate-900 px-4 py-3">{g.playerCount}</td>
                  <td className="text-sm text-slate-900 px-4 py-3">
                    {`${Math.floor(g.durationSeconds / 60)}m ${g.durationSeconds % 60}s`}
                  </td>
                  <td className="text-sm text-slate-900 px-4 py-3">
                    {new Date(g.completedAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="text-sm text-slate-900 px-4 py-3">
                    {g.players.filter((p) => p.isWinner).map((p) => p.username).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-400">Showing {games.length} of {pagination.total}</span>
            <div className="flex gap-2">
              {pagination.page > 1 && (
                <Link
                  href={`/admin/statistics?page=${pagination.page - 1}`}
                  className="text-sm px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
                >
                  ← Prev
                </Link>
              )}
              {pagination.page < pagination.totalPages && (
                <Link
                  href={`/admin/statistics?page=${pagination.page + 1}`}
                  className="text-sm px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
