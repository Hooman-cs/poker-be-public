import Link from 'next/link';
import Header from '@/components/admin/Header';
import DeskCreateForm from '@/components/admin/poker/DeskCreateForm';
import DeskRowActions from '@/components/admin/poker/DeskRowActions';
import { fetchAdmin } from '@/lib/admin/fetchAdmin';

interface ModeShape {
  id: string;
  gameType: string;
  stake: string;
  mode: string;
}

interface DeskShape {
  id: string;
  pokerModeId: string;
  tableName: string;
  gameType: string;
  bType: string;
  mode: string;
  currency: string;
  status: 'active' | 'disabled' | 'closed';
  stake: string;
  minBuyIn: string;
  maxBuyIn: string;
  minToStart: number;
  minToContinue: number;
  maxPlayerCount: number;
  maxSeats: number;
  seatedCount: number;
  currentGameStatus: string;
  buttonSeatNumber: number | null;
  firstGameStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function StatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
    disabled: 'bg-slate-100 text-slate-600',
    closed: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export default async function PokerDeskPage({
  params,
}: {
  params: { pokerModeId: string };
}) {
  const { pokerModeId } = params;

  const [modesData, desksData] = await Promise.all([
    fetchAdmin<{ modes: ModeShape[] }>('/api/admin/pokerModes', { pokerId: '' }),
    fetchAdmin<{ desks: DeskShape[] }>('/api/admin/pokerDesks', { pokerModeId }),
  ]);

  const mode = modesData.modes.find((m) => m.id === pokerModeId);
  const { desks } = desksData;

  return (
    <>
      <Header
        title={mode ? `${mode.gameType} — ${mode.stake} stake` : 'Desks'}
        subtitle={`${desks.length} desk${desks.length !== 1 ? 's' : ''}`}
      />
      <div className="p-6">
        <DeskCreateForm pokerModeId={pokerModeId} />
        <div className="bg-white rounded-lg border border-slate-200">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Table name</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Seated</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Game</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Min / Max players</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {desks.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pokerDesk/details/${d.id}?modeId=${pokerModeId}`}
                      className="font-medium text-indigo-600 hover:underline text-sm"
                    >
                      {d.tableName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{StatusBadge(d.status)}</td>
                  <td className="text-sm text-slate-600 px-4 py-3">
                    {d.seatedCount} / {d.maxSeats}
                  </td>
                  <td className="text-sm text-slate-500 px-4 py-3">{d.currentGameStatus}</td>
                  <td className="text-sm text-slate-500 px-4 py-3">
                    {d.minToStart} – {d.maxPlayerCount}
                  </td>
                  <td className="px-4 py-3">
                    <DeskRowActions id={d.id} currentStatus={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {desks.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No desks yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
