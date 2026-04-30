/**
 * @fileoverview Admin Dashboard - Poker Game Statistics Component
 * Displays aggregated data regarding active games, finished games, and total platform bets.
 */

import React from "react";
import { ClockIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

// 1. Strict Prop Definitions
export interface IPokerGameStats {
  totalActivePokerGames: number;
  totalFinishedGames: number;
  totalPotInFinishedGames: number;
  // Array of any type of player object, we just need the length here
  topPlayersByTotalBet: unknown[]; 
  mostPlayedPokerDesk: string | number;
}

interface GameStatsProps {
  pokerGameStats: IPokerGameStats;
}

export default function GameStats({ pokerGameStats }: GameStatsProps): JSX.Element {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <ClockIcon className="h-8 w-8 text-purple-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Poker Game Stats
          </h2>
          <p className="text-sm text-gray-500">
            Active Poker Games: <span className="font-medium text-gray-700">{pokerGameStats.totalActivePokerGames}</span>
          </p>
        </div>
      </div>

      {/* Stats List */}
      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Finished Poker Games:</span>
          <span className="font-medium text-gray-800">{pokerGameStats.totalFinishedGames}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Pot in Finished Games:</span>
          <span className="font-medium text-green-600">₹{pokerGameStats.totalPotInFinishedGames}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Top Players by Total Bet:</span>
          <span className="font-medium text-gray-800">{pokerGameStats.topPlayersByTotalBet.length}</span>
        </div>

        {/* Dynamic Link to Most Played Desk */}
        <div className="flex justify-center mt-6">
          <Link 
            href={`/admin/pokerdesk/${pokerGameStats.mostPlayedPokerDesk}`}
            className="text-blue-600 text-sm font-semibold hover:text-blue-800 hover:underline transition-colors"
          >
            {`View Most Played Desk: ${pokerGameStats.mostPlayedPokerDesk}`}
          </Link>
        </div>
      </div>

      {/* Call to Action */}
      <div className="mt-6 text-center">
        <Link 
          href="/admin/gameList"
          className="inline-block text-base font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-600 hover:from-pink-600 hover:to-purple-500 py-3 px-6 rounded-full transition-all transform hover:scale-105 shadow-md hover:shadow-lg"
        >
          Go to Games Archive
        </Link>
      </div>
    </div>
  );
}