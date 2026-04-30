/**
 * @fileoverview Admin Dashboard - Bank Transaction Overview Component
 * Renders data visualizations for today's and overall financial transactions.
 * Uses dynamic imports to prevent Server-Side Rendering (SSR) crashes with ApexCharts.
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ApexCharts to bypass SSR window undefined errors
const Chart = dynamic(() => import('react-apexcharts'), { 
  ssr: false,
  loading: () => <div className="h-[300px] flex items-center justify-center text-gray-400">Loading chart...</div> 
});

// 1. Strict Prop Definitions
export interface IBankOverviewStats {
  todaysDepositSuccessful: number;
  todaysDepositFailed: number;
  todaysWithdrawSuccessful: number;
  todaysWithdrawFailed: number;
  totalPendingDeposit: number;
  totalPendingWithdraw: number;
  totalDepositSuccessful: number;
  totalDepositFailed: number;
  totalWithdrawSuccessful: number;
  totalWithdrawFailed: number;
}

interface BankTransactionOverviewProps {
  stats: IBankOverviewStats;
}

export default function BankTransactionOverview({ stats }: BankTransactionOverviewProps): JSX.Element {
  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md border border-gray-100">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Bank Transaction Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Transactions - Pie Chart */}
        <div className="bg-gray-50 p-4 rounded-md shadow-sm border border-gray-100">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Today&apos;s Transactions</h3>
          <Chart
            options={{
              chart: { type: 'pie' },
              labels: ['Successful Deposits', 'Failed Deposits', 'Successful Withdrawals', 'Failed Withdrawals'],
              colors: ['#4CAF50', '#F44336', '#2196F3', '#FF9800'],
              legend: { position: 'bottom' }
            }}
            series={[
              stats.todaysDepositSuccessful,
              stats.todaysDepositFailed,
              stats.todaysWithdrawSuccessful,
              stats.todaysWithdrawFailed,
            ]}
            type="pie"
            height={300}
          />
        </div>

        {/* Pending Transactions - Donut Chart */}
        <div className="bg-gray-50 p-4 rounded-md shadow-sm border border-gray-100">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Pending Transactions</h3>
          <Chart
            options={{
              chart: { type: 'donut' },
              labels: ['Pending Deposits', 'Pending Withdrawals'],
              colors: ['#FFEB3B', '#FFC107'],
              legend: { position: 'bottom' }
            }}
            series={[
              stats.totalPendingDeposit,
              stats.totalPendingWithdraw,
            ]}
            type="donut"
            height={300}
          />
        </div>

        {/* Overall Statistics - Bar Chart (Spans full width on mobile, 1 col on md) */}
        <div className="bg-gray-50 p-4 rounded-md shadow-sm border border-gray-100 md:col-span-2 lg:col-span-1">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Overall Statistics</h3>
          <Chart
            options={{
              chart: { 
                type: 'bar',
                toolbar: { show: false }
              },
              xaxis: {
                categories: ['Deposits Successful', 'Deposits Failed', 'Withdrawals Successful', 'Withdrawals Failed'],
                labels: { style: { fontSize: '12px' } }
              },
              yaxis: {
                title: { text: 'Transactions Count' },
              },
              colors: ['#4CAF50', '#F44336', '#2196F3', '#FF9800'],
              plotOptions: {
                bar: { distributed: true, borderRadius: 4 }
              },
              legend: { show: false }
            }}
            series={[
              {
                name: 'Transactions',
                data: [
                  stats.totalDepositSuccessful,
                  stats.totalDepositFailed,
                  stats.totalWithdrawSuccessful,
                  stats.totalWithdrawFailed,
                ],
              },
            ]}
            type="bar"
            height={300}
          />
        </div>
      </div>
    </div>
  );
}