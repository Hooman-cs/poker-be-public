import Link from 'next/link';
import Header from '@/components/admin/Header';
import ModeCreateForm from '@/components/admin/poker/ModeCreateForm';
import ModeRowActions from '@/components/admin/poker/ModeRowActions';
import { fetchAdmin } from '@/lib/admin/fetchAdmin';

interface PokerGame {
  id: string;
  gameType: string;
  status: string;
  description: string | null;
}

interface PokerMode {
  id: string;
  pokerId: string;
  gameType: string;
  bType: 'blinds' | 'antes';
  stake: string;
  minBuyIn: string;
  maxBuyIn: string;
  currency: string;
  mode: 'cash' | 'practice';
  status: 'active' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}

function StatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
    disabled: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function ModeBadge(mode: string) {
  return mode === 'practice' ? (
    <span className="bg-purple-50 text-purple-700 ring-1 ring-purple-600/20 text-xs font-medium px-2 py-0.5 rounded-full">
      practice
    </span>
  ) : (
    <span className="bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 text-xs font-medium px-2 py-0.5 rounded-full">
      cash
    </span>
  );
}

export default async function PokerModePage({
  params,
}: {
  params: { pokerId: string };
}) {
  const { pokerId } = params;

  const [pokerData, modesData] = await Promise.all([
    fetchAdmin<{ games: PokerGame[] }>('/api/admin/poker'),
    fetchAdmin<{ modes: PokerMode[] }>('/api/admin/pokerModes', { pokerId }),
  ]);

  const poker = pokerData.games.find((g: PokerGame) => g.id === pokerId);
  const { modes } = modesData;

  return (
    <>
      <Header
        title={poker?.gameType ?? 'Poker modes'}
        subtitle={`${modes.length} mode${modes.length !== 1 ? 's' : ''}`}
      />
      <div className="p-6">
        <ModeCreateForm pokerId={pokerId} />
        <div className="bg-white rounded-lg border border-slate-200">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Stake (SB)</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Buy-in range</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Currency</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Desks</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {modes.map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">{ModeBadge(m.mode)}</td>
                  <td className="text-sm font-medium text-slate-900 px-4 py-3">{m.stake}</td>
                  <td className="text-sm text-slate-600 px-4 py-3">{m.minBuyIn} – {m.maxBuyIn}</td>
                  <td className="text-sm text-slate-500 px-4 py-3">{m.currency}</td>
                  <td className="px-4 py-3">{StatusBadge(m.status)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pokerDesk/${m.id}`}
                      className="text-xs text-indigo-500 hover:underline"
                    >
                      View desks →
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ModeRowActions id={m.id} currentStatus={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {modes.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No modes yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
