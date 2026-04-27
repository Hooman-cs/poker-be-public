import React from "react";
import { UserIcon } from "@heroicons/react/outline"; // Importing the UserIcon (or any icon you'd like to use)
import Link from "next/link";

const UserStats = ({ userStats }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center space-x-4">
        <UserIcon className="h-8 w-8 text-blue-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800">User Stats</h2>
          <p className="text-sm text-gray-500">
            Total Users: {userStats.totalUsers}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Active Users:</span>
          <span
            className={
              userStats.activeUsers > 0 ? "text-green-600" : "text-red-600"
            }
          >
            {userStats.activeUsers}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Inactive Users:</span>
          <span
            className={
              userStats.inactiveUsers > 0 ? "text-yellow-600" : "text-gray-600"
            }
          >
            {userStats.inactiveUsers}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Suspended Users:</span>
          <span
            className={
              userStats.suspendedUsers > 0 ? "text-red-600" : "text-gray-600"
            }
          >
            {userStats.suspendedUsers}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Users Registered Today:</span>
          <span
            className={
              userStats.usersRegisteredToday > 0
                ? "text-blue-600"
                : "text-gray-600"
            }
          >
            {userStats.usersRegisteredToday}
          </span>
        </div>
      </div>

      <div className="mt-6 text-center" style={{marginTop:'54px'}}>
        <Link href="/admin/users">
          <span className="text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-500 py-3 px-6 rounded-full cursor-pointer transition-all transform hover:scale-105 shadow-lg hover:shadow-xl">
            Go to All Users
          </span>
        </Link>
      </div>
    </div>
  );
};

export default UserStats;
