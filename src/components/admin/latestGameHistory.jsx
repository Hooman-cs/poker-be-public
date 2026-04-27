import React, { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";

const LatestGameHistory = ({
  pokerModeId = "",
  deskId = "",
  username = "",
}) => {
  const [games, setGames] = useState([]);
  const [pageNo, setPageNo] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState("gameType"); // default sorting by game type
  const [sortDirection, setSortDirection] = useState("asc"); // default sort direction (ascending)
  const [selectedGame, setSelectedGame] = useState(null); // For modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (game) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedGame(null);
  };

  const fetchGameData = async () => {
    setGames([]);
    try {
      const response = await axios.get("/api/admin/auth/getGamesList", {
        params: {
          pageNo,
          itemsPerPage,
          pokerModeId,
          deskId,
          username,
        },
      });
      const formattedData = response.data.data.map((archive) => {
        const smallBlind = archive.bType === "blinds" ? archive.stack : null;
        const bigBlind = archive.bType === "blinds" ? archive.stack * 2 : null;

        return {
          tableId: archive.tableId,
          deskName: archive.deskName,
          totalBet: archive.totalBet,
          smallBlind,
          players: archive.players,
          pots: archive.pots,
          bigBlind,
          createdAt: archive.createdAt,
          gameType: archive.gameType || "Unknown", // Assuming 'gameType' is available in your data
        };
      });

      setGames(formattedData);
      setTotalPages(response.data.totalPages);
      setTotalItems(response.data.totalItems);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    fetchGameData();
  }, [pageNo, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPageNo(newPage);
    }
  };

  const handleSort = (column) => {
    const newDirection =
      sortBy === column && sortDirection === "asc" ? "desc" : "asc";
    setSortBy(column);
    setSortDirection(newDirection);

    const sortedGames = [...games].sort((a, b) => {
      if (a[column] < b[column]) return sortDirection === "asc" ? -1 : 1;
      if (a[column] > b[column]) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    setGames(sortedGames);
  };

  return (
    <div className="bg-white border border-blue-500 rounded-lg shadow p-4">
      <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-700">
          Latest Game History
        </h2>
        <button className="text-gray-400 hover:text-gray-600">&times;</button>
      </div>

      <div className="mb-4 flex items-center space-x-2">
        <label htmlFor="entries" className="text-sm text-gray-700">
          Show
        </label>
        <select
          id="entries"
          value={itemsPerPage}
          onChange={(e) => setItemsPerPage(Number(e.target.value))}
          className="border border-gray-300 rounded p-1 text-sm"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
        <span className="text-sm text-gray-700">entries</span>
      </div>

      <table className="w-full border border-gray-200 text-sm text-left">
        <thead>
          <tr className="bg-gray-100 text-gray-600">
            <th className="py-2 px-4">Desk Name</th>
            <th className="py-2 px-4">Total Bet</th>
            <th className="py-2 px-4">Small Blind</th>
            <th className="py-2 px-4">Big Blind</th>
            <th
              className="py-2 px-4 cursor-pointer"
              onClick={() => handleSort("gameType")}
            >
              Game Type{" "}
              {sortBy === "gameType"
                ? sortDirection === "asc"
                  ? "↑"
                  : "↓"
                : ""}
            </th>
            <th className="py-2 px-4">Created At</th>
            <th className="py-2 px-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game, index) => (
            <tr
              key={game.deskName}
              className={`border-t ${
                index % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              <td className="py-2 px-4">{game.deskName}</td>
              <td className="py-2 px-4">{game.totalBet}</td>
              <td className="py-2 px-4">
                {game.smallBlind !== null ? game.smallBlind : "N/A"}
              </td>
              <td className="py-2 px-4">
                {game.bigBlind !== null ? game.bigBlind : "N/A"}
              </td>
              <td className="py-2 px-4">{game.gameType}</td>
              <td className="py-2 px-4">
                {new Date(game.createdAt).toLocaleString()}
              </td>
              <td className="py-2 px-2">
                <button
                  onClick={() => openModal(game)}
                  className="bg-blue-500 text-white py-1 px-3 rounded"
                >
                 Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Showing {itemsPerPage * (pageNo - 1) + 1} to{" "}
          {Math.min(itemsPerPage * pageNo, totalItems)} of {totalItems} entries
        </p>
        <div className="flex items-center space-x-2">
          <button
            className="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50"
            onClick={() => handlePageChange(pageNo - 1)}
          >
            Previous
          </button>
          <button
            className="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50"
            onClick={() => handlePageChange(pageNo + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="mt-4 flex space-x-4">
        <Link
          href="/admin/gameList"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          View All History
        </Link>
        <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          View Monthly Graph
        </button>
      </div>

 
      {isModalOpen && selectedGame && (
  <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div className="bg-white rounded-lg p-6 w-3/4 max-w-2xl">
      <h2 className="text-lg font-bold mb-4">Game Details</h2>

      {/* Players Section */}
      <div>
        <h3 className="font-semibold">Players:</h3>
        <table className="w-full text-sm text-left border-collapse border border-gray-200 mt-2">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="py-1 px-2 border">Username</th>
              <th className="py-1 px-2 border">Total Bet</th>
              <th className="py-1 px-2 border">Status</th>
            </tr>
          </thead>
          <tbody>
            {selectedGame.players.map((player, idx) => (
              <tr key={idx} className="border-t">
                <td className="py-1 px-2 border">{player.username}</td>
                <td className="py-1 px-2 border">{player.totalBet}</td>
                <td className="py-1 px-2 border">{player.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pots Section */}
      <div className="mt-4">
        <h3 className="font-semibold">Pots:</h3>
        {selectedGame.pots.map((pot, idx) => (
          <div key={idx} className="mt-2">
            <h4 className="font-medium">Pot {idx + 1}:</h4>
            <ul className="list-disc pl-6">
              {pot.winners.map((winner, winnerIdx) => (
                <li key={winnerIdx}>
                  {winner.username} won {winner.amount}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-end">
        <a
          href={`/tableDetails/${selectedGame.tableId}`}
          className="bg-blue-500 text-white py-2 px-4 rounded-lg mr-2"
        >
          View Table Details
        </a>
        <button
          onClick={closeModal}
          className="bg-gray-500 text-white py-2 px-4 rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default LatestGameHistory;
