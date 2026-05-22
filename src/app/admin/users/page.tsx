'use client';

import React, { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";

// -----------------------------------------------------------------------------
// TypeScript Interfaces
// -----------------------------------------------------------------------------
interface DeviceInfo {
  type?: string;
  os?: string;
}

interface User {
  _id: string;
  username: string;
  email: string;
  createdAt: string;
  lastLogin?: string;
  status: 'active' | 'inactive' | 'suspended';
  walletBalance: number;
  deviceInfo?: DeviceInfo;
}

interface FetchUsersResponse {
  success: boolean;
  users: User[];
  totalPages: number;
  totalUsers: number;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Modal State
  const [showBonusModal, setShowBonusModal] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [bonusAmount, setBonusAmount] = useState<string>("");
  const [remark, setRemark] = useState<string>("");
  
  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalUsers, setTotalUsers] = useState<number>(0);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, itemsPerPage, searchTerm, selectedStatus, dateFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: itemsPerPage,
        searchName: searchTerm,
        status: selectedStatus,
        startDate: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
      };
      
      // API MIGRATION: Fetch Users
      const response = await axios.get<FetchUsersResponse>("/api/admin/users", { params });
      
      // Handle varied response structures safely
      const data = response.data;
      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
      setTotalUsers(data.totalUsers || 0);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * API MIGRATION: Update User Status via PATCH
   */
  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await axios.patch(`/api/admin/users/${userId}/status`, { status: newStatus });
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    }
  };

  const handleOpenBonusModal = (user: User) => {
    setCurrentUser(user);
    setShowBonusModal(true);
  };

  const handleCloseBonusModal = () => {
    setShowBonusModal(false);
    setCurrentUser(null);
    setBonusAmount("");
    setRemark("");
  };

  // /**
  //  * API MIGRATION: Add Balance (Bonus) via POST
  //  */
  // const handleBonusSubmit = async () => {
  //   if (!currentUser || !bonusAmount || isNaN(Number(bonusAmount))) {
  //     alert("Please enter a valid bonus amount.");
  //     return;
  //   }

  //   setIsSubmitting(true);
  //   try {
  //     await axios.post(`/api/admin/users/${currentUser._id}/balance`, {
  //       amount: Number(bonusAmount),
  //       remark,
  //       type: 'bonus' // Standardizing the ledger entry type
  //     });
      
  //     alert(`Successfully added bonus to ${currentUser.username}`);
  //     handleCloseBonusModal();
  //     fetchUsers(); // Refresh balances
  //   } catch (error) {
  //     console.error("Error adding bonus:", error);
  //     alert("Failed to add bonus.");
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };
  /**
   * API MIGRATION: Add Balance (Bonus) via POST
   * FIXED (C1): Updated payload to match expected { bonusAmount, action, remark }
   */
  const handleBonusSubmit = async () => {
    if (!currentUser || !bonusAmount || isNaN(Number(bonusAmount))) {
      alert("Please enter a valid bonus amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`/api/admin/users/${currentUser._id}/balance`, {
        bonusAmount: Number(bonusAmount), // Changed from 'amount'
        action: 'add',                    // Changed from 'type'
        remark                            // Kept remark for audit logs
      });
      
      alert(`Successfully added bonus to ${currentUser.username}`);
      handleCloseBonusModal();
      fetchUsers(); // Refresh balances
    } catch (error) {
      console.error("Error adding bonus:", error);
      alert("Failed to add bonus.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-7xl mx-auto mt-6 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">User Management</h1>

      {/* Filters Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <input
          type="text"
          placeholder="Search by username or email..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
        />
        <select
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setPage(1);
          }}
          className="px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
        >
          <option value={10}>10 per page</option>
          <option value={20}>20 per page</option>
          <option value={50}>50 per page</option>
        </select>
      </div>

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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Device Info</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Last Login</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Wallet</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{user.username}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.deviceInfo ? `${user.deviceInfo.type || 'Unknown'} / ${user.deviceInfo.os || 'Unknown'}` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-green-600">
                      ${user.walletBalance?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select
                        value={user.status}
                        onChange={(e) => handleStatusChange(user._id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 outline-none ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' :
                          user.status === 'suspended' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        <option value="active" className="bg-white text-black">Active</option>
                        <option value="inactive" className="bg-white text-black">Inactive</option>
                        <option value="suspended" className="bg-white text-black">Suspended</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium flex space-x-2">
                      <button
                        onClick={() => handleOpenBonusModal(user)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition-colors shadow-sm text-xs"
                      >
                        + Bonus
                      </button>
                      <Link 
                        href={`/admin/users/${user._id}`}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors shadow-sm text-xs"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-gray-700">
          Showing total <span className="font-bold">{totalUsers}</span> users
        </span>
        <div className="flex space-x-1">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className={`px-3 py-1 rounded border ${page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Prev
          </button>
          
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((p) => {
            // Logic to only show nearby pages
            if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded border ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              );
            }
            if (p === page - 2 || p === page + 2) {
              return <span key={p} className="px-2 py-1 text-gray-500">...</span>;
            }
            return null;
          })}

          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages || totalPages === 0}
            className={`px-3 py-1 rounded border ${page === totalPages || totalPages === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Next
          </button>
        </div>
      </div>

      {/* Add Bonus Modal */}
      {showBonusModal && currentUser && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-md border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Add Bonus to {currentUser.username}</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-gray-700">Bonus Amount ($)</label>
              <input
                type="number"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="e.g., 50.00"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-700">Remark / Reason</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="e.g., Tournament Winner Compensation"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none h-24"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseBonusModal}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBonusSubmit}
                disabled={isSubmitting}
                className={`px-4 py-2 text-white rounded font-medium transition-colors ${
                  isSubmitting ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isSubmitting ? 'Processing...' : 'Submit Bonus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}