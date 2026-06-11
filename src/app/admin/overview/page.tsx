import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Header from '@/components/admin/Header';
import UserStats from '@/components/admin/widgets/UserStats';
import GameStats from '@/components/admin/widgets/GameStats';
import BankStats from '@/components/admin/widgets/BankStats';
import GameUsage from '@/components/admin/widgets/GameUsage';
import BankTransactionOverview from '@/components/admin/widgets/BankTransactionOverview';
import LatestPlayers from '@/components/admin/widgets/LatestPlayers';
import LeaderBoard from '@/components/admin/widgets/LeaderBoard';
import type { DashboardData } from '@/types/adminTypes';

export const revalidate = 300;

async function getDashboard(): Promise<DashboardData> {
  const token = cookies().get('token')?.value ?? '';
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/admin/analytics/dashboard`, {
    headers: { Cookie: `token=${token}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) redirect('/auth/login');
  return res.json();
}

export default async function OverviewPage() {
  const data = await getDashboard();

  return (
    <>
      <Header title="Overview" />
      <div className="flex-1 p-6 space-y-6">
        <UserStats users={data.users} />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <GameStats games={data.games} />
            <BankStats bankTransactions={data.bankTransactions} />
          </div>
          <div className="space-y-6">
            <GameUsage games={data.games} />
            <BankTransactionOverview bankTransactions={data.bankTransactions} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <LatestPlayers users={data.recentUsers} />
          <LeaderBoard entries={data.leaderboard} />
        </div>
      </div>
    </>
  );
}
