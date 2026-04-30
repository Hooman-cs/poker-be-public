/**
 * @fileoverview Admin Dashboard - User Statistics Component
 * Displays a high-level aggregate of user account statuses.
 */

import React from "react";
import { UserIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { IUserStats } from "@/utils/pokerModelTypes";

// 1. Strict Prop Definitions
interface UserStatsProps {
  userStats: IUserStats;
}

export default function UserStats({ userStats }: UserStatsProps): JSX.Element {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <UserIcon className="h-8 w-8 text-blue-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800">User Stats</h2>
          <p className="text-sm text-gray-500">
            Total Users: <span className="font-medium text-gray-700">{userStats.totalUsers.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* Stats List */}
      <div className="mt-6 space-y-3 flex-grow">
        <div className="flex justify-between items-center border-b border-gray-50 pb-2">
          <span className="text-gray-600">Active Users:</span>
          <span className={`font-semibold ${userStats.activeUsers > 0 ? "text-green-600" : "text-gray-400"}`}>
            {userStats.activeUsers.toLocaleString()}
          </span>
        </div>
        
        <div className="flex justify-between items-center border-b border-gray-50 pb-2">
          <span className="text-gray-600">Inactive Users:</span>
          <span className={`font-semibold ${userStats.inactiveUsers > 0 ? "text-yellow-600" : "text-gray-400"}`}>
            {userStats.inactiveUsers.toLocaleString()}
          </span>
        </div>
        
        <div className="flex justify-between items-center border-b border-gray-50 pb-2">
          <span className="text-gray-600">Suspended Users:</span>
          <span className={`font-semibold ${userStats.suspendedUsers > 0 ? "text-red-600" : "text-gray-400"}`}>
            {userStats.suspendedUsers.toLocaleString()}
          </span>
        </div>
        
        <div className="flex justify-between items-center pb-2">
          <span className="text-gray-600">Registered Today:</span>
          <span className={`font-semibold ${userStats.usersRegisteredToday > 0 ? "text-blue-600" : "text-gray-400"}`}>
            {userStats.usersRegisteredToday.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Call to Action (Using arbitrary Tailwind margin for exact spacing) */}
      <div className="text-center mt-[54px]">
        <Link 
          href="/admin/users"
          className="inline-block text-base font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-500 py-3 px-6 rounded-full transition-all transform hover:scale-105 shadow-md hover:shadow-lg w-full"
        >
          Go to All Users
        </Link>
      </div>
    </div>
  );
}