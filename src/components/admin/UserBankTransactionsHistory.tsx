/**
 * @fileoverview Admin Dashboard - User Bank Transactions History Component
 * Displays a filterable, paginated ledger of user deposits and withdrawals.
 * Allows administrators to update the status of pending transactions.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { IBankTransactionHistory } from '@/utils/pokerModelTypes';

// -----------------------------------------------------------------------------
// Strict Interfaces
// -----------------------------------------------------------------------------

interface UserBankTransactionsHistoryProps {
  username?: string;
}

interface FilterState {
  username: string;
  status: string;
  type: string;
  maxAmount: string;
  sortByDate: 'desc' | 'asc';
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function UserBankTransactionsHistory({
  username = '',
}: UserBankTransactionsHistoryProps): JSX.Element {
  
  // State Management
  const [transactions, setTransactions] = useState<IBankTransactionHistory[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<FilterState>({
    username,
    status: '',
    type: '',
    maxAmount: '',
    sortByDate: 'desc',
  });

  const itemsPerPage = 10;

  // -----------------------------------------------------------------------------
  // Data Fetching
  // -----------------------------------------------------------------------------
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Pointing to the modernized App Router endpoint
      const response = await axios.get('/api/admin/bankTransactions', {
        params: { 
          page, 
          limit: itemsPerPage, 
          ...filters,
        },
      });

      // Defensive Parsing
      const rawData = response.data.transactions || response.data.bankTransactions || response.data.data || [];
      const totalCounts = response.data.totalCounts || response.data.totalBankTransactions || rawData.length;

      setTransactions(rawData);
      setTotalPages(Math.max(1, Math.ceil(totalCounts / itemsPerPage)));
    } catch (error) {
      console.error('[Fetch Bank Transactions Error]:', error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // -----------------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------------
  const changeTransactionStatus = async (transactionId: string, newStatus: string) => {
    setUpdatingId(transactionId);
    try {
      // Pointing to the modernized App Router PATCH endpoint
      await axios.patch(`/api/admin/bankTransactions/${transactionId}/status`, {
        status: newStatus,
      });

      // Optimistically update local state
      setTransactions((prevTransactions) =>
        prevTransactions.map((transaction) =>
          transaction._id === transactionId
            ? { ...transaction, status: newStatus as IBankTransactionHistory['status'] }
            : transaction
        )
      );
    } catch (error) {
      console.error('[Update Transaction Status Error]:', error);
      alert('Failed to update transaction status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1); // Reset to page 1 when filters change
  };

  // -----------------------------------------------------------------------------
  // Render Helpers
  // -----------------------------------------------------------------------------
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'waiting':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
      case 'successful':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-6 md:p-8 bg-white shadow-sm border border-gray-200 rounded-xl w-full">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Bank Transactions</h2>

      {/* Filters Section */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <select
            name="status"
            className="border border-gray-300 p-2.5 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="waiting">Waiting</option>
            <option value="successful">Successful</option>
          </select>
          
          <select
            name="type"
            className="border border-gray-300 p-2.5 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            value={filters.type}
            onChange={handleFilterChange}
          >
            <option value="">All Types</option>
            <option value="deposit">Deposit</option>
            <option value="withdraw">Withdraw</option>
          </select>
          
          <input
            type="number"
            name="maxAmount"
            placeholder="Max Amount (₹)"
            className="border border-gray-300 p-2.5 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            value={filters.maxAmount}
            onChange={handleFilterChange}
            min="0"
          />
          
          <select
            name="sortByDate"
            className="border border-gray-300 p-2.5 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            value={filters.sortByDate}
            onChange={handleFilterChange}
          >
            <option value="desc">Date (Newest First)</option>
            <option value="asc">Date (Oldest First)</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full bg-white text-left whitespace-nowrap">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider border-b border-gray-200">
            <tr>
              <th className="py-4 px-6">Username</th>
              <th className="py-4 px-6">Amount</th>
              <th className="py-4 px-6">Type</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6">Bank Info</th>
              <th className="py-4 px-6 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500 animate-pulse">
                  Loading transactions...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  No bank transactions found.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction._id} className="hover:bg-gray-50 transition-colors">
                  {/* Safely fallback if user was deleted */}
                  <td className="py-3 px-6 font-medium text-gray-900">
                    {transaction.userId?.username || <span className="text-gray-400 italic">Unknown User</span>}
                  </td>
                  
                  <td className="py-3 px-6 font-semibold text-green-600">
                    ₹{transaction.amount.toLocaleString()}
                  </td>
                  
                  <td className="py-3 px-6 capitalize">
                    {transaction.type}
                  </td>
                  
                  <td className="py-3 px-6">
                    <span className={`px-2.5 py-1 border rounded-full text-xs font-medium uppercase tracking-wide ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  
                  <td className="py-3 px-6">
                    {transaction.bankId ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{transaction.bankId.bankName}</span>
                        <span className="text-xs text-gray-500">{transaction.bankId.accountHolderName}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">N/A</span>
                    )}
                  </td>
                  
                  <td className="py-3 px-6 text-center">
                    {/* Disable select dropdown if this specific row is updating */}
                    <select
                      className={`text-sm p-1.5 rounded-md border font-medium outline-none transition-colors ${updatingId === transaction._id ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-300 text-gray-700 focus:border-blue-500'}`}
                      value={transaction.status}
                      disabled={updatingId === transaction._id}
                      onChange={(e) => changeTransactionStatus(transaction._id, e.target.value)}
                    >
                      <option value="waiting">Waiting</option>
                      <option value="completed">Completed</option>
                      <option value="successful">Successful</option>
                      <option value="failed">Failed</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row justify-between mt-6 items-center text-sm">
        <span className="text-gray-600 mb-4 sm:mb-0">
          Page <span className="font-semibold text-gray-800">{page}</span> of <span className="font-semibold text-gray-800">{totalPages}</span>
        </span>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className={`px-4 py-2 border rounded-md transition-colors font-medium ${page === 1 ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Previous
          </button>
          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages || totalPages === 0}
            className={`px-4 py-2 border rounded-md transition-colors font-medium ${page === totalPages || totalPages === 0 ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}