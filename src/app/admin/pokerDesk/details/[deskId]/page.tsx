import Link from 'next/link';
import Header from '@/components/admin/Header';
import { fetchAdmin } from '@/lib/admin/fetchAdmin';

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

export default async function DeskDetailPage({
  params,
  searchParams,
}: {
  params: { deskId: string };
  searchParams: { modeId?: string };
}) {
  const { deskId } = params;
  const { modeId } = searchParams;

  const { desks } = await fetchAdmin<{ desks: DeskShape[] }>('/api/admin/pokerDesks');
  const desk = desks.find((d) => d.id === deskId);

  if (!desk) {
    return (
      <>
        <Header title="Desk not found" />
        <div className="p-6">
          {modeId && (
            <Link href={`/admin/pokerDesk/${modeId}`} className="text-sm text-indigo-600 hover:underline">
              ← Back to desks
            </Link>
          )}
          <p className="mt-4 text-sm text-slate-500">No desk with id {deskId}.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={desk.tableName} subtitle="Desk detail" />
      <div className="p-6 space-y-6">
        {modeId && (
          <Link href={`/admin/pokerDesk/${modeId}`} className="text-sm text-indigo-600 hover:underline">
            ← Back to desks
          </Link>
        )}

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Configuration</h2>
          <dl className="grid grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <dt className="text-slate-500">Game type</dt>
            <dd className="col-span-2 text-slate-900">{desk.gameType}</dd>

            <dt className="text-slate-500">Mode</dt>
            <dd className="col-span-2">{ModeBadge(desk.mode)}</dd>

            <dt className="text-slate-500">Status</dt>
            <dd className="col-span-2">{StatusBadge(desk.status)}</dd>

            <dt className="text-slate-500">Stake (SB)</dt>
            <dd className="col-span-2 text-slate-900">{desk.stake}</dd>

            <dt className="text-slate-500">Buy-in range</dt>
            <dd className="col-span-2 text-slate-900">{desk.minBuyIn} – {desk.maxBuyIn}</dd>

            <dt className="text-slate-500">Min to start</dt>
            <dd className="col-span-2 text-slate-900">{desk.minToStart}</dd>

            <dt className="text-slate-500">Min to continue</dt>
            <dd className="col-span-2 text-slate-900">{desk.minToContinue}</dd>

            <dt className="text-slate-500">Max players</dt>
            <dd className="col-span-2 text-slate-900">{desk.maxSeats}</dd>

            <dt className="text-slate-500">Currency</dt>
            <dd className="col-span-2 text-slate-900">{desk.currency}</dd>
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Live status</h2>
          <dl className="grid grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <dt className="text-slate-500">Seated</dt>
            <dd className="col-span-2 text-slate-900">{desk.seatedCount} / {desk.maxSeats}</dd>

            <dt className="text-slate-500">Current game</dt>
            <dd className="col-span-2 text-slate-900">{desk.currentGameStatus}</dd>

            <dt className="text-slate-500">First hand at</dt>
            <dd className="col-span-2 text-slate-900">
              {desk.firstGameStartedAt
                ? new Date(desk.firstGameStartedAt).toLocaleString('en-IN')
                : '—'}
            </dd>

            <dt className="text-slate-500">Created</dt>
            <dd className="col-span-2 text-slate-900">
              {new Date(desk.createdAt).toLocaleDateString('en-IN')}
            </dd>
          </dl>
        </div>
      </div>
    </>
  );
}
