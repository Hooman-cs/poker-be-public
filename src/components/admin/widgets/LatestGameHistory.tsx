import type { UserGameEntry, PaginationInfo } from '@/types/adminTypes';

interface Props {
  games: UserGameEntry[];
  pagination: PaginationInfo;
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function LatestGameHistory({ games, pagination }: Props) {
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-200">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Game History</p>
      </div>

      {games.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No games played yet</p>
      ) : (
        <>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Game Type</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Result</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Net Change</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Total Pot</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Duration</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {games.map((g) => {
                const isNegative = g.netChange.startsWith('₹-') || g.netChange.startsWith('-');
                return (
                  <tr key={g.id}>
                    <td className="text-sm text-slate-900 px-4 py-3">{g.gameType}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        g.isWinner
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {g.isWinner ? 'Won' : 'Lost'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${isNegative ? 'text-red-500' : 'text-emerald-600'}`}>
                      {g.netChange}
                    </td>
                    <td className="text-sm text-slate-900 px-4 py-3">{g.totalPot}</td>
                    <td className="text-sm text-slate-900 px-4 py-3">{formatDuration(g.durationSeconds)}</td>
                    <td className="text-sm text-slate-900 px-4 py-3">
                      {new Date(g.completedAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Showing {games.length} of {pagination.total} games
            </p>
          </div>
        </>
      )}
    </div>
  );
}
