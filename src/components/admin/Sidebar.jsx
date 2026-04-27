'use client'
import Link from 'next/link';
import { HomeIcon, UserIcon, CogIcon, CurrencyDollarIcon, RefreshIcon, ArchiveIcon, CollectionIcon } from '@heroicons/react/outline';

import { useState } from 'react';

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className={`w-${collapsed ? '16' : '64'} bg-gray-800 text-white flex flex-col p-4 transition-width duration-300`}>
      <div className="text-xl font-bold mb-8">
        {collapsed ? (
          <span className="text-center">AP</span> // Abbreviation for "Admin Panel"
        ) : (
          'Admin Panel'
        )}
      </div>

      <ul className="space-y-4">
  <li>
    <Link href="/admin/stastics" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
      <HomeIcon className="h-6 w-6" />
      {!collapsed && <span>Dashboard</span>}
    </Link>
  </li>
  <li>
    <Link href="/admin/users" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
      <UserIcon className="h-6 w-6" />
      {!collapsed && <span>Users</span>}
    </Link>
  </li>
  {/* <li>
    <Link href="/admin/user-transactions" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
      <CurrencyDollarIcon className="h-6 w-6" />
      {!collapsed && <span>User Transactions</span>}
    </Link>
  </li> */}
  <li>
    <Link href="/admin/transactions" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
      <RefreshIcon className="h-6 w-6" />
      {!collapsed && <span>Transactions</span>}
    </Link>
  </li>
  <li>
    <Link href="/admin/gameList" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
      <ArchiveIcon className="h-6 w-6" />
      {!collapsed && <span>Games Archive</span>}
    </Link>
  </li>
  <li>
    <Link href="/admin" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
      <CollectionIcon className="h-6 w-6" />
      {!collapsed && <span>Games Management </span>}
    </Link>
  </li>
  <li>
    <Link href="/admin/PGTransactions" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
      <CogIcon className="h-6 w-6" />
      {!collapsed && <span> PG Transactions</span>}
    </Link>
  </li>
</ul>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute bottom-6 left-4 p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-all"
      >
        {collapsed ? '>' : '<'}
      </button>
    </div>
  );
};

export default Sidebar;
