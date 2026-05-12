'use client';

import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import LatestGameHistory from '@/components/admin/LatestGameHistory';

// -----------------------------------------------------------------------------
// TypeScript Interfaces
// -----------------------------------------------------------------------------
interface PokerMode {
  _id: string;
  pokerId: string;
  stake?: number;
  minBuyIn: number;
  maxBuyIn: number;
  minPlayerCount: number;
  bType: 'blinds' | 'antes' | 'both';
  status: 'active' | 'disable';
  description?: string;
  mode: 'cash' | 'practice';
  createdAt: string;
  updatedAt: string;
}

export default function PokerModeAdmin() {
  const params = useParams<{ pokerId: string }>();
  const pokerId = params?.pokerId;

  // Data State
  const [pokerModes, setPokerModes] = useState<PokerMode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [newPokerMode, setNewPokerMode] = useState<Partial<PokerMode>>({
    pokerId: pokerId || '',
    stake: 0,
    minBuyIn: 0,
    maxBuyIn: 0,
    minPlayerCount: 2,
    bType: 'blinds',
    status: 'active',
    mode: 'cash',
    description: ''
  });

  // Edit State
  const [editingPokerModeId, setEditingPokerModeId] = useState<string | null>(null);
  const [editingPokerMode, setEditingPokerMode] = useState<Partial<PokerMode>>({});

  const fetchPokerModes = useCallback(async () => {
    if (!pokerId) return;

    setLoading(true);
    setError(null);
    try {
      // API MIGRATION: Modern GET request with query params
      const response = await axios.get('/api/admin/pokerModes', {
        params: { pokerId }
      });
      setPokerModes(response.data.data || response.data);
    } catch (err) {
      console.error('Error fetching poker modes:', err);
      setError('Failed to load poker modes.');
    } finally {
      setLoading(false);
    }
  }, [pokerId]);

  useEffect(() => {
    fetchPokerModes();
  }, [fetchPokerModes]);

  // -----------------------------------------------------------------------------
  // Form Handlers
  // -----------------------------------------------------------------------------
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewPokerMode(prev => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingPokerMode(prev => ({ ...prev, [name]: value }));
  };

  // -----------------------------------------------------------------------------
  // CRUD Operations
  // -----------------------------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pokerId) return;

    try {
      // API MIGRATION: Modern POST
      await axios.post('/api/admin/pokerModes', { ...newPokerMode, pokerId });
      
      setNewPokerMode({
        pokerId, stake: 0, minBuyIn: 0, maxBuyIn: 0, minPlayerCount: 2, 
        bType: 'blinds', status: 'active', mode: 'cash', description: ''
      });
      fetchPokerModes();
    } catch (error) {
      console.error('Error creating poker mode:', error);
      alert('Failed to create poker mode.');
    }
  };

  const startEditing = (mode: PokerMode) => {
    setEditingPokerModeId(mode._id);
    setEditingPokerMode({ ...mode });
  };

  const cancelEditing = () => {
    setEditingPokerModeId(null);
    setEditingPokerMode({});
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPokerModeId) return;

    try {
      // API MIGRATION: Modern PUT by ID
      await axios.put(`/api/admin/pokerModes/${editingPokerModeId}`, editingPokerMode);
      cancelEditing();
      fetchPokerModes();
    } catch (error) {
      console.error('Error updating poker mode:', error);
      alert('Failed to update poker mode.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Poker Mode? All associated desks will be affected.")) return;

    try {
      // API MIGRATION: Modern DELETE by ID
      await axios.delete(`/api/admin/pokerModes/${id}`);
      fetchPokerModes();
    } catch (error) {
      console.error('Error deleting poker mode:', error);
      alert('Failed to delete poker mode.');
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white p-6 rounded-lg shadow-md flex justify-between items-center border-l-4 border-blue-600">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Poker Mode Management</h1>
            <p className="text-gray-500 text-sm mt-1">Master Game ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{pokerId}</span></p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Mode List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Active Modes</h2>
            
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-t-4 border-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : pokerModes.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow-sm text-center text-gray-500 border border-gray-200">
                No modes created for this game yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pokerModes.map(mode => (
                  <div key={mode._id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                          mode.mode === 'cash' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {mode.mode}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          mode.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {mode.status}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-700 mt-4">
                        <p className="flex justify-between border-b pb-1"><span>Min Buy-In:</span> <span className="font-semibold">${mode.minBuyIn}</span></p>
                        <p className="flex justify-between border-b pb-1"><span>Max Buy-In:</span> <span className="font-semibold">${mode.maxBuyIn}</span></p>
                        <p className="flex justify-between border-b pb-1"><span>Min Players:</span> <span className="font-semibold">{mode.minPlayerCount}</span></p>
                        <p className="flex justify-between border-b pb-1"><span>Blind Type:</span> <span className="font-semibold uppercase">{mode.bType}</span></p>
                        {mode.stake !== undefined && <p className="flex justify-between border-b pb-1"><span>Stake:</span> <span className="font-semibold">${mode.stake}</span></p>}
                      </div>
                    </div>
                    
                    <div className="mt-5 pt-4 border-t flex space-x-2">
                      <button 
                        onClick={() => startEditing(mode)} 
                        className="flex-1 bg-yellow-500 text-white py-1.5 rounded text-sm hover:bg-yellow-600 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(mode._id)} 
                        className="flex-1 bg-red-500 text-white py-1.5 rounded text-sm hover:bg-red-600 transition-colors font-medium"
                      >
                        Delete
                      </button>
                      <Link 
                        href={`/admin/pokerDesk/${mode._id}`} 
                        className="flex-1 bg-blue-600 text-white py-1.5 rounded text-sm text-center hover:bg-blue-700 transition-colors font-medium"
                      >
                        Manage Desks
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
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
                {editingPokerModeId ? 'Edit Poker Mode' : 'Create New Mode'}
              </h2>
              <form onSubmit={editingPokerModeId ? handleEditSubmit : handleSubmit} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Mode Type</label>
                    <select
                      name="mode"
                      value={editingPokerModeId ? editingPokerMode.mode || 'cash' : newPokerMode.mode || 'cash'}
                      onChange={editingPokerModeId ? handleEditChange : handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="cash">Cash</option>
                      <option value="practice">Practice</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Status</label>
                    <select
                      name="status"
                      value={editingPokerModeId ? editingPokerMode.status || 'active' : newPokerMode.status || 'active'}
                      onChange={editingPokerModeId ? handleEditChange : handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="active">Active</option>
                      <option value="disable">Disabled</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Min Buy-In ($)</label>
                    <input
                      type="number"
                      name="minBuyIn"
                      value={editingPokerModeId ? editingPokerMode.minBuyIn || 0 : newPokerMode.minBuyIn || 0}
                      onChange={editingPokerModeId ? handleEditChange : handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Max Buy-In ($)</label>
                    <input
                      type="number"
                      name="maxBuyIn"
                      value={editingPokerModeId ? editingPokerMode.maxBuyIn || 0 : newPokerMode.maxBuyIn || 0}
                      onChange={editingPokerModeId ? handleEditChange : handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Min Players</label>
                    <input
                      type="number"
                      name="minPlayerCount"
                      value={editingPokerModeId ? editingPokerMode.minPlayerCount || 2 : newPokerMode.minPlayerCount || 2}
                      onChange={editingPokerModeId ? handleEditChange : handleInputChange}
                      min="2"
                      max="10"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Blind Type</label>
                    <select
                      name="bType"
                      value={editingPokerModeId ? editingPokerMode.bType || 'blinds' : newPokerMode.bType || 'blinds'}
                      onChange={editingPokerModeId ? handleEditChange : handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="blinds">Blinds</option>
                      <option value="antes">Antes</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Description (Optional)</label>
                  <textarea
                    name="description"
                    value={editingPokerModeId ? editingPokerMode.description || '' : newPokerMode.description || ''}
                    onChange={editingPokerModeId ? handleEditChange : handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-4 flex space-x-3">
                  {editingPokerModeId && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300 transition-colors font-bold"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors font-bold"
                  >
                    {editingPokerModeId ? 'Update Mode' : 'Create Mode'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}