'use client'
import React, { useState, useEffect } from 'react';
import LatestGameHistory from '../../../components/admin/latestGameHistory';
import LeaderBoard  from '../../../components/admin/LeaderBoard'
import LatestPlayers from '../../../components/admin/LatestPlayers'
import dynamic from 'next/dynamic';

const GameUsage = dynamic(() => import('../../../components/admin/gameUsage'), { ssr: false });
const BankTransactionOverview = dynamic(() => import('../../../components/admin/BankTransactionOverview'), { ssr: false });
// Repeat for other components if necessary
import BankStats from '../../../components/admin/BankStats'
import UserStats from '../../../components/admin/UserStats'
import GameStats from '../../../components/admin/GameStats'
 
const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading ] = useState(false);
  const [users, setUsers ] = useState([]);
  // Fetch data from the API
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/admin/auth/getStastics'); // Adjust the API endpoint as needed
      const result = await res.json();
      console.log(result);
      setData(result.data);
    };
    fetchData();

    const fetchUsers = async () => {
     // setLoading(true);
      try {
        const response = await axios.get('/api/admin/auth/users');
        setUsers(response.data.users);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
       // setLoading(false);
      }
    };
    fetchUsers();


    const fetchGameData = async () => {
      try {
          const response = await axios.get('/api/admin/auth/getGamesList', {
              params: {
                  pageNo,
                  itemsPerPage, 
              }
          });
          setData(response.data.data);
          setTotalPages(response.data.totalPages);
      } catch (error) {
          console.error("Failed to fetch data:", error);
      }
     };

    
    fetchGameData();

  }, []);

  if (!data) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span>Loading...</span>
      </div>
    );
  }

  // Statistics Data
  const { userStats, bankTransactionStats, pokerGameStats } = data;
  
  return (
    <div className="p-6 bg-gray-100 min-h-screen"> 
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {userStats && <UserStats userStats={userStats} /> }
      { bankTransactionStats &&  <BankStats bankTransactionStats={bankTransactionStats} /> }
       { pokerGameStats && <GameStats pokerGameStats={pokerGameStats} /> }
         </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
        {/* Left Column: Latest Players and Latest Game History */}
        <div className="lg:col-span-2 space-y-6">
         { data.userStats.topNewUsers && <LatestPlayers players={data.userStats.topNewUsers} /> }
          {/* <LatestGameHistory /> */}
          <LatestGameHistory/>
        </div>

        {/* Right Column: Leaderboard and Game Usage */}
        <div className="space-y-6">
          { data.pokerGameStats.topPlayersByTotalBet && <LeaderBoard topPlayers = {data.pokerGameStats.topPlayersByTotalBet}/> }
          {  
          data.userStats.totalUsers && data.userStats.deviceTypeStats && <GameUsage totalUsers={data.userStats.totalUsers} deviceTypeStats={data.userStats.deviceTypeStats} />
        }
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">

      {bankTransactionStats &&  <BankTransactionOverview stats={bankTransactionStats}/> }
      </div>
    </div>
  );
};


export default Dashboard;
