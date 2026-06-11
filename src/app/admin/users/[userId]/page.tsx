import Header from '@/components/admin/Header';
import UserStatusControl from '@/components/admin/users/UserStatusControl';
import UserBalanceControl from '@/components/admin/users/UserBalanceControl';
import LatestGameHistory from '@/components/admin/widgets/LatestGameHistory';
import UserBankTransactionsHistory from '@/components/admin/widgets/UserBankTransactionsHistory';
import { fetchAdmin } from '@/lib/admin/fetchAdmin';
import type { UserGameEntry, UserBankTransaction, PaginationInfo } from '@/types/adminTypes';

interface BankEntry {
  bankId: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  accountHolderName: string;
  isDefault: boolean;
  status: 'active' | 'blocked' | 'inactive';
}

interface UserDetail {
  user: {
    userId: string;
    username: string;
    email: string;
    status: 'active' | 'inactive' | 'suspended';
    mobileNumber: string | null;
    lastLogin: Date | null;
    createdAt: Date;
  };
  wallet: {
    balance: string;
    instantBonus: string;
    lockedBonus: string;
    currency: string;
  } | null;
  banks: BankEntry[];
}

interface AnalyticsDetail {
  stats: {
    gamesPlayed: number;
    wins: number;
    winRate: string;
    totalNetChange: string;
    totalBet: string;
    currency: string;
  } | null;
  games: UserGameEntry[];
  pagination: PaginationInfo;
}

interface BankTxResponse {
  transactions: UserBankTransaction[];
  pagination: PaginationInfo;
}

function StatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
    inactive: 'bg-slate-100 text-slate-600',
    suspended: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
    blocked: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: { userId: string };
  searchParams: { gpage?: string; bpage?: string };
}) {
  const { userId } = params;
  const gpage = searchParams.gpage ?? '1';
  const bpage = searchParams.bpage ?? '1';

  const [userData, analyticsData, bankTxData] = await Promise.all([
    fetchAdmin<UserDetail>(`/api/admin/users/${userId}`),
    fetchAdmin<AnalyticsDetail>(`/api/admin/analytics/users/${userId}`, { page: gpage, limit: '10' }),
    fetchAdmin<BankTxResponse>('/api/admin/bankTransactions', { userId, page: bpage, limit: '10' }),
  ]);

  return (
    <>
      <Header title={userData.user.username} subtitle="User detail" />
      <div className="p-6 space-y-6">

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-lg border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{userData.user.username}</h2>
              {StatusBadge(userData.user.status)}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-slate-900">{userData.user.email}</dd>
              <dt className="text-slate-500">Mobile</dt>
              <dd className="text-slate-900">{userData.user.mobileNumber ?? '—'}</dd>
              <dt className="text-slate-500">Last login</dt>
              <dd className="text-slate-900">
                {userData.user.lastLogin
                  ? new Date(userData.user.lastLogin).toLocaleString('en-IN')
                  : '—'}
              </dd>
              <dt className="text-slate-500">Joined</dt>
              <dd className="text-slate-900">
                {new Date(userData.user.createdAt).toLocaleDateString('en-IN')}
              </dd>
            </dl>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Wallet</p>
              {userData.wallet ? (
                <>
                  <p className="text-sm text-slate-600">Balance: <span className="font-medium text-slate-900">{userData.wallet.balance}</span></p>
                  <p className="text-sm text-slate-600">Instant bonus: <span className="font-medium">{userData.wallet.instantBonus}</span></p>
                  <p className="text-sm text-slate-600">Locked bonus: <span className="font-medium">{userData.wallet.lockedBonus}</span></p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No wallet</p>
              )}
            </div>
            <UserStatusControl userId={userId} currentStatus={userData.user.status} />
            {userData.wallet && (
              <UserBalanceControl userId={userId} lockedBonus={userData.wallet.lockedBonus} />
            )}
          </div>
        </div>

        {analyticsData.stats && (
          <div className="grid grid-cols-5 gap-4">
            {[
              ['Games played', String(analyticsData.stats.gamesPlayed)],
              ['Wins', String(analyticsData.stats.wins)],
              ['Win rate', analyticsData.stats.winRate],
              ['Net change', analyticsData.stats.totalNetChange],
              ['Total bet', analyticsData.stats.totalBet],
            ].map(([label, value]) => (
              <div key={label} className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                <p className={`text-xl font-semibold mt-1 ${
                  label === 'Net change' && (value.startsWith('₹-') || value.startsWith('-'))
                    ? 'text-red-500' : 'text-slate-900'
                }`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        <LatestGameHistory games={analyticsData.games} pagination={analyticsData.pagination} />

        <UserBankTransactionsHistory
          transactions={bankTxData.transactions}
          pagination={bankTxData.pagination}
        />

        {userData.banks.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-medium text-slate-700">Bank accounts</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {userData.banks.map((b) => (
                <div key={b.bankId} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-slate-900">{b.bankName}</span>
                    <span className="text-slate-500 ml-3">{b.accountNumber}</span>
                    {b.isDefault && <span className="ml-2 text-xs text-indigo-600">Default</span>}
                  </div>
                  {StatusBadge(b.status)}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
