import Link from 'next/link';
import Header from '@/components/admin/Header';
import TrendChart from '@/components/admin/widgets/TrendChart';
import { fetchAdmin } from '@/lib/admin/fetchAdmin';
import { toMajor, DEFAULT_CURRENCY } from '@/config/constants';
import type { StatisticsData } from '@/types/adminTypes';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

export default async function StatisticsPage() {
  const data = await fetchAdmin<StatisticsData>('/api/admin/analytics/statistics');

  const labels = data.dailySignups.map((d) => d.date.slice(5));
  const signupsSeries = data.dailySignups.map((d) => d.count);
  const cashGamesSeries = data.dailyCashGames.map((d) => d.count);
  const depositSeries = data.dailyDepositVolume.map((d) => toMajor(d.amount, DEFAULT_CURRENCY));

  return (
    <>
      <Header title="Statistics" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="New signups (30d)" value={String(data.totals.signups30d)} />
          <StatCard label="Cash games played (30d)" value={String(data.totals.cashGames30d)} />
          <StatCard label="Deposit volume (30d)" value={data.totals.depositVolume30d} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <TrendChart title="Daily new signups" labels={labels} data={signupsSeries} type="line" />
          <TrendChart
            title="Daily cash games played"
            labels={labels}
            data={cashGamesSeries}
            type="line"
            borderColor="rgb(16, 185, 129)"
            backgroundColor="rgba(16, 185, 129, 0.5)"
          />
          <TrendChart
            title="Daily deposit volume"
            labels={labels}
            data={depositSeries}
            type="bar"
            borderColor="rgb(245, 158, 11)"
            backgroundColor="rgba(245, 158, 11, 0.5)"
          />
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Leaderboard (top 20, all-time)</p>
            <Link href="/admin/gameList" className="text-sm text-indigo-600 hover:underline">View raw game records &rarr;</Link>
          </div>
          {data.leaderboard.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No games played yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide pb-2">#</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide pb-2">Username</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide pb-2">Total winnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leaderboard.map((entry, i) => {
                  const isNegative = entry.totalWinnings.includes('-');
                  return (
                    <tr key={entry.userId}>
                      <td className="text-sm text-slate-400 py-2">{i + 1}</td>
                      <td className="text-sm text-slate-900 py-2">{entry.username}</td>
                      <td className={`text-sm text-right py-2 font-medium ${isNegative ? 'text-red-500' : 'text-emerald-600'}`}>
                        {entry.totalWinnings}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
