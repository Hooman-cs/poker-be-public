 'use client'
// /components/GamesManagement.js
import { useState, useEffect } from 'react';
import SearchInput from '../../../components/admin/searchInput';

export default function GamesManagement() {
  const [gamesByDesk, setGamesByDesk] = useState({});
  const [page, setPage] = useState(1); // Default page set to 1
  const [search, setSearch] = useState(''); // Default search set to empty string
  const [loading, setLoading] = useState(false);
  const limit = 10;

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/archiveGames?page=${page}&limit=${limit}&search=${search}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        
        const gamesByDeskTemp = data.reduce((acc, game) => {
          if (!acc[game.deskId]) {
            acc[game.deskId] = {
              totalGames: 0,
              totalBetAmount: 0,
              games: [],
            };
          }
          acc[game.deskId].totalGames += 1;
          acc[game.deskId].totalBetAmount += game.pot;
          acc[game.deskId].games.push(game);
          return acc;
        }, {});

        setGamesByDesk(gamesByDeskTemp);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [page, search]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page on new search
  };

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = Object.keys(gamesByDesk).length === limit ? page + 1 : null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Archived Games Management</h1>

      {/* Search */}
      <div>
        <SearchInput search={search} onChange={handleSearch} />
      </div>

      {/* Pagination */}
      <div className="flex justify-between mb-4">
        <span>{`Page ${page}`}</span>
        <div>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded mr-2"
            disabled={!prevPage}
            onClick={() => setPage(prevPage)}
          >
            Previous
          </button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded"
            disabled={!nextPage}
            onClick={() => setPage(nextPage)}
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-6">
          {Object.keys(gamesByDesk).map(deskId => {
            const desk = gamesByDesk[deskId];
            return (
              <div key={deskId}>
                <h2 className="text-xl font-semibold mb-2">Desk ID: {deskId}</h2>
                <p>Total Games: {desk.totalGames}</p>
                <p>Total Bet Amount: {desk.totalBetAmount}</p>

                <table className="min-w-full bg-white shadow-md rounded mb-4">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Pot</th>
                      <th className="px-4 py-2">Winners</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Created At</th>
                      <th className="px-4 py-2">Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desk.games.map(game => (
                      <tr key={game.deskId}>
                        <td className="border px-4 py-2">{game.pot}</td>
                        <td className="border px-4 py-2">
                          <details>
                            <summary className="cursor-pointer">Winners</summary>
                            <ul className="list-disc pl-4">
                              {game.winners.map(winner => (
                                <li key={winner.playerId}>
                                  {winner.playerId}: {winner.amount}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                        <td className="border px-4 py-2">{game.status}</td>
                        <td className="border px-4 py-2">{new Date(game.createdAt).toLocaleString()}</td>
                        <td className="border px-4 py-2">{new Date(game.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

 