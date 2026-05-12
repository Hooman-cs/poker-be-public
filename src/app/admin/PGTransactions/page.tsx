'use client';

import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

// -----------------------------------------------------------------------------
// TypeScript Interfaces
// -----------------------------------------------------------------------------
interface PGTransaction {
  _id: string;
  username: string;
  amount: number;
  orderId: string;
  status: 'pending' | 'successful' | 'failed' | string;
  createdAt: string;
}

interface FetchTransactionsResponse {
  transactions: PGTransaction[];
  totalPages: number;
  totalItems?: number;
}

export default function PGTransactions() {
  const [transactions, setTransactions] = useState<PGTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 10;

  // Filter State
  const [filters, setFilters] = useState({
    username: '',
    orderId: '',
    status: '',
  });

  // Search State (Debounced to prevent API spam on every keystroke)
  const [activeFilters, setActiveFilters] = useState(filters);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // API MIGRATION: Modern GET request with query params
      const response = await axios.get<FetchTransactionsResponse>('/api/admin/pmgTransactions', {
        params: {
          page,
          limit: itemsPerPage,
          ...activeFilters,
        },
      });

      setTransactions(response.data.transactions || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (err: unknown) {
      console.error('Error fetching PMG transactions:', err);
      setError('Failed to load transactions. Please try again later.');
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
    setPage(1); // Reset to the first page when new filters are applied
  };

  /**
   * Clears all filters
   */
  const clearFilters = () => {
    const cleared = { username: '', orderId: '', status: '' };
    setFilters(cleared);
    setActiveFilters(cleared);
    setPage(1);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-7xl mx-auto mt-6 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Payment Gateway Transactions</h1>

      {/* Filters Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            name="username"
            placeholder="Search by username..."
            value={filters.username}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
          <input
            type="text"
            name="orderId"
            placeholder="Search by Order ID..."
            value={filters.orderId}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
          >
            <option value="">All Statuses</option>
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex items-end space-x-2">
          <button
            onClick={applyFilters}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors shadow-sm font-medium"
          >
            Search
          </button>
          <button
            onClick={clearFilters}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors shadow-sm font-medium"
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
          <div className="w-10 h-10 border-t-4 border-blue-600 border-solid rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date & Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {transaction.username || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-green-600">
                      ${transaction.amount?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                      {transaction.orderId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          transaction.status.toLowerCase() === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : transaction.status.toLowerCase() === 'successful'
                            ? 'bg-green-100 text-green-800'
                            : transaction.status.toLowerCase() === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {transaction.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.createdAt).toLocaleString()}
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