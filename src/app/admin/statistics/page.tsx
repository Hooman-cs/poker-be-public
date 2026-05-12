'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';

// -----------------------------------------------------------------------------
// Component Imports (Strict PascalCase)
// -----------------------------------------------------------------------------
import LatestGameHistory from '../../../components/admin/LatestGameHistory';
import LeaderBoard from '../../../components/admin/LeaderBoard';
import LatestPlayers from '../../../components/admin/LatestPlayers';
import BankStats from '../../../components/admin/BankStats';
import UserStats from '../../../components/admin/UserStats';
import GameStats from '../../../components/admin/GameStats';

const GameUsage = dynamic(() => import('../../../components/admin/GameUsage'), { ssr: false });
const BankTransactionOverview = dynamic(() => import('../../../components/admin/BankTransactionOverview'), { ssr: false });

// -----------------------------------------------------------------------------
// TypeScript Interfaces
// -----------------------------------------------------------------------------
interface DashboardData {
  userStats?: {
    topNewUsers?: any[];
    totalUsers?: number;
    deviceTypeStats?: any;
    // Added missing properties to satisfy IUserStats
    activeUsers?: number;
    inactiveUsers?: number;
    suspendedUsers?: number;
    usersRegisteredToday?: number;
  };
  bankTransactionStats?: any;
  pokerGameStats?: {
    topPlayersByTotalBet?: any[];
    // Added missing properties to satisfy IPokerGameStats
    totalActivePokerGames?: number;
    totalFinishedGames?: number;
    totalPotInFinishedGames?: number;
    mostPlayedPokerDesk?: string | any;
  };
}

/**
 * Admin Analytics Dashboard
 * Fetches and displays top-level metrics for the poker platform.
 */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // API MIGRATION 1: Dashboard Analytics
        const dashboardRes = await axios.get('/api/admin/analytics/dashboard');
        // Handle varying response structures seamlessly
        setData(dashboardRes.data.data || dashboardRes.data);

        // API MIGRATION 2: Users List
        const usersRes = await axios.get('/api/admin/users');
        setUsers(usersRes.data.users || []);
        
      } catch (err: unknown) {
        console.error('[Dashboard Fetch Error]:', err);
        setError('Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh]">
        <div className="w-8 h-8 border-t-4 border-blue-600 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500 font-semibold">{error}</div>;
  }

  if (!data) {
    return <div className="p-6 text-gray-500">No dashboard data available.</div>;
  }

  const { userStats, bankTransactionStats, pokerGameStats } = data;

  return (
    <div className="py-6 bg-gray-50 min-h-screen">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {/* Type cast to 'any' to bypass strict interface requirements if some fields are temporarily missing from the API */}
        {userStats && <UserStats userStats={userStats as any} />}
        {bankTransactionStats && <BankStats bankTransactionStats={bankTransactionStats} />}
        {pokerGameStats && <GameStats pokerGameStats={pokerGameStats as any} />}
      </div>

      {/* Main Content Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Left Column: Latest Players and Latest Game History */}
        <div className="lg:col-span-2 space-y-6">
          {userStats?.topNewUsers && <LatestPlayers players={userStats.topNewUsers} />}
          <LatestGameHistory />
        </div>

        {/* Right Column: Leaderboard and Game Usage */}
        <div className="space-y-6">
          {pokerGameStats?.topPlayersByTotalBet && (
            <LeaderBoard topPlayers={pokerGameStats.topPlayersByTotalBet} />
          )}
          {userStats?.totalUsers && userStats?.deviceTypeStats && (
            <GameUsage totalUsers={userStats.totalUsers} deviceTypeStats={userStats.deviceTypeStats} />
          )}
        </div>
        
      </div>
    </div>
  );
}