import type { UserBankTransaction, PaginationInfo } from '@/types/adminTypes';

interface Props {
  transactions: UserBankTransaction[];
  pagination: PaginationInfo;
}

function TypeBadge({ type }: { type: 'deposit' | 'withdraw' }) {
  const classes =
    type === 'deposit'
      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${classes}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: 'pending' | 'completed' | 'failed' }) {
  const classes =
    status === 'completed'
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
      : status === 'failed'
      ? 'bg-red-50 text-red-700 ring-1 ring-red-600/20'
      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${classes}`}>
      {status}
    </span>
  );
}

export default function UserBankTransactionsHistory({ transactions, pagination }: Props) {
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-200">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bank Transactions</p>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No transactions yet</p>
      ) : (
        <>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">ID</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Bank</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <tr key={t.transactionId}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-400">
                      ...{t.transactionId.slice(-8)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={t.type} />
                  </td>
                  <td className="text-sm text-slate-900 px-4 py-3">{t.amount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="text-sm text-slate-500 px-4 py-3">
                    {t.bankAccount ? t.bankAccount.bankName : '—'}
                  </td>
                  <td className="text-sm text-slate-900 px-4 py-3">
                    {new Date(t.createdAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Showing {transactions.length} of {pagination.total} transactions
            </p>
          </div>
        </>
      )}
    </div>
  );
}
