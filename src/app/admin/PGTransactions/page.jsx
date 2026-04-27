'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

 

const PMGTransactions = () => {
  const [transactions, setTransactions] = useState();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  const [filters, setFilters] = useState({
    username: '',
    orderId: '',
    status: '',
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.post('/api/admin/auth/getPmgTransactions', {
          page,
          limit: itemsPerPage,
          ...filters,
        });

        setTransactions(response.data.transactions);
        setTotalPages(response.data.totalPages);
      } catch (error) {
        console.error('Error fetching PMG transactions:', error);
      }
    };

    fetchTransactions();
  }, [page, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prevFilters) => ({ ...prevFilters, [name]: value }));
  };

  const applyFilters = () => {
    setPage(1); // Reset to the first page when filters are applied
  };

  return (
    <div className="p-8 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold mb-6 text-gray-700">PMG Transactions</h2>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <input
          type="text"
          name="username"
          value={filters.username}
          onChange={handleFilterChange}
          placeholder="Username"
          className="p-2 border rounded-md"
        />
        <input
          type="text"
          name="orderId"
          value={filters.orderId}
          onChange={handleFilterChange}
          placeholder="Order ID"
          className="p-2 border rounded-md"
        />
        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
          className="p-2 border rounded-md"
        >
          <option value="">All Status</option>
          <option value="created">Created</option>
          <option value="successful">Successful</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <button
        onClick={applyFilters}
        className="mb-6 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
      >
        Apply Filters
      </button>

      {/* Transactions Table */}
      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
        <thead className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
          <tr>
            <th className="py-3 px-6 text-left">Username</th>
            <th className="py-3 px-6 text-left">Order ID</th>
            <th className="py-3 px-6 text-left">Amount</th>
            <th className="py-3 px-6 text-left">Currency</th>
            <th className="py-3 px-6 text-left">Status</th>
            <th className="py-3 px-6 text-left">Created At</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 text-sm font-light">
          {transactions && transactions.map((transaction) => (
            <tr key={transaction._id} className="border-b border-gray-200 hover:bg-gray-100">
              <td className="py-3 px-6">{transaction.userId?.username}</td>
              <td className="py-3 px-6">{transaction.orderId || 'N/A'}</td>
              <td className="py-3 px-6">{transaction.amount.toLocaleString()}</td>
              <td className="py-3 px-6">{transaction.currency}</td>
              <td className="py-3 px-6">
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    transaction.status === 'pending'
                      ? 'bg-yellow-200 text-yellow-800'
                      : transaction.status === 'successful'
                      ? 'bg-green-200 text-green-800'
                      : transaction.status === 'failed'
                      ? 'bg-red-200 text-red-800'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {transaction.status}
                </span>
              </td>
              <td className="py-3 px-6">{new Date(transaction.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex justify-between mt-8 items-center">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={page === 1}
          className={`px-4 py-2 bg-gray-300 rounded-lg ${page === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-400'}`}
        >
          Previous
        </button>
        <span className="text-gray-700 font-medium">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={page === totalPages}
          className={`px-4 py-2 bg-gray-300 rounded-lg ${page === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-400'}`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PMGTransactions;
