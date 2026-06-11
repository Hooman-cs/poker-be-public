import Link from 'next/link';
import Header from '@/components/admin/Header';
import UsersFilters from '@/components/admin/UsersFilters';
import { fetchAdmin } from '@/lib/admin/fetchAdmin';

interface UserEntry {
  userId: string;
  username: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  mobileNumber: string | null;
  createdAt: Date;
  wallet: {
    balance: string;
    instantBonus: string;
    lockedBonus: string;
    currency: string;
  } | null;
}

interface UsersData {
  users: UserEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
    inactive: 'bg-slate-100 text-slate-600',
    suspended: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; status?: string };
}) {
  const page = searchParams.page ?? '1';
  const search = searchParams.search ?? '';
  const status = searchParams.status ?? '';

  const { users, pagination } = await fetchAdmin<UsersData>('/api/admin/users', {
    page,
    limit: '20',
    search,
    status,
  });

  function paginationHref(p: number) {
    const sp = new URLSearchParams();
    sp.set('page', String(p));
    if (search) sp.set('search', search);
    if (status) sp.set('status', status);
    return `/admin/users?${sp.toString()}`;
  }

  return (
    <>
      <Header title="Users" subtitle={`${pagination.total} total`} />
      <div className="p-6">
        <div className="bg-white rounded-lg border border-slate-200">
          <UsersFilters />
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Username</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Email</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Balance</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-200">Joined</th>
                <th className="px-4 py-3 border-b border-slate-200"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.userId}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${u.userId}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {u.username}
                    </Link>
                  </td>
                  <td className="text-slate-500 text-sm px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="text-sm text-slate-900 px-4 py-3">{u.wallet?.balance ?? '—'}</td>
                  <td className="text-sm text-slate-900 px-4 py-3">
                    {new Date(u.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/users/${u.userId}`} className="text-slate-400 hover:text-slate-600">
                      →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-400">Showing {users.length} of {pagination.total}</span>
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
