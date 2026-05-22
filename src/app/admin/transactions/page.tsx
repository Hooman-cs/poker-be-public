'use client';

import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

// -----------------------------------------------------------------------------
// TypeScript Interfaces
// -----------------------------------------------------------------------------
interface PopulatedUser {
  username: string;
  mobileNumber?: string;
}

interface PopulatedBank {
  bankName: string;
  accountHolderName: string;
}

interface IBankTransaction {
  _id: string;
  userId?: PopulatedUser;
  amount: number;
  type: 'deposit' | 'withdraw' | string;
  status: 'failed' | 'completed' | 'waiting' | 'successful' | string;
  bankId?: PopulatedBank;
  remark?: string;
  createdOn: string;
}

interface FetchTransactionsResponse {
  transactions: IBankTransaction[];
  totalPages: number;
  totalItems?: number;
}

export default function BankTransactions() {
  // Data State
  const [transactions, setTransactions] = useState<IBankTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 10;

  // Filter State (Input bindings)
  const [filters, setFilters] = useState({
    username: '',
    status: '',
    type: '',
    maxAmount: '',
    sortByDate: 'desc',
  });

  // Active Filter State (Used for the actual API call)
  const [activeFilters, setActiveFilters] = useState(filters);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // API MIGRATION: Modern App Router GET endpoint
      const response = await axios.get<FetchTransactionsResponse>('/api/admin/bankTransactions', {
        params: {
          page,
          limit: itemsPerPage,
          ...activeFilters,
        },
      });
      
      setTransactions(response.data.transactions || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (err: unknown) {
      console.error('Error fetching bank transactions:', err);
      setError('Failed to load bank transactions. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [page, activeFilters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Applies the filters explicitly to prevent excessive API calls
   */
  const applyFilters = () => {
    setActiveFilters(filters);
    setPage(1); // Reset to page 1 on new search
  };

  /**
   * Clears all filters
   */
  const clearFilters = () => {
    const cleared = { username: '', status: '', type: '', maxAmount: '', sortByDate: 'desc' };
    setFilters(cleared);
    setActiveFilters(cleared);
    setPage(1);
  };

  // /**
  //  * API MIGRATION: Update status using RESTful PATCH request
  //  */
  // const changeTransactionStatus = async (id: string, newStatus: string) => {
  //   try {
  //     await axios.patch(`/api/admin/bankTransactions/${id}/status`, { status: newStatus });
  //     fetchTransactions(); // Refresh list to get updated data
  //   } catch (error) {
  //     console.error('Error updating transaction status:', error);
  //     alert('Failed to update transaction status.');
  //   }
  // };
  /**
   * API MIGRATION: Update status using RESTful PATCH request
   * FIXED (C2): Changed payload key from 'status' to 'newStatus'
   */
  const changeTransactionStatus = async (id: string, updatedStatus: string) => {
    try {
      await axios.patch(`/api/admin/bankTransactions/${id}/status`, { 
        newStatus: updatedStatus 
      });
      fetchTransactions(); // Refresh list to get updated data
    } catch (error) {
      console.error('Error updating transaction status:', error);
      alert('Failed to update transaction status.');
    }
  };
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-7xl mx-auto mt-6 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Bank Transactions (Deposits & Withdrawals)</h1>

      {/* Filters Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            name="username"
            placeholder="Search username..."
            value={filters.username}
            onChange={handleFilterChange}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
            className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="deposit">Deposit</option>
            <option value="withdraw">Withdraw</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="waiting">Waiting</option>
            <option value="completed">Completed</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
          <input
            type="number"
            name="maxAmount"
            placeholder="Max $"
            value={filters.maxAmount}
            onChange={handleFilterChange}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-end space-x-2">
          <button
            onClick={applyFilters}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 font-medium transition-colors shadow-sm"
          >
            Search
          </button>
          <button
            onClick={clearFilters}
            className="bg-gray-200 text-gray-800 px-3 py-2 rounded hover:bg-gray-300 font-medium transition-colors shadow-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-t-4 border-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Type / Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Bank Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No bank transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-bold text-gray-900">{transaction.userId?.username || 'Unknown User'}</p>
                      <p className="text-xs text-gray-500">{transaction.userId?.mobileNumber || 'No Phone'}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        transaction.type === 'deposit' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {transaction.type}
                      </span>
                      <p className="mt-1 font-bold text-gray-900">${transaction.amount?.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {transaction.bankId ? (
                        <>
                          <p className="text-sm font-semibold text-gray-800">{transaction.bankId.bankName}</p>
                          <p className="text-xs text-gray-500">{transaction.bankId.accountHolderName}</p>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">Not Provided</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.createdOn).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        className={`text-xs font-bold rounded-full px-3 py-1.5 border focus:ring-2 outline-none ${
                          transaction.status === 'successful' || transaction.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                          transaction.status === 'failed' ? 'bg-red-100 text-red-800 border-red-200' :
                          'bg-yellow-100 text-yellow-800 border-yellow-200'
                        }`}
                        value={transaction.status}
                        onChange={(e) => changeTransactionStatus(transaction._id, e.target.value)}
                      >
                        <option value="waiting" className="bg-white text-black">Waiting</option>
                        <option value="completed" className="bg-white text-black">Completed</option>
                        <option value="successful" className="bg-white text-black">Successful</option>
                        <option value="failed" className="bg-white text-black">Failed</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && transactions.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-gray-700">
            Page <span className="font-bold">{page}</span> of <span className="font-bold">{totalPages}</span>
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                page === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page >= totalPages}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                page >= totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}