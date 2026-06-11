'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart2,
  Users,
  ArrowLeftRight,
  CreditCard,
  Layers,
  List,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview',        href: '/admin/overview',        Icon: LayoutDashboard },
  { label: 'Statistics',      href: '/admin/statistics',      Icon: BarChart2 },
  { label: 'Users',           href: '/admin/users',           Icon: Users },
  { label: 'Transactions',    href: '/admin/transactions',    Icon: ArrowLeftRight },
  { label: 'PG Transactions', href: '/admin/pgTransactions',  Icon: CreditCard },
  { label: 'Poker',           href: '/admin/poker',           Icon: Layers },
  { label: 'Game List',       href: '/admin/gameList',        Icon: List },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 h-screen bg-slate-900 text-white flex flex-col sticky top-0 overflow-y-auto">
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="text-base font-bold text-white">Poker Admin</span>
      </div>

      <nav className="flex-1 py-4">
        {NAV_ITEMS.map(({ label, href, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 px-5 py-3 text-sm font-medium border-l-2 transition-colors',
                active
                  ? 'border-indigo-400 bg-white/[0.08] text-white'
                  : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white',
              ].join(' ')}
            >
              <Icon
                size={18}
                className={active ? 'text-indigo-400' : 'text-slate-500'}
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
