'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

// FIXED CASING: PascalCase import required by TypeScript
import LatestGameHistory from '@/components/admin/LatestGameHistory';

// -----------------------------------------------------------------------------
// TypeScript Interfaces
// -----------------------------------------------------------------------------
interface Seat {
  seatNumber: number;
  userId?: string;
  buyInAmount: number;
  balanceAtTable: number;
  isSittingOut: boolean;
}

interface PokerDesk {
  _id: string;
  pokerModeId: string;
  tableName: string;
  maxSeats: number;
  seats: Seat[];
  observers: string[];
  currentGameStatus: 'waiting' | 'in-progress' | 'finished' | string;
  totalBuyIns: number;
  minBuyIn?: number;
  maxBuyIn?: number;
}

export default function PokerDeskManagement() {
  const params = useParams<{ pokerModeId: string }>();
  const pokerModeId = params?.pokerModeId;

  // Data State
  const [pokerDesks, setPokerDesks] = useState<PokerDesk[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [newPokerDesk, setNewPokerDesk] = useState<Partial<PokerDesk>>({
    tableName: '',
    maxSeats: 9,
    currentGameStatus: 'waiting',
    totalBuyIns: 0,
  });

  // Edit State
  const [editingPokerDeskId, setEditingPokerDeskId] = useState<string | null>(null);
  const [editingPokerDesk, setEditingPokerDesk] = useState<Partial<PokerDesk>>({});

  const fetchPokerDesks = useCallback(async () => {
    if (!pokerModeId) return;
    
    setLoading(true);
    setError(null);
    try {
      // API MIGRATION: Fetch Desks by Mode ID
      const response = await axios.get('/api/admin/pokerDesks', {
        params: { pokerModeId }
      });
      setPokerDesks(response.data.data || response.data);
    } catch (err) {
      console.error('Error fetching poker desks:', err);
      setError('Failed to fetch poker desks.');
    } finally {
      setLoading(false);
    }
  }, [pokerModeId]);

  useEffect(() => {
    fetchPokerDesks();
  }, [fetchPokerDesks]);

  // -----------------------------------------------------------------------------
  // Form Handlers
  // -----------------------------------------------------------------------------
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewPokerDesk(prev => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingPokerDesk(prev => ({ ...prev, [name]: value }));
  };

  // -----------------------------------------------------------------------------
  // CRUD Operations
  // -----------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pokerModeId) return;

    try {
      // API MIGRATION: Create Desk
      await axios.post('/api/admin/pokerDesks', {
        ...newPokerDesk,
        pokerModeId,
      });
      
      setNewPokerDesk({ tableName: '', maxSeats: 9, currentGameStatus: 'waiting', totalBuyIns: 0 });
      fetchPokerDesks();
    } catch (error) {
      console.error('Error creating poker desk:', error);
      alert('Failed to create poker desk.');
    }
  };

  const startEditing = (desk: PokerDesk) => {
    setEditingPokerDeskId(desk._id);
    setEditingPokerDesk({ ...desk });
  };

  const cancelEditing = () => {
    setEditingPokerDeskId(null);
    setEditingPokerDesk({});
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPokerDeskId) return;

    try {
      // API MIGRATION: Modern PUT requests target the specific ID path
      await axios.put(`/api/admin/pokerDesks/${editingPokerDeskId}`, editingPokerDesk);
      cancelEditing();
      fetchPokerDesks();
    } catch (error) {
      console.error('Error updating poker desk:', error);
      alert('Failed to update poker desk.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this desk? All active games will be disrupted.")) return;

    try {
      // API MIGRATION: Modern DELETE requests target the specific ID path
      await axios.delete(`/api/admin/pokerDesks/${id}`);
      fetchPokerDesks();
    } catch (error) {
      console.error('Error deleting poker desk:', error);
      alert('Failed to delete poker desk.');
    }
  };

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------
  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white p-6 rounded-lg shadow-md flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Poker Desk Management</h1>
            <p className="text-gray-500 text-sm mt-1">Mode ID: <span className="font-mono">{pokerModeId}</span></p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Desk List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Active Desks</h2>
            
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-t-4 border-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : pokerDesks.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow-sm text-center text-gray-500 border border-gray-200">
                No desks created for this mode yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pokerDesks.map(desk => (
                  <div key={desk._id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{desk.tableName}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>Max Seats: <span className="font-semibold text-gray-900">{desk.maxSeats}</span></p>
                        <p>Total Buy-Ins: <span className="font-semibold text-green-600">${desk.totalBuyIns}</span></p>
                        <p>Status: 
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            desk.currentGameStatus === 'in-progress' ? 'bg-green-100 text-green-800' :
                            desk.currentGameStatus === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {desk.currentGameStatus}
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t flex space-x-2">
                      <button 
                        onClick={() => startEditing(desk)} 
                        className="flex-1 bg-yellow-500 text-white py-1.5 rounded text-sm hover:bg-yellow-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(desk._id)} 
                        className="flex-1 bg-red-500 text-white py-1.5 rounded text-sm hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                      <Link 
                        href={`/admin/pokerDesk/details/${desk._id}`} 
                        className="flex-1 bg-blue-600 text-white py-1.5 rounded text-sm text-center hover:bg-blue-700 transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Form Container */}
          <div>
            <div className="bg-white p-6 rounded-lg shadow-md sticky top-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                {editingPokerDeskId ? 'Edit Desk' : 'Create New Desk'}
              </h2>
              <form onSubmit={editingPokerDeskId ? handleEditSubmit : handleSubmit} className="space-y-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Table Name</label>
                  <input
                    type="text"
                    name="tableName"
                    value={editingPokerDeskId ? editingPokerDesk.tableName || '' : newPokerDesk.tableName || ''}
                    onChange={editingPokerDeskId ? handleEditChange : handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Seats</label>
                  <input
                    type="number"
                    name="maxSeats"
                    value={editingPokerDeskId ? editingPokerDesk.maxSeats || 9 : newPokerDesk.maxSeats || 9}
                    onChange={editingPokerDeskId ? handleEditChange : handleChange}
                    min="2"
                    max="10"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
                  <select
                    name="currentGameStatus"
                    value={editingPokerDeskId ? editingPokerDesk.currentGameStatus || 'waiting' : newPokerDesk.currentGameStatus || 'waiting'}
                    onChange={editingPokerDeskId ? handleEditChange : handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-white focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="waiting">Waiting</option>
                    <option value="in-progress">In Progress</option>
                    <option value="finished">Finished</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Buy-Ins ($)</label>
                  <input
                    type="number"
                    name="totalBuyIns"
                    value={editingPokerDeskId ? editingPokerDesk.totalBuyIns || 0 : newPokerDesk.totalBuyIns || 0}
                    onChange={editingPokerDeskId ? handleEditChange : handleChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex space-x-3">
                  {editingPokerDeskId && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors font-medium"
                  >
                    {editingPokerDeskId ? 'Update Desk' : 'Create Desk'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Global Game History matching this Mode */}
        {pokerModeId && (
          <div className="bg-white p-6 rounded-lg shadow-md mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Recent Games (Mode Level)</h2>
            <LatestGameHistory pokerModeId={pokerModeId} />
          </div>
        )}

      </div>
    </div>
  );
}