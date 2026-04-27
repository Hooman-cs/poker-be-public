"use client";

import { useEffect, useState } from "react";
import axios from "axios";

export default function PokerGameArchiveAdminPanel() {
  const [data, setData] = useState([]);
  const [pageNo, setPageNo] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [deskId, setDeskId] = useState("");
  const [username, setUsername] = useState("");
  const [startDate, setStartDate] = useState("2021-01-01");
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedGame, setSelectedGame] = useState(null); // For modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameType, setGameType] = useState("");

  useEffect(() => {
    fetchData();
    fetchPokerGameData();
  }, [
    pageNo,
    itemsPerPage,
    deskId,
    username,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    gameType,
  ]);

  const fetchData = async () => {
    setData([]);
    try {
      const response = await axios.get("/api/admin/auth/getGamesList", {
        params: {
          pageNo,
          itemsPerPage,
          deskId: deskId || undefined,
          username: username || undefined,
          startDate,
          endDate,
          sortBy,
          sortOrder,
          gameType,
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

      setData(formattedData);
      setTotalPages(response.data.totalPages);
      setTotalItems(response.data.totalItems);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPageNo(newPage);
    }
  };

  const openModal = (game) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedGame(null);
  };

  const fetchPokerGameData = () => {
    // Construct the query parameters for the request
    const params = {
      deskId,
    };

    // Make the API request
    axios
      .get("/api/admin/auth/getGameData", { params })
      .then((response) => {
        // Log the response to the console
        console.log("API Response:", response.data);
      })
      .catch((error) => {
        // Handle error
        console.error("Error fetching poker game data:", error);
      });
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        Poker Game Archive Admin Panel
      </h1>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Desk ID"
          value={deskId}
          onChange={(e) => setDeskId(e.target.value)}
          className="border px-2 py-1"
        />
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border px-2 py-1"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border px-2 py-1"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border px-2 py-1"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border px-2 py-1"
        >
          <option value="date">Date</option>
          <option value="potAmount">Pot Amount</option>
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border px-2 py-1"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>
      <div className="mb-4 flex gap-4">
        <select
          value={gameType}
          onChange={(e) => setGameType(e.target.value)}
          className="border px-2 py-1"
        >
          <option value="">All Game Types</option>
          <option value="NLH">No Limit Hold'em (NLH)</option>
          <option value="PLO4">Pot Limit Omaha (4 cards)</option>
          <option value="PLO5">Pot Limit Omaha (5 cards)</option>
          <option value="OmahaHILO">Omaha Hi-Lo</option>
          <option value="SDH">Short Deck Hold'em</option>
          <option value="STUD">Seven Card Stud</option>
          <option value="RAZZ">Razz</option>
          <option value="PINEAPPLE">Pineapple Poker</option>
          <option value="COURCHEVEL">Courchevel Poker</option>
          <option value="5CD">Five Card Draw</option>
          <option value="BADUGI">Badugi Poker</option>
          <option value="MIXED">Mixed Games</option>
        </select>
      </div>
      {/* Data Table */}
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
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((game, index) => (
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
                <td className="py-2 px-4">
                  <button
                    onClick={() => openModal(game)}
                    className="bg-blue-500 text-white py-1 px-3 rounded"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {itemsPerPage * (pageNo - 1) + 1} to{" "}
            {Math.min(itemsPerPage * pageNo, totalItems)} of {totalItems}{" "}
            entries
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
              onClick={() =>
                setPageNo((prev) => Math.min(prev + 1, totalPages))
              }
            >
              Next
            </button>
          </div>
        </div>

        {isModalOpen && selectedGame && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
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

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-center space-x-2">
        {/* Render numbered pagination */}
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (page) => {
            if (
              page === 1 || // Always show the first page
              page === totalPages || // Always show the last page
              (page >= pageNo - 2 && page <= pageNo + 2) // Show nearby pages
            ) {
              return (
                <button
                  key={page}
                  onClick={() => setPageNo(page)}
                  className={`border px-4 py-2 ${
                    page === pageNo
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-800"
                  }`}
                >
                  {page}
                </button>
              );
            }

            if (
              page === pageNo - 3 || // Ellipsis before current range
              page === pageNo + 3 || // Ellipsis after current range
              (page === 2 && pageNo > 5) || // Ellipsis after the first page
              (page === totalPages - 1 && pageNo < totalPages - 4) // Ellipsis before the last page
            ) {
              return (
                <span key={page} className="px-2">
                  ...
                </span>
              );
            }

            return null; // Skip other pages
          }
        )}
      </div>
    </div>
  );
}
