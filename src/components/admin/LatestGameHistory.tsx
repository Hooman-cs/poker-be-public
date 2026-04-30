/**
 * @fileoverview Admin Dashboard - Latest Game History Component
 * Displays a sortable, paginated table of recent poker games with a detailed modal view.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { IGameHistory } from '@/utils/pokerModelTypes';

interface LatestGameHistoryProps {
  pokerModeId?: string;
  deskId?: string;
  username?: string;
}

type SortDirection = 'asc' | 'desc';
type SortColumn = keyof IGameHistory;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function LatestGameHistory({
  pokerModeId = '',
  deskId = '',
  username = '',
}: LatestGameHistoryProps): JSX.Element {
  // State Management
  const [games, setGames] = useState<IGameHistory[]>([]);
  const [pageNo, setPageNo] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortColumn>('gameType');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Modal State
  const [selectedGame, setSelectedGame] = useState<IGameHistory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // -----------------------------------------------------------------------------
  // Data Fetching
  // -----------------------------------------------------------------------------
  const fetchGameData = useCallback(async () => {
    setLoading(true);
    try {
      // Pointing to our modernized App Router endpoint
      const response = await axios.get('/api/admin/games', {
        params: {
          page: pageNo, // Mapped to new API standard
          limit: itemsPerPage,
          pokerModeId,
          deskId,
          search: username, // Mapped to new API standard 'search' param
        },
      });

      // Defensive Parsing: Handle various backend wrapper formats
      const rawData = response.data.formattedGames || response.data.games || response.data.data || [];
      
      const formattedData: IGameHistory[] = rawData.map((archive: any) => {
        const smallBlind = archive.bType === 'blinds' ? archive.stack : null;
        const bigBlind = archive.bType === 'blinds' ? archive.stack * 2 : null;

        return {
          tableId: archive.tableId || archive.deskId, // Fallback if deskId is used instead of tableId
          deskName: archive.deskName || `Desk ${archive.deskId}`,
          totalBet: archive.totalBet || archive.pot || 0,
          smallBlind,
          bigBlind,
          players: archive.players || [],
          pots: archive.pots || [],
          createdAt: archive.createdAt,
          gameType: archive.gameType || 'Unknown',
        };
      });

      setGames(formattedData);
      setTotalPages(response.data.totalPages || Math.ceil((response.data.totalBankTransactions || rawData.length) / itemsPerPage));
      setTotalItems(response.data.totalItems || response.data.totalBankTransactions || rawData.length);
    } catch (error) {
      console.error('[Fetch Game History Error]:', error);
    } finally {
      setLoading(false);
    }
  }, [pageNo, itemsPerPage, pokerModeId, deskId, username]);

  // Execute fetch when dependencies change
  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  // -----------------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------------
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPageNo(newPage);
    }
  };

  const handleSort = (column: SortColumn) => {
    const newDirection = sortBy === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortDirection(newDirection);

    const sortedGames = [...games].sort((a, b) => {
      const valA = a[column];
      const valB = b[column];
      
      if (valA === null) return 1;
      if (valB === null) return -1;
      if (valA < valB) return newDirection === 'asc' ? -1 : 1;
      if (valA > valB) return newDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setGames(sortedGames);
  };

  const openModal = (game: IGameHistory) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedGame(null);
  };

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 w-full">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Latest Game History</h2>
      </div>

      {/* Controls */}
      <div className="mb-4 flex items-center space-x-2">
        <label htmlFor="entries" className="text-sm font-medium text-gray-700">Show</label>
        <select
          id="entries"
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setPageNo(1); // Reset to first page on limit change
          }}
          className="border border-gray-300 rounded-md p-1.5 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
        <span className="text-sm text-gray-700">entries</span>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
            <tr>
              <th className="py-3 px-4 font-semibold">Desk Name</th>
              <th className="py-3 px-4 font-semibold">Total Bet</th>
              <th className="py-3 px-4 font-semibold">Small Blind</th>
              <th className="py-3 px-4 font-semibold">Big Blind</th>
              <th
                className="py-3 px-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('gameType')}
              >
                Game Type {sortBy === 'gameType' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="py-3 px-4 font-semibold">Created At</th>
              <th className="py-3 px-4 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500 animate-pulse">Loading games...</td>
              </tr>
            ) : games.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">No games found.</td>
              </tr>
            ) : (
              games.map((game, index) => (
                <tr key={`${game.tableId}-${index}`} className="hover:bg-blue-50/50 transition-colors bg-white">
                  <td className="py-3 px-4">{game.deskName}</td>
                  <td className="py-3 px-4 font-medium text-green-600">₹{game.totalBet.toLocaleString()}</td>
                  <td className="py-3 px-4">{game.smallBlind !== null ? `₹${game.smallBlind}` : 'N/A'}</td>
                  <td className="py-3 px-4">{game.bigBlind !== null ? `₹${game.bigBlind}` : 'N/A'}</td>
                  <td className="py-3 px-4">
                    <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {game.gameType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500">{new Date(game.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => openModal(game)}
                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 py-1.5 px-3 rounded text-xs font-medium transition-colors border border-blue-200"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600">
        <p className="mb-4 sm:mb-0">
          Showing {totalItems === 0 ? 0 : itemsPerPage * (pageNo - 1) + 1} to{' '}
          {Math.min(itemsPerPage * pageNo, totalItems)} of {totalItems} entries
        </p>
        <div className="flex items-center space-x-2">
          <button
            className={`px-3 py-1.5 border rounded-md transition-colors ${pageNo <= 1 ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}
            onClick={() => handlePageChange(pageNo - 1)}
            disabled={pageNo <= 1}
          >
            Previous
          </button>
          <span className="px-2 font-medium">Page {pageNo}</span>
          <button
            className={`px-3 py-1.5 border rounded-md transition-colors ${pageNo >= totalPages || totalItems === 0 ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}
            onClick={() => handlePageChange(pageNo + 1)}
            disabled={pageNo >= totalPages || totalItems === 0}
          >
            Next
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-4">
        <Link
          href="/admin/gameList"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
        >
          View All History
        </Link>
      </div>

      {/* Modal View (Upgraded to fixed layout with internal scrolling) */}
      {isModalOpen && selectedGame && (
        <div className="fixed inset-0 z-50 flex justify-center items-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Game Details: {selectedGame.deskName}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-red-500 transition-colors text-2xl leading-none">&times;</button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto">
              {/* Players Section */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 text-lg">Players ({selectedGame.players.length})</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="py-2 px-4 font-medium border-b">Username</th>
                        <th className="py-2 px-4 font-medium border-b">Total Bet</th>
                        <th className="py-2 px-4 font-medium border-b">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedGame.players.length === 0 ? (
                        <tr><td colSpan={3} className="py-3 px-4 text-center text-gray-500">No players found</td></tr>
                      ) : (
                        selectedGame.players.map((player, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="py-2 px-4 font-medium">{player.username}</td>
                            <td className="py-2 px-4 text-green-600">₹{player.totalBet}</td>
                            <td className="py-2 px-4">
                              <span className={`px-2 py-0.5 rounded text-xs ${player.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {player.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pots Section */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 text-lg">Pots</h3>
                {selectedGame.pots.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">No pots recorded for this game.</p>
                ) : (
                  <div className="space-y-4">
                    {selectedGame.pots.map((pot, idx) => (
                      <div key={idx} className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                        <h4 className="font-medium text-blue-800 mb-2">Pot {idx + 1}</h4>
                        <ul className="space-y-1.5">
                          {pot.winners.map((winner, winnerIdx) => (
                            <li key={winnerIdx} className="text-sm text-gray-700 flex items-center">
                              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                              <span className="font-medium text-gray-900">{winner.username}</span> 
                              <span className="mx-1 text-gray-500">won</span> 
                              <span className="font-bold text-green-600">₹{winner.amount}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
              {/* Upgraded to Next.js Link to prevent page reloads */}
              <Link
                href={`/tableDetails/${selectedGame.tableId}`}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
              >
                View Table Details
              </Link>
              <button
                onClick={closeModal}
                className="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}