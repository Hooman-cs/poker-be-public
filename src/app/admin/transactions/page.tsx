import Link from 'next/link';
import Header from '@/components/admin/Header';
import TransactionsFilters from '@/components/admin/transactions/TransactionsFilters';
import BankTransactionActions from '@/components/admin/transactions/BankTransactionActions';
import { fetchAdmin } from '@/lib/admin/fetchAdmin';

interface BankAccount {
  bankId: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  accountHolderName: string;
  isDefault: boolean;
  status: string;
}

interface BankTx {
  transactionId: string;
  userId: string;
  type: 'deposit' | 'withdraw';
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  imageUrl: string | null;
  remark: string | null;
  completedAt: Date | null;
  createdAt: Date;
  bankAccount: BankAccount | null;
}

interface TxData {
  transactions: BankTx[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function TypeBadge({ type }: { type: 'deposit' | 'withdraw' }) {
  const cls =
    type === 'deposit'
      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{type}</span>
  );
}

function StatusBadge({ status }: { status: 'pending' | 'completed' | 'failed' }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
    completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
    failed: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; type?: string };
}) {
  const page = searchParams.page ?? '1';
  const status = searchParams.status ?? '';
  const type = searchParams.type ?? '';

  const { transactions, pagination } = await fetchAdmin<TxData>('/api/admin/bankTransactions', {
    page,
    limit: '20',
    status,
    type,
  });

  function paginationHref(p: number) {
    const sp = new URLSearchParams();
    sp.set('page', String(p));
    if (status) sp.set('status', status);
    if (type) sp.set('type', type);
    return `/admin/transactions?${sp.toString()}`;
  }

  return (
    <>
      <Header title="Bank transactions" subtitle={`${pagination.total} total`} />
      <div className="p-6">
        <div className="bg-white rounded-lg border border-slate-200">
          <TransactionsFilters />
          <table className="w-full border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">ID</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">User</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Type</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Amount</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Bank</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Date</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr key={tx.transactionId}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-400">...{tx.transactionId.slice(-8)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${tx.userId}`}
                      className="text-indigo-600 hover:underline text-sm"
                    >
                      {tx.userId.slice(-8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={tx.type} />
                  </td>
                  <td className="text-sm font-medium text-slate-900 px-4 py-3">{tx.amount}</td>
                  <td className="text-sm text-slate-500 px-4 py-3">{tx.bankAccount?.bankName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="text-sm text-slate-900 px-4 py-3">
                    {new Date(tx.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <BankTransactionActions transactionId={tx.transactionId} currentStatus={tx.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-400">Showing {transactions.length} of {pagination.total}</span>
            <div className="flex gap-2">
              {pagination.page > 1 && (
                <Link
                  href={paginationHref(pagination.page - 1)}
                  className="text-sm px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
                >
                  ← Prev
                </Link>
              )}
              {pagination.page < pagination.totalPages && (
                <Link
                  href={paginationHref(pagination.page + 1)}
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
