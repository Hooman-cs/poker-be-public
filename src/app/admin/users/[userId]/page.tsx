
'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import LatestGameHistory from '@/components/admin/latestGameHistory';
import UserBankTransactionsHistory from '@/components/admin/UserBankTransactionsHistory';
const UserDetails = () => {
  const pathname = usePathname();
  const userId = pathname?.split('/').pop();
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) return;

    // Fetch user details from the API
    const fetchUserDetails = async () => {
      try {
        const response = await fetch('/api/admin/auth/users/getUserDetails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });

        const data = await response.json();
        if (response.ok) {
          setUserDetails(data);
        } else {
          alert(data.message || 'Error fetching user details');
        }
      } catch (error) {
        alert('Error fetching user details');
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [userId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xl">Loading...</div>;
  }

  if (!userDetails) {
    return <div className="min-h-screen flex items-center justify-center text-xl">User not found</div>;
  }

  const { userDetails: user, wallet, totalBet, totalWin, totalDeposit, totalWithdraw, totalDeskIn, totalDeskWithdraw } =
    userDetails;

    return (
      <div className="min-h-screen py-8  ">
        <div className="max-w-6xl mx-auto bg-white  "> 
          {/* User Profile */}
          <div className="flex items-center space-x-6 border-b pb-6">
            <div className="w-24 h-24 rounded-full bg-gray-300 flex justify-center items-center text-2xl font-bold text-white">
              {user.username[0]}
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{user.username}</h2>
              <p className="text-gray-500">{user.mobileNumber}</p>
              <p className="text-sm text-gray-400">
                Registered on: {new Date(user.registrationDate).toLocaleDateString()}
              </p>
              <p
                className={`text-lg font-semibold mt-2 ${
                  user.status === 'active' ? 'text-green-500' : 'text-red-500'
                }`}
              >
                Status: {user.status}
              </p>
            </div>
          </div>
    
          {/* Statistics */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Game & Wallet Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <StatCard title="Total Bet" value={`$${totalBet.toFixed(2)}`} />
              <StatCard title="Total Win" value={`$${totalWin.toFixed(2)}`} />
              <StatCard title="Total Deposit" value={`$${totalDeposit.toFixed(2)}`} />
              <StatCard title="Total Withdraw" value={`$${totalWithdraw.toFixed(2)}`} />
              <StatCard title="Desk In" value={`$${totalDeskIn.toFixed(2)}`} />
              <StatCard title="Desk Withdraw" value={`$${totalDeskWithdraw.toFixed(2)}`} />
              <StatCard title="Wallet Balance" value={`$${wallet.balance.toFixed(2)}`} />
              <StatCard title="Locked Bonus" value={`$${wallet.lockedBonus.toFixed(2)}`} />
            </div>
          </div>
    
          {/* Location Details */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Location & Device Info</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <h4 className="text-lg font-medium text-gray-600">Device Type</h4>
                <p className="text-2xl font-bold">{user.deviceType || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <h4 className="text-lg font-medium text-gray-600">Location</h4>
                <p className="text-2xl font-bold">
                  {user.latitude || 'N/A'}, {user.longitude || 'N/A'}
                </p>
              </div>
            </div>
          </div>
    
          {/* Game and Transaction History */}
          <div className="mt-8 space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm"> 
              <LatestGameHistory username={user.username} />
            </div>
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm"> 
              <UserBankTransactionsHistory username={user.username} />
            </div>
          </div>
        </div>
      </div>
    );
    
};

const StatCard = ({ title, value }: { title: string; value: string }) => (
  <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
    <h4 className="text-lg font-medium text-gray-600">{title}</h4>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

export default UserDetails;
