import React from "react";
import { CurrencyDollarIcon } from "@heroicons/react/outline"; // Importing the CurrencyDollarIcon
import Link from "next/link";

const BankTransactionStats = ({ bankTransactionStats }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
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
      <div className="mt-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Total Deposit Successful:</span>
          <span
            className={
              bankTransactionStats.totalDepositSuccessful > 0
                ? "text-green-600"
                : "text-gray-600"
            }
          >
            ₹{bankTransactionStats.totalDepositSuccessful}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Withdraw Successful:</span>
          <span
            className={
              bankTransactionStats.totalWithdrawSuccessful > 0
                ? "text-blue-600"
                : "text-gray-600"
            }
          >
            ₹{bankTransactionStats.totalWithdrawSuccessful}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Withdraw Failed:</span>
          <span
            className={
              bankTransactionStats.totalWithdrawFailed > 0
                ? "text-red-600"
                : "text-gray-600"
            }
          >
            ₹{bankTransactionStats.totalWithdrawFailed}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Pending Deposit:</span>
          <span
            className={
              bankTransactionStats.totalPendingDeposit > 0
                ? "text-yellow-600"
                : "text-gray-600"
            }
          >
            ₹{bankTransactionStats.totalPendingDeposit}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Pending Withdraw:</span>
          <span
            className={
              bankTransactionStats.totalPendingWithdraw > 0
                ? "text-yellow-600"
                : "text-gray-600"
            }
          >
            ₹{bankTransactionStats.totalPendingWithdraw}
          </span>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link href="/admin/transactions">
          <span className="text-lg font-semibold text-white bg-gradient-to-r from-green-500 to-teal-600 hover:from-teal-600 hover:to-green-500 py-3 px-6 rounded-full cursor-pointer transition-all transform hover:scale-105 shadow-lg hover:shadow-xl">
            Go to Bank Transactions
          </span>
        </Link>
      </div>
    </div>
  );
};

export default BankTransactionStats;
