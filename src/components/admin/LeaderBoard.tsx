/**
 * @fileoverview Admin Dashboard - LeaderBoard Component
 * Displays a list of the top active players ranked by their total bet amount.
 */

import React from 'react';
import Link from 'next/link';

// 1. Strict Prop Definitions
export interface ILeaderBoardPlayer {
  username: string;
  totalBet: number;
}

interface LeaderBoardProps {
  topPlayers: ILeaderBoardPlayer[];
}

export default function LeaderBoard({ topPlayers }: LeaderBoardProps): JSX.Element {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 w-full max-w-sm h-full flex flex-col">
      
      {/* Header */}
      <div className="border-b border-gray-100 pb-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Top Players</h3>
      </div>
      
      {/* Player List */}
      <ul className="space-y-3 flex-grow">
        {topPlayers.map((player, index) => (
          <li
            key={index}
            className="flex items-center space-x-4 border border-gray-100 rounded-lg p-3 hover:shadow-md hover:border-blue-100 transition-all bg-gray-50 hover:bg-white"
          >
            {/* Rank / Avatar Placeholder */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-bold flex items-center justify-center border border-blue-300">
              #{index + 1}
            </div>
            
            {/* Player Info */}
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-800 truncate" title={player.username}>
                {player.username}
              </span>
              <span className="block text-xs font-medium text-green-600 mt-0.5">
                ₹{player.totalBet.toLocaleString()} Chips
              </span>
            </div>
          </li>
        ))}
        
        {/* Empty State Fallback */}
        {topPlayers.length === 0 && (
          <li className="text-center text-sm text-gray-500 py-4">
            No top players found.
          </li>
        )}
      </ul>

      {/* Modernized Call to Action */}
      <div className="mt-6 text-center border-t border-gray-100 pt-4">
        <Link
          href="/admin/users"
          className="text-blue-600 text-sm font-semibold hover:text-blue-800 hover:underline transition-colors"
        >
          View All Players
        </Link>
      </div>
    </div>
  );
}