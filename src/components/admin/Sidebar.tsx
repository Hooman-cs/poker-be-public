/**
 * @fileoverview Admin Dashboard Sidebar Component
 * Collapsible navigation menu for the admin layout.
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  HomeIcon, 
  UserIcon, 
  Cog6ToothIcon as CogIcon, 
  ArrowPathIcon as RefreshIcon, 
  ArchiveBoxIcon as ArchiveIcon, 
  RectangleStackIcon as CollectionIcon 
} from '@heroicons/react/24/outline';

export default function Sidebar(): JSX.Element {
  // TypeScript automatically infers this as boolean
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside 
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-gray-800 text-white flex flex-col p-4 transition-all duration-300 relative min-h-screen`}
    >
      {/* Branding / Logo Area */}
      <div className="text-xl font-bold mb-8 flex items-center justify-center h-8">
        {collapsed ? (
          <span className="text-center tracking-widest">AP</span>
        ) : (
          <span className="whitespace-nowrap">Admin Panel</span>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1">
        <ul className="space-y-4">
          <li>
            <Link href="/admin/stastics" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded transition-colors group">
              <HomeIcon className="h-6 w-6 flex-shrink-0 text-gray-300 group-hover:text-white" />
              {!collapsed && <span className="whitespace-nowrap">Dashboard</span>}
            </Link>
          </li>
          <li>
            <Link href="/admin/users" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded transition-colors group">
              <UserIcon className="h-6 w-6 flex-shrink-0 text-gray-300 group-hover:text-white" />
              {!collapsed && <span className="whitespace-nowrap">Users</span>}
            </Link>
          </li>
          <li>
            <Link href="/admin/transactions" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded transition-colors group">
              <RefreshIcon className="h-6 w-6 flex-shrink-0 text-gray-300 group-hover:text-white" />
              {!collapsed && <span className="whitespace-nowrap">Transactions</span>}
            </Link>
          </li>
          <li>
            <Link href="/admin/gameList" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded transition-colors group">
              <ArchiveIcon className="h-6 w-6 flex-shrink-0 text-gray-300 group-hover:text-white" />
              {!collapsed && <span className="whitespace-nowrap">Games Archive</span>}
            </Link>
          </li>
          <li>
            <Link href="/admin" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded transition-colors group">
              <CollectionIcon className="h-6 w-6 flex-shrink-0 text-gray-300 group-hover:text-white" />
              {!collapsed && <span className="whitespace-nowrap">Games Management</span>}
            </Link>
          </li>
          <li>
            <Link href="/admin/PGTransactions" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded transition-colors group">
              <CogIcon className="h-6 w-6 flex-shrink-0 text-gray-300 group-hover:text-white" />
              {!collapsed && <span className="whitespace-nowrap">PG Transactions</span>}
            </Link>
          </li>
        </ul>
      </nav>

      {/* Toggle Button */}
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => setCollapsed(!collapsed)}
        className="absolute bottom-6 -right-4 p-1.5 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors border-2 border-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 z-10"
      >
        <svg 
          className={`w-5 h-5 text-white transform transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  );
}