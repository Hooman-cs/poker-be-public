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
  deskId: string;
  pokerModeId: string;
  gameType: string;
  currency: string;
  totalPot: string;
  playerCount: number;
  durationSeconds: number;
  startedAt: string;
  completedAt: string;
  players: GamePlayer[];
}

interface GamesData {
  games: GameEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const GAME_TYPES = ["", "Texas Hold'em", "Omaha"];

export default async function GameListPage({
  searchParams,
}: {
  searchParams: { page?: string; gameType?: string };
}) {
  const page = searchParams.page ?? '1';
  const gameType = searchParams.gameType ?? '';

  const params: Record<string, string> = { page, limit: '20' };
  if (gameType) params.gameType = gameType;

  const { games, pagination } = await fetchAdmin<GamesData>(
    '/api/admin/analytics/games',
    params
  );

  function paginationHref(p: number) {
    const sp = new URLSearchParams();
    sp.set('page', String(p));
    if (gameType) sp.set('gameType', gameType);
    return `/admin/gameList?${sp.toString()}`;
  }

  return (
    <>
      <Header
        title="Game list"
        subtitle={`${pagination.total} total`}
      />
      <div className="p-6">
        <div className="flex gap-2 mb-4">
          {GAME_TYPES.map((gt) => (
            <Link
              key={gt}
              href={`/admin/gameList?gameType=${encodeURIComponent(gt)}&page=1`}
              className={`text-sm px-3 py-1.5 rounded border transition-colors ${
                gameType === gt
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {gt || 'All'}
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-slate-200">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">ID</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Desk</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Pot</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Players</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Duration</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Winners</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    …{g.id.slice(-8)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    …{g.deskId.slice(-8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{g.gameType}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{g.totalPot}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{g.playerCount}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {Math.floor(g.durationSeconds / 60)}m {g.durationSeconds % 60}s
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(g.completedAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {g.players.filter((p) => p.isWinner).map((p) => p.username).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {games.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No games found.</p>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              {pagination.page > 1 && (
                <Link
                  href={paginationHref(pagination.page - 1)}
                  className="text-sm px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Previous
                </Link>
              )}
              {pagination.page < pagination.totalPages && (
                <Link
                  href={paginationHref(pagination.page + 1)}
                  className="text-sm px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
