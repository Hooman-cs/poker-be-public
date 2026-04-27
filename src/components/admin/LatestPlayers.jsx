import Link from "next/link";

const LatestPlayers = ({players}) => {

  const formatDate = (date) => {
    const options = { year: 'numeric', month: 'long' };
    return new Date(date).toLocaleDateString('en-US', options);
  };

    return (
      <div className="bg-white border border-red-500 rounded-lg shadow p-4">
        <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-700">Latest Players</h2>
          <button className="bg-red-500 text-white px-3 py-1 text-sm rounded-full">
            10 New Players
          </button>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {players.map((player, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className="w-12 h-12 bg-green-100 text-green-500 rounded-full flex items-center justify-center">
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
              <p className="text-sm font-medium text-gray-700 mt-2">{player.username}</p>
              <p className="text-xs text-gray-500">{formatDate(player.registrationDate)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link
            href="/admin/users"
            className="text-blue-500 text-sm hover:underline"
          >
            View All Users
          </Link>
        </div>
      </div>
    );
};

export default LatestPlayers;