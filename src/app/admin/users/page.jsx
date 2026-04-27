"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [bonusAmount, setBonusAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchUsers();
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
      const response = await axios.get("/api/admin/auth/users", { params });
      setUsers(response.data.users);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      const response = await axios.put(`/api/admin/auth/users/updateStatus`, {
        userId,
        status: newStatus,
      });

      if (response.status === 200) {
        alert("status changed successfully!");
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user._id === userId
              ? {
                  ...user,
                  status: newStatus, // Update the walletBalance
                }
              : user
          )
        );
        handleCloseBonusModal(); // Close modal after successful bonus update
      } else {
        alert("Failed to change status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleOpenBonusModal = (user) => {
    setCurrentUser(user);
    setShowBonusModal(true);
  };

  const handleCloseBonusModal = () => {
    setShowBonusModal(false);
    setBonusAmount("");
    setRemark("");
  };

  const handleBonusSubmit = async () => {
    if (!bonusAmount || !remark) {
      alert("Please provide both bonus amount and remark.");
      return;
    }

    try {
      // Make API request to add the bonus to the user
      const response = await axios.post("/api/admin/auth/users/addBalance", {
        userId: currentUser._id, // Pass the user ID
        bonusAmount: parseInt(bonusAmount), // Pass the bonus amount
        remark: remark, // Pass the remark
        action: "add", // Action to add the bonus
      });

      if (response.status === 200) {
        alert("Bonus added successfully!");
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user._id === currentUser._id
              ? {
                  ...user,
                  walletBalance: user.walletBalance + parseInt(bonusAmount), // Update the walletBalance
                }
              : user
          )
        );
        handleCloseBonusModal(); // Close modal after successful bonus update
      } else {
        alert("Failed to add bonus");
      }
    } catch (error) {
      console.error("Error giving bonus:", error);
      alert("An error occurred while adding bonus.");
    }
  };

  const renderPagination = () => {
    const maxPagesToShow = 5;
    let pages = [];

    if (totalPages <= maxPagesToShow) {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      const startPage = Math.max(1, page - 2);
      const endPage = Math.min(totalPages, page + 2);

      pages = Array.from(
        { length: endPage - startPage + 1 },
        (_, i) => startPage + i
      );

      if (startPage > 1) {
        pages.unshift("...");
        pages.unshift(1);
      }

      if (endPage < totalPages) {
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return (
      <div className="flex items-center gap-2">
        {pages.map((p, index) => (
          <button
            key={index}
            onClick={() => typeof p === "number" && setPage(p)}
            className={`px-4 py-2 ${
              p === page
                ? "bg-blue-500 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            } rounded`}
            disabled={p === "..."}
          >
            {p}
          </button>
        ))}
      </div>
    );
  };

  const filteredUsers = users.filter((user) => {
    return (
      (searchTerm === "" ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (selectedStatus === "" || user.status === selectedStatus) &&
      (dateFilter === "" ||
        new Date(user.createdOn).toISOString().split("T")[0] === dateFilter)
    );
  });

  return (
    <div className="p-6 bg-gray-100 min-h-screen flex flex-col max-h-[70vh]">
  <div className="flex flex-col md:flex-row justify-between items-center mb-4">
    <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
    <div className="flex flex-wrap gap-4 mt-4 md:mt-0">
      <div className="flex items-center gap-2">
        <label htmlFor="itemsPerPage">Items per page:</label>
        <select
          id="itemsPerPage"
          value={itemsPerPage}
          onChange={(e) => setItemsPerPage(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={10}>10</option>
          <option value={30}>30</option>
          <option value={50}>50</option>
        </select>
      </div>
      <input
        type="text"
        placeholder="Search by username"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
        className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Filter by Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="suspended">Suspended</option>
      </select>
      <input
        type="date"
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
        className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>

  {loading ? (
    <p className="text-center text-gray-500">Loading users...</p>
  ) : (
    <div className="overflow-y-auto max-h-[70vh] scrollbar-none" style={{scrollbarWidth:'none'}}>
      <table className="w-full bg-white shadow-md rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-200 text-gray-600 text-sm uppercase font-semibold">
            <th className="p-3 text-left">Username</th>
            <th className="p-3 text-left">Mobile Number</th>
            <th className="p-3 text-left">Wallet Balance</th>
            <th className="p-3 text-left">Total Deposit</th>
            <th className="p-3 text-left">Total Withdraw</th>
            <th className="p-3 text-left">Games Played</th>
            <th className="p-3 text-left">Games Won</th>
            <th className="p-3 text-left">Total Bet</th>
            <th className="p-3 text-left">Total Win</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user) => (
            <tr key={user._id} className="border-b hover:bg-gray-50">
              <td className="p-3">{user.username}</td>
              <td className="p-3">{user.mobileNumber}</td>
              <td className="p-3">{user.walletBalance}</td>
              <td className="p-3">{user.totalDeposit}</td>
              <td className="p-3">{user.totalWithdraw}</td>
              <td className="p-3">{user.gamesPlayed}</td>
              <td className="p-3">{user.gamesWon}</td>
              <td className="p-3">{user.totalBet}</td>
              <td className="p-3">{user.totalWin}</td>
              <td className="p-3">
                <select
                  value={user.status}
                  onChange={(e) =>
                    handleStatusChange(user._id, e.target.value)
                  }
                  className="px-3 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </td>
              <td className="p-3 space-y-2">
                <button
                  onClick={() => handleOpenBonusModal(user)}
                  className="w-full px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Bonus
                </button>
                <button className="w-full px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600">
                  <Link href={`/admin/users/${user._id}`} passHref>
                    Details
                  </Link>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}

  {/* Bonus Modal */}
  {showBonusModal && (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-bold mb-4">Add Bonus</h2>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Bonus Amount</label>
          <input
            type="number"
            value={bonusAmount}
            onChange={(e) => setBonusAmount(e.target.value)}
            className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Remark</label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-4">
          <button
            onClick={handleCloseBonusModal}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleBonusSubmit}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )}

  {/* Pagination fixed at the bottom */}
  <div className="flex justify-center items-center mt-4">
    {renderPagination()}
  </div>
</div>

    // <div className="p-6 bg-gray-100 min-h-screen">
    //   <div className="flex flex-col md:flex-row justify-between items-center mb-4">
    //     <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
    //     <div className="flex flex-wrap gap-4 mt-4 md:mt-0">
    //       <div className="flex items-center gap-2">
    //         <label htmlFor="itemsPerPage">Items per page:</label>
    //         <select
    //           id="itemsPerPage"
    //           value={itemsPerPage}
    //           onChange={(e) => setItemsPerPage(Number(e.target.value))}
    //           className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    //         >
    //           <option value={10}>10</option>
    //           <option value={30}>30</option>
    //           <option value={50}>50</option>
    //         </select>
    //       </div>
    //       <input
    //         type="text"
    //         placeholder="Search by username"
    //         value={searchTerm}
    //         onChange={(e) => setSearchTerm(e.target.value)}
    //         className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    //       />
    //       <select
    //         value={selectedStatus}
    //         onChange={(e) => setSelectedStatus(e.target.value)}
    //         className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    //       >
    //         <option value="">Filter by Status</option>
    //         <option value="active">Active</option>
    //         <option value="inactive">Inactive</option>
    //         <option value="suspended">Suspended</option>
    //       </select>
    //       <input
    //         type="date"
    //         value={dateFilter}
    //         onChange={(e) => setDateFilter(e.target.value)}
    //         className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    //       />
    //     </div>
    //   </div>

    //   {loading ? (
    //     <p className="text-center text-gray-500">Loading users...</p>
    //   ) : (
    //     <table className="w-full bg-white shadow-md rounded-lg overflow-hidden">
    //       <thead>
    //         <tr className="bg-gray-200 text-gray-600 text-sm uppercase font-semibold">
    //           <th className="p-3 text-left">Username</th>
    //           <th className="p-3 text-left">Mobile Number</th>
    //           <th className="p-3 text-left">Wallet Balance</th>
    //           <th className="p-3 text-left">Total Deposit</th>
    //           <th className="p-3 text-left">Total Withdraw</th>
    //           <th className="p-3 text-left">Games Played</th>
    //           <th className="p-3 text-left">Games Won</th>
    //           <th className="p-3 text-left">Total Bet</th>
    //           <th className="p-3 text-left">Total Win</th>
    //           <th className="p-3 text-left">Status</th>
    //           <th className="p-3 text-left">Actions</th>
    //         </tr>
    //       </thead>
    //       <tbody>
    //         {filteredUsers.map((user) => (
    //           <tr key={user._id} className="border-b hover:bg-gray-50">
    //             <td className="p-3">{user.username}</td>
    //             <td className="p-3">{user.mobileNumber}</td>
    //             <td className="p-3">{user.walletBalance}</td>
    //             <td className="p-3">{user.totalDeposit}</td>
    //             <td className="p-3">{user.totalWithdraw}</td>
    //             <td className="p-3">{user.gamesPlayed}</td>
    //             <td className="p-3">{user.gamesWon}</td>
    //             <td className="p-3">{user.totalBet}</td>
    //             <td className="p-3">{user.totalWin}</td>
    //             <td className="p-3">
    //               <select
    //                 value={user.status}
    //                 onChange={(e) =>
    //                   handleStatusChange(user._id, e.target.value)
    //                 }
    //                 className="px-3 py-1 border rounded focus:ring-2 focus:ring-blue-500"
    //               >
    //                 <option value="active">Active</option>
    //                 <option value="inactive">Inactive</option>
    //                 <option value="suspended">Suspended</option>
    //               </select>
    //             </td>
    //             <td className="p-3 space-y-2">
    //               <button
    //                 onClick={() => handleOpenBonusModal(user)}
    //                 className="w-full px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
    //               >
    //                 Bonus
    //               </button>
    //               <button className="w-full px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600">
    //                 <Link href={`/admin/users/${user._id}`} passHref>
    //                   Details
    //                 </Link>
    //               </button>
    //             </td>
    //           </tr>
    //         ))}
    //       </tbody>
    //     </table>
    //   )}

    //   {/* Bonus Modal */}
    //   {showBonusModal && (
    //     <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
    //       <div className="bg-white p-6 rounded-lg shadow-lg w-96">
    //         <h2 className="text-xl font-bold mb-4">Add Bonus</h2>
    //         <div className="mb-4">
    //           <label className="block text-sm font-semibold mb-2">
    //             Bonus Amount
    //           </label>
    //           <input
    //             type="number"
    //             value={bonusAmount}
    //             onChange={(e) => setBonusAmount(e.target.value)}
    //             className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
    //           />
    //         </div>
    //         <div className="mb-4">
    //           <label className="block text-sm font-semibold mb-2">Remark</label>
    //           <textarea
    //             value={remark}
    //             onChange={(e) => setRemark(e.target.value)}
    //             className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
    //           />
    //         </div>
    //         <div className="flex justify-end gap-4">
    //           <button
    //             onClick={handleCloseBonusModal}
    //             className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
    //           >
    //             Cancel
    //           </button>
    //           <button
    //             onClick={handleBonusSubmit}
    //             className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
    //           >
    //             Submit
    //           </button>
    //         </div>
    //       </div>
    //     </div>
    //   )}

    //   <div class="flex justify-center items-center">{renderPagination()}</div>
    // </div>
  );
};

export default UserManagementPage;
