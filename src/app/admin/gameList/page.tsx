'use client';

import { useEffect, useState } from "react";
import axios from "axios";

// -----------------------------------------------------------------------------
// Strict TypeScript Interfaces matching /api/admin/games/route.ts
// -----------------------------------------------------------------------------
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

export default function PokerGameArchiveAdminPanel() {
  const [data, setData] = useState<GameArchive[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Pagination & Filtering State
  const [pageNo, setPageNo] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [deskId, setDeskId] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("2021-01-01");
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [gameType, setGameType] = useState<string>("");
  
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Modal State
  const [selectedGame, setSelectedGame] = useState<GameArchive | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNo, itemsPerPage, deskId, username, startDate, endDate, sortBy, sortOrder, gameType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Construct dynamic query parameters
      const params = new URLSearchParams({
        page: pageNo.toString(),
        limit: itemsPerPage.toString(),
        ...(deskId && { deskId }),
        ...(username && { username }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(sortBy && { sortBy }),
        ...(sortOrder && { sortOrder }),
        ...(gameType && { gameType }),
      });

      const response = await axios.get(`/api/admin/games?${params.toString()}`);
      
      if (response.data.success) {
        setData(response.data.data);
        setTotalPages(response.data.totalPages);
        setTotalItems(response.data.totalItems);
      }
    } catch (error) {
      console.error("Error fetching poker game archives:", error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (game: GameArchive) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedGame(null);
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-7xl mx-auto mt-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Master Game Archives</h1>

      {/* Filters Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700">Desk ID</label>
          <input
            type="text"
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            value={deskId}
            onChange={(e) => setDeskId(e.target.value)}
            placeholder="Filter by Desk ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Username</label>
          <input
            type="text"
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Filter by Username"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <input
            type="date"
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Game Type</label>
          <select
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            value={gameType}
            onChange={(e) => setGameType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="NLH">NLH</option>
            <option value="PLO4">PLO4</option>
            <option value="PLO5">PLO5</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="text-center py-10 font-medium text-gray-500">Loading archives...</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Desk Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Type / Blinds</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Total Bet</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Players</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No game archives found matching your criteria.
                  </td>
                </tr>
              ) : (
                data.map((game) => (
                  <tr key={game.gameArchiveId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(game.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {game.deskName || game.tableId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="font-semibold text-blue-600">{game.gameType}</span> <br/> 
                      <span className="text-xs text-gray-400">Stack: {game.stack} | B: {game.bType}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                      ${game.totalBet.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {game.players.length} Users
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button 
                        onClick={() => openModal(game)}
                        className="text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded shadow-sm text-xs transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-gray-700">
          Showing total <span className="font-bold">{totalItems}</span> games
        </span>
        <div className="flex space-x-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            if (page === 1 || page === totalPages || (page >= pageNo - 1 && page <= pageNo + 1)) {
              return (
                <button
                  key={page}
                  onClick={() => setPageNo(page)}
                  className={`px-3 py-1 border rounded ${
                    page === pageNo ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {page}
                </button>
              );
            }
            if (page === pageNo - 2 || page === pageNo + 2) {
              return <span key={page} className="px-2 py-1">...</span>;
            }
            return null;
          })}
        </div>
      </div>

      {/* Game Details Modal */}
      {isModalOpen && selectedGame && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-800 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">Game Details</h2>
              <button onClick={closeModal} className="text-gray-300 hover:text-white text-2xl font-bold">&times;</button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <p><strong>Archive ID:</strong> <span className="font-mono text-gray-600">{selectedGame.gameArchiveId}</span></p>
                <p><strong>Desk ID:</strong> <span className="font-mono text-gray-600">{selectedGame.tableId}</span></p>
                <p><strong>Total Bet:</strong> <span className="text-green-600 font-bold">${selectedGame.totalBet}</span></p>
                <p><strong>Date:</strong> {new Date(selectedGame.createdAt).toLocaleString()}</p>
              </div>

              {/* Players Section */}
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Player Roster ({selectedGame.players.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {selectedGame.players.map((player, idx) => (
                  <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <p className="font-semibold text-gray-900">{player.username}</p>
                    <p className="text-xs text-gray-500">Bet: <span className="text-green-600">${player.totalBet}</span></p>
                    <p className="text-xs text-gray-500">Status: {player.status}</p>
                  </div>
                ))}
              </div>

              {/* Pots & Winners Section */}
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Pots & Winners</h3>
              {selectedGame.pots.length > 0 ? (
                <div className="space-y-3">
                  {selectedGame.pots.map((pot, pIdx) => (
                    <div key={pIdx} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="font-bold text-green-800 mb-2">Pot {pIdx + 1}</p>
                      <ul className="list-disc pl-5 text-sm text-green-900">
                        {pot.winners.map((winner, wIdx) => (
                          <li key={wIdx}>
                            <span className="font-semibold">{winner.username}</span> won <span className="font-bold">${winner.amount.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No pots or winners recorded for this game.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t flex justify-end">
              <button onClick={closeModal} className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-700">
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}