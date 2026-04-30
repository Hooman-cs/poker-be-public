/**
 * @fileoverview Admin Dashboard - Game Usage Component
 * Displays the distribution of users across mobile platforms (Android vs. iOS).
 * Uses dynamic imports to prevent Server-Side Rendering (SSR) crashes with ApexCharts.
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { IDeviceStat } from '@/utils/pokerModelTypes';

// Dynamically import ApexCharts to bypass SSR window undefined errors
const Chart = dynamic(() => import('react-apexcharts'), { 
  ssr: false,
  loading: () => <div className="h-[200px] flex items-center justify-center text-gray-400">Loading chart...</div> 
});

// 1. Strict Prop Definitions
interface GameUsageProps {
  totalUsers: number;
  deviceTypeStats: IDeviceStat[];
}

export default function GameUsage({ totalUsers, deviceTypeStats }: GameUsageProps): JSX.Element {
  // 2. Strict Mobile-Only Calculation Logic
  const androidUsers = deviceTypeStats?.find((item) => item._id === 'android')?.count || 0;
  
  // Since this is strictly a mobile app, any user not on Android is safely assumed to be on iOS.
  // We use Math.max to prevent negative numbers in case of dirty backend data.
  const iosUsers = Math.max(0, totalUsers - androidUsers);
  
  const chartData = [androidUsers, iosUsers];
  
  const chartOptions = {
    chart: {
      type: 'donut' as const,
      toolbar: { show: false },
    },
    labels: ['Android', 'iOS'],
    colors: ['#28a745', '#007bff'], // Green for Android, Blue for iOS
    legend: {
      position: 'right' as const,
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
        },
      },
    },
    dataLabels: {
      enabled: false,
    }
  };
  
  // Stats to display below the chart
  const stats = [
    { platform: 'Android', count: androidUsers, color: 'text-green-600', border: 'border-green-200' },
    { platform: 'iOS', count: iosUsers, color: 'text-blue-600', border: 'border-blue-200' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 w-full max-w-sm h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Platform Usage</h2>
      </div>

      {/* Chart Render */}
      <div className="flex-grow flex items-center justify-center min-h-[200px]">
        <Chart
          options={chartOptions}
          series={chartData}
          type="donut"
          width="100%"
        />
      </div>

      {/* Footer Stats List */}
      <div className="mt-4 space-y-2">
        {stats.map((stat, index) => (
          <div key={index} className={`flex justify-between items-center p-3 border rounded-md bg-gray-50 ${stat.border}`}>
            <span className="text-sm font-medium text-gray-700">{stat.platform}</span>
            <span className={`text-sm font-bold ${stat.color}`}>{stat.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}