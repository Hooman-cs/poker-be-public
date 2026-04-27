import React from "react";
import { ClockIcon } from "@heroicons/react/outline"; // Importing the ClockIcon from Heroicons
import Link from "next/link"; // Importing the Link component from Next.js

const PokerGameStats = ({ pokerGameStats }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center space-x-4">
        <ClockIcon className="h-8 w-8 text-purple-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Poker Game Stats
          </h2>
          <p className="text-sm text-gray-500">
            Active Poker Games: {pokerGameStats.totalActivePokerGames}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Finished Poker Games:</span>
          <span>{pokerGameStats.totalFinishedGames}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Pot in Finished Games:</span>
          <span>{pokerGameStats.totalPotInFinishedGames}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Top Players by Total Bet:</span>
          <span>{pokerGameStats.topPlayersByTotalBet.length}</span>
        </div>

        <div className="flex justify-center mt-4">
          <Link href={`/admin/pokerdesk/${pokerGameStats.mostPlayedPokerDesk}`}>
            <span className="text-blue-600 text-lg font-semibold hover:underline">
              {`Most Played Poker Desk: ${pokerGameStats.mostPlayedPokerDesk}`}
            </span>
          </Link>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link href="/admin/gameList">
          <span className="text-lg font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-600 hover:from-pink-600 hover:to-purple-500 py-3 px-6 rounded-full cursor-pointer transition-all transform hover:scale-105 shadow-lg hover:shadow-xl">
            Go to Games
          </span>
        </Link>
      </div>
    </div>
  );
};

export default PokerGameStats;
