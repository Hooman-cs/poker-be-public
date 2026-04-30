/**
 * @fileoverview Admin Dashboard - Latest Players Component
 * Displays a grid of recently registered users.
 */

import React from 'react';
import Link from 'next/link';

// 1. Strict Prop Definitions
export interface ILatestPlayer {
  username: string;
  registrationDate: string | Date;
}

interface LatestPlayersProps {
  players: ILatestPlayer[];
}

export default function LatestPlayers({ players }: LatestPlayersProps): JSX.Element {
  
  // Utility function to safely format dates
  const formatDate = (date: string | Date): string => {
    try {
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
      return new Date(date).toLocaleDateString('en-US', options);
    } catch {
      return 'Unknown Date';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      
      {/* Header section with dynamic count */}
      <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Latest Players</h2>
        <span className="bg-blue-100 text-blue-700 px-3 py-1 text-xs font-semibold rounded-full">
          {players.length} New Players
        </span>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {players.map((player, index) => (
          <div key={index} className="flex flex-col items-center p-2 hover:bg-gray-50 rounded-lg transition-colors">
            {/* Standardized Avatar Icon */}
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25a2.25 2.25 0 00-2.25-2.25H10.5a2.25 2.25 0 00-2.25 2.25V9M9 15.75V12.75a3 3 0 113 0v3M12 17.25a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800 mt-3 truncate w-full text-center" title={player.username}>
              {player.username}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatDate(player.registrationDate)}
            </p>
          </div>
        ))}
      </div>

      {/* Call to Action */}
      <div className="mt-6 text-center">
        <Link
          href="/admin/users"
          className="text-blue-600 font-medium text-sm hover:text-blue-800 hover:underline transition-colors"
        >
          View All Users
        </Link>
      </div>
    </div>
  );
}