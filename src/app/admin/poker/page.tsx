import Link from 'next/link';
import Header from '@/components/admin/Header';
import PokerCreateForm from '@/components/admin/poker/PokerCreateForm';
import PokerRowActions from '@/components/admin/poker/PokerRowActions';
import { fetchAdmin } from '@/lib/admin/fetchAdmin';

interface PokerGame {
  id: string;
  gameType: string;
  description: string | null;
  objective: string | null;
  status: 'active' | 'maintenance' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}

function StatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
    maintenance: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
    disabled: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export default async function PokerPage() {
  const { games } = await fetchAdmin<{ games: PokerGame[] }>('/api/admin/poker');

  return (
    <>
      <Header title="Poker management" />
      <div className="p-6">
        <PokerCreateForm />
        <div className="bg-white rounded-lg border border-slate-200">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Game type</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Description</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Modes</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pokerMode/${g.id}`}
                      className="font-medium text-indigo-600 hover:underline text-sm"
                    >
                      {g.gameType}
                    </Link>
                  </td>
                  <td className="text-sm text-slate-500 px-4 py-3">{g.description ?? '—'}</td>
                  <td className="px-4 py-3">{StatusBadge(g.status)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pokerMode/${g.id}`}
                      className="text-xs text-indigo-500 hover:underline"
                    >
                      View modes →
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <PokerRowActions id={g.id} currentStatus={g.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {games.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No game types yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
