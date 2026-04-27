'use client'

import React from 'react';
import Chart from 'react-apexcharts';

const BankTransactionOverview = ({ stats }) => {
  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Bank Transaction Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-100 p-4 rounded-md shadow-sm">
          <h3 className="text-lg font-medium text-gray-700">Today's Transactions</h3>
          <Chart
            options={{
              chart: { type: 'pie' },
              labels: ['Successful Deposits', 'Failed Deposits', 'Successful Withdrawals', 'Failed Withdrawals'],
              colors: ['#4CAF50', '#F44336', '#2196F3', '#FF9800'],
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

        <div className="bg-gray-100 p-4 rounded-md shadow-sm">
          <h3 className="text-lg font-medium text-gray-700">Pending Transactions</h3>
          <Chart
            options={{
              chart: { type: 'donut' },
              labels: ['Pending Deposits', 'Pending Withdrawals'],
              colors: ['#FFEB3B', '#FFC107'],
            }}
            series={[
              stats.totalPendingDeposit,
              stats.totalPendingWithdraw,
            ]}
            type="donut"
            height={300}
          />
        </div>

        <div className="bg-gray-100 p-4 rounded-md shadow-sm">
          <h3 className="text-lg font-medium text-gray-700">Overall Statistics</h3>
          <Chart
            options={{
              chart: { type: 'bar' },
              xaxis: {
                categories: ['Deposits Successful', 'Deposits Failed', 'Withdrawals Successful', 'Withdrawals Failed'],
              },
              yaxis: {
                title: {
                  text: 'Transactions Count',
                },
              },
              colors: ['#4CAF50', '#F44336', '#2196F3', '#FF9800'],
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
            height={350}
          />
        </div>
      </div>
    </div>
  );
};

export default BankTransactionOverview;

 