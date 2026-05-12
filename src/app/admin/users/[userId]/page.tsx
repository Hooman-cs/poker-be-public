'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

// -----------------------------------------------------------------------------
// Component Imports
// -----------------------------------------------------------------------------
import LatestGameHistory from '@/components/admin/LatestGameHistory';
import UserBankTransactionsHistory from '@/components/admin/UserBankTransactionsHistory';

// -----------------------------------------------------------------------------
// TypeScript Interfaces
// -----------------------------------------------------------------------------
interface UserDetails {
  _id: string;
  username: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  walletBalance: number;
  totalDeposit?: number;
  totalWithdrawal?: number;
  deviceType?: string;
  latitude?: string;
  longitude?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
}

/**
 * User Details Dashboard
 * Fetches and displays granular information, balances, and history for a specific user.
 */
export default function UserDetailsPage() {
  // Use native Next.js params instead of splitting the URL string
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;

  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchUserDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // API MIGRATION: Modern RESTful GET request
        const response = await axios.get(`/api/admin/users/${userId}`);
        
        // Handle variations in your backend payload structure
        const userData = response.data.data || response.data.user || response.data;
        setUser(userData);
        
      } catch (err: unknown) {
        console.error('Error fetching user details:', err);
        setError('Failed to load user details. They may have been deleted.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh]">
        <div className="w-10 h-10 border-t-4 border-blue-600 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 max-w-7xl mx-auto mt-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {error || 'User not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        
        {/* Header Section */}
        <div className="bg-gray-800 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">{user.username}</h2>
            <p className="text-gray-300 mt-1">{user.email}</p>
          </div>
          <div className="text-right">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold uppercase tracking-wider ${
                user.status === 'active' ? 'bg-green-500 text-white' : 
                user.status === 'suspended' ? 'bg-red-500 text-white' : 
                'bg-yellow-500 text-white'
              }`}
            >
              {user.status}
            </span>
            <p className="text-gray-400 text-xs mt-2">
              Registered: {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="p-6">
          {/* General Information */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Balance & Deposits</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Wallet Balance" value={`$${user.walletBalance?.toFixed(2) || '0.00'}`} />
              <StatCard title="Total Deposit" value={`$${user.totalDeposit?.toFixed(2) || '0.00'}`} />
              <StatCard title="Total Withdrawal" value={`$${user.totalWithdrawal?.toFixed(2) || '0.00'}`} />
            </div>
          </div>

          {/* Location and Device Info */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Location & Device Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Device Type</h4>
                <p className="text-xl font-bold text-gray-900 mt-1">{user.deviceType || 'Unknown'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Location</h4>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {user.latitude || 'N/A'}, {user.longitude || 'N/A'}
                </p>
              </div>
            </div>
          </div>
    
          {/* Game and Transaction History */}
          <div className="mt-8 space-y-8">
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-100"> 
              {/* Note: Ensure LatestGameHistory accepts 'username' prop correctly */}
              <LatestGameHistory username={user.username} />
            </div>
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-100"> 
              <UserBankTransactionsHistory username={user.username} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------
const StatCard = ({ title, value }: StatCardProps) => (
  <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center">
    <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</h4>
    <p className="text-3xl font-bold text-gray-900">{value}</p>
  </div>
);