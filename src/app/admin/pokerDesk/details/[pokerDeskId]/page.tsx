'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

// -----------------------------------------------------------------------------
// TypeScript Interfaces
// -----------------------------------------------------------------------------
interface PokerDesk {
  _id: string;
  name?: string;
  status?: string;
  minBuyIn?: number;
  maxBuyIn?: number;
  createdAt?: string;
}

interface Player {
  username: string;
  totalBet: number;
  status: string;
}

interface Winner {
  username: string;
  amount: number;
}

interface Pot {
  winners: Winner[];
}

interface GameArchive {
  gameArchiveId: string;
  tableId: string;
  deskName: string;
  gameType: string;
  totalBet: number;
  stack: number;
  bType: string;
  createdAt: string;
  players: Player[];
  pots: Pot[];
}

export default function DeskDetailsPage() {
  const params = useParams<{ pokerDeskId: string }>();
  const deskId = params?.pokerDeskId;

  // State Management
  const [deskDetails, setDeskDetails] = useState<PokerDesk | null>(null);
  const [games, setGames] = useState<GameArchive[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State for Games
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalGames, setTotalGames] = useState<number>(0);
  const itemsPerPage = 10;

  const fetchDeskData = useCallback(async () => {
    if (!deskId) return;
    
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Desk Configuration
      const deskRes = await axios.get(`/api/admin/pokerDesks/${deskId}`);
      setDeskDetails(deskRes.data.data || deskRes.data);

      // 2. Fetch Paginated Game History for this specific Desk
      const gamesRes = await axios.get('/api/admin/games', {
        params: {
          deskId,
          page,
          limit: itemsPerPage,
        },
      });

      if (gamesRes.data.success) {
        setGames(gamesRes.data.data);
        setTotalPages(gamesRes.data.totalPages || 1);
        setTotalGames(gamesRes.data.totalItems || 0);
      }
    } catch (err: unknown) {
      console.error('Error fetching desk details:', err);
      setError('Failed to load desk data. The desk may have been deleted.');
    } finally {
      setLoading(false);
    }
  }, [deskId, page]);

  useEffect(() => {
    fetchDeskData();
  }, [fetchDeskData]);

  if (loading && !deskDetails) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh]">
        <div className="w-10 h-10 border-t-4 border-blue-600 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto mt-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 font-medium">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Desk Overview Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-800 text-white p-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{deskDetails?.name || `Desk ${deskId}`}</h2>
              <p className="text-gray-300 font-mono text-sm mt-1">ID: {deskId}</p>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${
                deskDetails?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
              }`}>
                {deskDetails?.status || 'UNKNOWN'}
              </span>
              {deskDetails?.createdAt && (
                <p className="text-gray-400 text-xs mt-2">
                  Created: {new Date(deskDetails.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 border-b border-gray-200">
             <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
               <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Min Buy-In</p>
               <p className="text-xl font-semibold text-gray-900">${deskDetails?.minBuyIn || '0'}</p>
             </div>
             <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
               <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Max Buy-In</p>
               <p className="text-xl font-semibold text-gray-900">${deskDetails?.maxBuyIn || '0'}</p>
             </div>
             <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
               <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Games Played</p>
               <p className="text-xl font-semibold text-blue-600">{totalGames}</p>
             </div>
             <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
               <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Current Page</p>
               <p className="text-xl font-semibold text-gray-900">{page} / {totalPages}</p>
             </div>
          </div>
        </div>

        {/* Game History Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Game History</h3>
          
          {loading ? (
            <div className="text-center py-10 text-gray-500">Refreshing data...</div>
          ) : games.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500">
              No games have been archived for this desk yet.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Game Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Total Bet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Players</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Top Winner</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {games.map((game) => {
                    // Extract highest winner for quick viewing
                    const allWinners = game.pots.flatMap(pot => pot.winners);
                    const topWinner = allWinners.sort((a, b) => b.amount - a.amount)[0];

                    return (
                      <tr key={game.gameArchiveId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(game.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {game.gameType} <span className="text-gray-400 text-xs ml-1">(B: {game.bType})</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                          ${game.totalBet.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {game.players.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {topWinner ? (
                            <span className="font-semibold text-gray-800">
                              {topWinner.username} <span className="text-green-600">(${topWinner.amount.toFixed(2)})</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">No Winners</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {games.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-gray-700">
                Page <span className="font-bold">{page}</span> of <span className="font-bold">{totalPages}</span>
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page === 1 || loading}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    page === 1 || loading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={page >= totalPages || loading}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    page >= totalPages || loading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}