/**
 * @fileoverview Admin Dashboard - Bank Transaction Statistics Component
 * Displays an aggregated view of successful, failed, and pending financial transactions.
 */

import React from "react";
import { CurrencyDollarIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

// 1. Strict Prop Definitions
export interface IBankTransactionStats {
  totalDepositFailed: number;
  totalDepositSuccessful: number;
  totalWithdrawSuccessful: number;
  totalWithdrawFailed: number;
  totalPendingDeposit: number;
  totalPendingWithdraw: number;
}

interface BankStatsProps {
  bankTransactionStats: IBankTransactionStats;
}

export default function BankStats({ bankTransactionStats }: BankStatsProps): JSX.Element {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <CurrencyDollarIcon className="h-8 w-8 text-green-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Bank Transaction Stats
          </h2>
          <p className="text-sm text-gray-500">
            Total Deposit Failed: ₹{bankTransactionStats.totalDepositFailed}
          </p>
        </div>
      </div>

      {/* Stats List */}
      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Deposit Successful:</span>
          <span className={`font-medium ${bankTransactionStats.totalDepositSuccessful > 0 ? "text-green-600" : "text-gray-600"}`}>
            ₹{bankTransactionStats.totalDepositSuccessful}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Withdraw Successful:</span>
          <span className={`font-medium ${bankTransactionStats.totalWithdrawSuccessful > 0 ? "text-blue-600" : "text-gray-600"}`}>
            ₹{bankTransactionStats.totalWithdrawSuccessful}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Withdraw Failed:</span>
          <span className={`font-medium ${bankTransactionStats.totalWithdrawFailed > 0 ? "text-red-600" : "text-gray-600"}`}>
            ₹{bankTransactionStats.totalWithdrawFailed}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Pending Deposit:</span>
          <span className={`font-medium ${bankTransactionStats.totalPendingDeposit > 0 ? "text-yellow-600" : "text-gray-600"}`}>
            ₹{bankTransactionStats.totalPendingDeposit}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Pending Withdraw:</span>
          <span className={`font-medium ${bankTransactionStats.totalPendingWithdraw > 0 ? "text-yellow-600" : "text-gray-600"}`}>
            ₹{bankTransactionStats.totalPendingWithdraw}
          </span>
        </div>
      </div>

      {/* Call to Action */}
      <div className="mt-8 text-center">
        <Link 
          href="/admin/transactions"
          className="inline-block text-base font-semibold text-white bg-gradient-to-r from-green-500 to-teal-600 hover:from-teal-600 hover:to-green-500 py-3 px-6 rounded-full transition-all transform hover:scale-105 shadow-md hover:shadow-lg"
        >
          Go to Bank Transactions
        </Link>
      </div>
    </div>
  );
}