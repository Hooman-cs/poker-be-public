'use client'

import React  from 'react';
import Chart from 'react-apexcharts';

const GameUsage = ({ totalUsers, deviceTypeStats }) => {
  // Extract Android user count
  const androidUsers = deviceTypeStats?.find((item) => item._id === 'android')?.count || 0;

  // Calculate iOS and Other user counts
  const iosUsers = Math.max(0, totalUsers - androidUsers);
  const otherUsers = Math.max(0, totalUsers - androidUsers - iosUsers);
  
  // Chart data
  const chartData = [androidUsers, iosUsers, otherUsers];
  
  // Chart options
  const chartOptions = {
    chart: {
      type: 'donut',
      toolbar: { show: false },
    },
    labels: ['Android', 'iOS', 'Other'],
    colors: ['#28a745', '#007bff', '#dc3545'],
    legend: {
      position: 'right',
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
        },
      },
    },
  };
  
  // Stats to display below the chart
  const stats = [
    { platform: 'Android', count: androidUsers, color: 'text-green-500' },
    { platform: 'iOS', count: iosUsers, color: 'text-blue-500' },
    { platform: 'Other', count: otherUsers, color: 'text-red-500' },
  ];

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow p-4 w-80">
      <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Game Usage</h2>
        <button className="text-gray-400 hover:text-gray-600">&times;</button>
      </div>
      <Chart
        options={chartOptions}
        series={chartData}
        type="donut"
        width="100%"
      />
      <div className="mt-4">
        {stats.map((stat, index) => (
          <div key={index} className="flex justify-between items-center py-2 border-t border-gray-200">
            <span className="text-sm text-gray-700">{stat.platform}</span>
            <span className={`text-sm font-semibold ${stat.color}`}>{stat.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameUsage;
