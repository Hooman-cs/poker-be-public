import Link from 'next/link';
import type { DashboardData } from '@/types/adminTypes';

interface Props {
  users: DashboardData['recentUsers'];
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
      : status === 'suspended'
      ? 'bg-red-50 text-red-700 ring-1 ring-red-600/20'
      : 'bg-slate-100 text-slate-600';

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${classes}`}>
      {status}
    </span>
  );
}

export default function LatestPlayers({ users }: Props) {
  return (
    <Link href="/admin/users" className="block bg-white rounded-lg border border-slate-200 p-5 hover:border-indigo-300 transition-colors">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Latest Players</p>
      {users.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No users yet</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide pb-2">Username</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide pb-2">Status</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide pb-2">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.userId}>
                <td className="text-sm text-slate-900 py-2">{u.username}</td>
                <td className="py-2"><StatusBadge status={u.status} /></td>
                <td className="text-sm text-slate-900 py-2">
                  {new Date(u.createdAt).toLocaleDateString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Link>
  );
}
